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
ANDROID_APP_SRC="$PROJECT_ROOT/android/app/src/main"
ANDROID_RES="$ANDROID_APP_SRC/res"
ANDROID_JAVA="$ANDROID_APP_SRC/java"
RESOURCES="$PROJECT_ROOT/resources"
ANDROID_RES_SRC="$RESOURCES/android-res"
WIDGET_SRC="$RESOURCES/widget"
ICON_SVG="$RESOURCES/icon.svg"
ICON_FOREGROUND_SVG="$RESOURCES/icon-foreground.svg"
MANIFEST="$ANDROID_APP_SRC/AndroidManifest.xml"
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
mkdir -p "$ANDROID_RES/drawable" "$ANDROID_RES/drawable-nodpi"
generate_png "$ICON_SVG" "$ANDROID_RES/drawable/splash.png" 1024 || true
# Also generate a higher-res splash for xxxhdpi devices
generate_png "$ICON_SVG" "$ANDROID_RES/drawable-nodpi/splash.png" 1200 || true

# Notification icon: small white icon for Android 5+. Generate from the
# foreground image. Keep it white/opaque since Android will colorize it.
echo "  - Generating notification icon from foreground SVG"
for dir in "${!DENSITIES[@]}"; do
    size="${DENSITIES[$dir]}"
    mkdir -p "$ANDROID_RES/$dir"
    generate_png "$ICON_FOREGROUND_SVG" "$ANDROID_RES/$dir/ic_notification.png" "$size" || true
done

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

# ---------------------------------------------------------------------------
# 5) Install the home-screen widget (Kotlin sources, layouts, drawables, xml)
# ---------------------------------------------------------------------------
echo "  - Installing home-screen widget (sessions of the day)"

