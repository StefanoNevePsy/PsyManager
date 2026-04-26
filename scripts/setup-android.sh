#!/usr/bin/env bash
# setup-android.sh
# Customizes the Android platform after `npx cap add/sync android`:
#   - Installs adaptive launcher icons with Monet (themed icon) support
#   - Generates PNG mipmap fallbacks for Android < 8.0 (API < 26)
#   - Patches AndroidManifest.xml to enable predictive back gestures
#   - Updates app/build.gradle with versionCode and versionName
#   - Sets the right colors and theme references
#
# Usage:
#   VERSION_CODE=12 VERSION_NAME=1.0.12 ./scripts/setup-android.sh
#
# Requires: bash, sed, rsvg-convert (or ImageMagick `convert`)

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_RES="$PROJECT_ROOT/android/app/src/main/res"
RESOURCES="$PROJECT_ROOT/resources"
ANDROID_RES_SRC="$RESOURCES/android-res"
ICON_SVG="$RESOURCES/icon.svg"
ICON_FOREGROUND_SVG="$RESOURCES/icon-foreground.svg"
MANIFEST="$PROJECT_ROOT/android/app/src/main/AndroidManifest.xml"
APP_GRADLE="$PROJECT_ROOT/android/app/build.gradle"

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"

if [ ! -d "$PROJECT_ROOT/android" ]; then
    echo "Error: android/ directory not found. Run 'npx cap add android' first." >&2
    exit 1
fi

echo "==> Configuring Android resources (versionCode=$VERSION_CODE, versionName=$VERSION_NAME)"

# ---------------------------------------------------------------------------
# 1) Install adaptive icon vector drawables and the mipmap-anydpi-v26 wrappers
# ---------------------------------------------------------------------------
echo "  - Installing adaptive icons (foreground / background / monochrome)"

mkdir -p "$ANDROID_RES/drawable" "$ANDROID_RES/mipmap-anydpi-v26" "$ANDROID_RES/values"

cp "$ANDROID_RES_SRC/drawable/ic_launcher_background.xml"  "$ANDROID_RES/drawable/"
cp "$ANDROID_RES_SRC/drawable/ic_launcher_foreground.xml"  "$ANDROID_RES/drawable/"
cp "$ANDROID_RES_SRC/drawable/ic_launcher_monochrome.xml"  "$ANDROID_RES/drawable/"

cp "$ANDROID_RES_SRC/mipmap-anydpi-v26/ic_launcher.xml"        "$ANDROID_RES/mipmap-anydpi-v26/"
cp "$ANDROID_RES_SRC/mipmap-anydpi-v26/ic_launcher_round.xml"  "$ANDROID_RES/mipmap-anydpi-v26/"

# Merge our colors into values/colors.xml (overwrite to ensure ic_launcher_background is set)
cp "$ANDROID_RES_SRC/values/colors.xml" "$ANDROID_RES/values/ic_launcher_background.xml"

# ---------------------------------------------------------------------------
# 2) Generate PNG mipmap fallbacks for Android < 8.0 (API < 26).
#    Newer Android uses the adaptive icon XML; older devices need PNGs.
# ---------------------------------------------------------------------------
echo "  - Generating PNG mipmap fallbacks for older Android versions"

generate_png() {
    local src="$1"   # SVG source
    local dst="$2"   # destination PNG
    local size="$3"  # square size in px

    if command -v rsvg-convert >/dev/null 2>&1; then
        rsvg-convert -w "$size" -h "$size" "$src" -o "$dst"
    elif command -v convert >/dev/null 2>&1; then
        convert -background none -resize "${size}x${size}" "$src" "$dst"
    elif command -v magick >/dev/null 2>&1; then
        magick -background none -resize "${size}x${size}" "$src" "$dst"
    else
        echo "Error: neither rsvg-convert nor ImageMagick is installed." >&2
        exit 1
    fi
}

# Densities: mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
declare -A DENSITIES=(
    [mipmap-mdpi]=48
    [mipmap-hdpi]=72
    [mipmap-xhdpi]=96
    [mipmap-xxhdpi]=144
    [mipmap-xxxhdpi]=192
)

for dir in "${!DENSITIES[@]}"; do
    size="${DENSITIES[$dir]}"
    mkdir -p "$ANDROID_RES/$dir"
    generate_png "$ICON_SVG" "$ANDROID_RES/$dir/ic_launcher.png"       "$size"
    generate_png "$ICON_SVG" "$ANDROID_RES/$dir/ic_launcher_round.png" "$size"
    generate_png "$ICON_FOREGROUND_SVG" "$ANDROID_RES/$dir/ic_launcher_foreground.png" "$size"
done

# Splash and store icons (used by Capacitor's splash plugin if needed)
mkdir -p "$ANDROID_RES/drawable"
generate_png "$ICON_SVG" "$ANDROID_RES/drawable/splash.png" 1024 || true

# ---------------------------------------------------------------------------
# 3) Patch AndroidManifest.xml for predictive back gestures (Android 13+ / 14)
#    Adds android:enableOnBackInvokedCallback="true" to the <application> tag.
# ---------------------------------------------------------------------------
echo "  - Enabling predictive back gestures in AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
    echo "Error: AndroidManifest.xml not found at $MANIFEST" >&2
    exit 1
fi

if ! grep -q 'android:enableOnBackInvokedCallback' "$MANIFEST"; then
    # Insert the attribute before the closing > of the <application ...> opening tag.
    # Use a portable sed expression.
    python3 - <<PYEOF
import re, sys, pathlib
p = pathlib.Path("$MANIFEST")
content = p.read_text()
new = re.sub(
    r'(<application\b)([^>]*?)(>)',
    lambda m: m.group(1) + m.group(2) + '\n        android:enableOnBackInvokedCallback="true"' + m.group(3),
    content,
    count=1,
)
p.write_text(new)
PYEOF
fi

# ---------------------------------------------------------------------------
# 4) Update app/build.gradle with versionCode and versionName
# ---------------------------------------------------------------------------
echo "  - Setting versionCode=$VERSION_CODE and versionName=$VERSION_NAME"

if [ ! -f "$APP_GRADLE" ]; then
    echo "Error: $APP_GRADLE not found" >&2
    exit 1
fi

python3 - <<PYEOF
import re, pathlib
p = pathlib.Path("$APP_GRADLE")
content = p.read_text()
content = re.sub(r'versionCode\s+\d+',   f'versionCode {$VERSION_CODE}', content)
content = re.sub(r'versionName\s+"[^"]*"', f'versionName "$VERSION_NAME"', content)
p.write_text(content)
PYEOF

echo "==> Android setup complete."