WIDGET_PKG_DIR="$ANDROID_JAVA/com/psymanager/app/widget"
mkdir -p "$WIDGET_PKG_DIR"
cp "$WIDGET_SRC"/java/com/psymanager/app/widget/*.kt "$WIDGET_PKG_DIR/"

cp "$WIDGET_SRC"/res/layout/widget_sessions.xml      "$ANDROID_RES/layout/"
cp "$WIDGET_SRC"/res/layout/widget_session_item.xml  "$ANDROID_RES/layout/"

mkdir -p "$ANDROID_RES/drawable" "$ANDROID_RES/xml"
cp "$WIDGET_SRC"/res/drawable/widget_background.xml      "$ANDROID_RES/drawable/"
cp "$WIDGET_SRC"/res/drawable/widget_item_bg.xml         "$ANDROID_RES/drawable/"
cp "$WIDGET_SRC"/res/drawable/widget_item_bg_completed.xml "$ANDROID_RES/drawable/"
cp "$WIDGET_SRC"/res/drawable/widget_balance_dot.xml     "$ANDROID_RES/drawable/"
cp "$WIDGET_SRC"/res/drawable/widget_ic_refresh.xml      "$ANDROID_RES/drawable/"
cp "$WIDGET_SRC"/res/xml/widget_sessions_info.xml        "$ANDROID_RES/xml/"
cp "$WIDGET_SRC"/res/values/widget_strings.xml           "$ANDROID_RES/values/"

# Make sure the build.gradle compiles Kotlin sources (Capacitor's default Java
# Android module needs the kotlin-android plugin and kotlin-stdlib dependency).
echo "  - Ensuring Kotlin support is enabled in app/build.gradle"

python3 - <<PYEOF
import re, pathlib
p = pathlib.Path("$APP_GRADLE")
content = p.read_text()

if "kotlin-android" not in content:
    # Add Kotlin Android plugin after the com.android.application plugin line
    content = re.sub(
        r"(apply plugin: ['\"]com\.android\.application['\"])",
        r"\1\napply plugin: 'kotlin-android'",
        content,
        count=1,
    )

if "kotlin-stdlib" not in content:
    # Add Kotlin stdlib to the dependencies block
    content = re.sub(
        r"(dependencies\s*\{)",
        r"\1\n    implementation \"org.jetbrains.kotlin:kotlin-stdlib:1.9.24\"",
        content,
        count=1,
    )

p.write_text(content)
PYEOF

# Some Capacitor template versions don't add the Kotlin Gradle plugin to the
# project-level build.gradle classpath — make sure it's there.
ROOT_GRADLE="$PROJECT_ROOT/android/build.gradle"
if [ -f "$ROOT_GRADLE" ]; then
    python3 - <<PYEOF
import re, pathlib
p = pathlib.Path("$ROOT_GRADLE")
content = p.read_text()
if "kotlin-gradle-plugin" not in content:
    content = re.sub(
        r"(classpath ['\"]com\.android\.tools\.build:gradle:[^'\"]+['\"])",
        r"\1\n        classpath \"org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24\"",
        content,
        count=1,
    )
    p.write_text(content)
PYEOF
fi

# ---------------------------------------------------------------------------
# 6a) Patch MainActivity to register the custom WidgetPlugin. Capacitor only
#     auto-discovers plugins from npm packages, not from app-local sources.
# ---------------------------------------------------------------------------
echo "  - Registering WidgetPlugin in MainActivity"

MAIN_ACTIVITY_JAVA="$ANDROID_JAVA/com/psymanager/app/MainActivity.java"
if [ -f "$MAIN_ACTIVITY_JAVA" ]; then
    python3 - <<PYEOF
import re, pathlib
p = pathlib.Path("$MAIN_ACTIVITY_JAVA")
content = p.read_text()

if "WidgetPlugin" not in content:
    # Add the import for our plugin
    content = re.sub(
        r"(import com\.getcapacitor\.BridgeActivity;)",
        r"\1\nimport android.os.Bundle;\nimport com.psymanager.app.widget.WidgetPlugin;",
        content,
        count=1,
    )
    # Replace the empty class body with one that registers our plugin
    content = re.sub(
        r"(public class MainActivity extends BridgeActivity\s*\{)\s*\}",
        (
            r"\1\n"
            "    @Override\n"
            "    public void onCreate(Bundle savedInstanceState) {\n"
            "        registerPlugin(WidgetPlugin.class);\n"
            "        super.onCreate(savedInstanceState);\n"
            "    }\n"
            "}"
        ),
        content,
        count=1,
    )
    p.write_text(content)
PYEOF
fi

# ---------------------------------------------------------------------------
# 6b) Patch AndroidManifest.xml: register the widget receiver, the RemoteViews
#     service, and the deep-link intent-filter on MainActivity.
# ---------------------------------------------------------------------------
echo "  - Registering widget receiver, service and deep-link in AndroidManifest"

export MANIFEST
python3 - <<'PYEOF'
import re, pathlib, os

manifest_path = pathlib.Path(os.environ["MANIFEST"])
content = manifest_path.read_text()

# 6a) Add the deep-link intent-filter to the existing MainActivity (if missing)
if 'psymanager' not in content:
    deep_link = (
        '\n            <intent-filter android:autoVerify="false">'
        '\n                <action android:name="android.intent.action.VIEW" />'
        '\n                <category android:name="android.intent.category.DEFAULT" />'
        '\n                <category android:name="android.intent.category.BROWSABLE" />'
        '\n                <data android:scheme="psymanager" />'
        '\n            </intent-filter>'
    )
    # Insert just before </activity> for MainActivity
    content = re.sub(
        r'(<activity\b[^>]*\.MainActivity[^>]*>)([\s\S]*?)(</activity>)',
        lambda m: m.group(1) + m.group(2) + deep_link + '\n        ' + m.group(3),
        content,
        count=1,
    )

# 6b) Add the widget receiver + RemoteViewsService inside <application> (if missing)
if 'SessionsWidgetProvider' not in content:
    widget_block = (
        '\n        <receiver'
        '\n            android:name="com.psymanager.app.widget.SessionsWidgetProvider"'
        '\n            android:exported="false">'
        '\n            <intent-filter>'
        '\n                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />'
        '\n                <action android:name="com.psymanager.app.widget.ACTION_REFRESH" />'
        '\n                <action android:name="com.psymanager.app.widget.ACTION_DAILY_TICK" />'
        '\n            </intent-filter>'
        '\n            <meta-data'
        '\n                android:name="android.appwidget.provider"'
        '\n                android:resource="@xml/widget_sessions_info" />'
        '\n        </receiver>'
        '\n        <service'
        '\n            android:name="com.psymanager.app.widget.SessionsWidgetService"'
        '\n            android:permission="android.permission.BIND_REMOTEVIEWS"'
        '\n            android:exported="false" />'
    )
    # Insert before the closing </application>
    content = re.sub(
        r'(</application>)',
        widget_block + r'\n    \1',
        content,
        count=1,
    )

manifest_path.write_text(content)
PYEOF

echo "==> Android setup complete."
