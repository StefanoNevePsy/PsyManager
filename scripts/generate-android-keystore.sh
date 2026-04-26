#!/usr/bin/env bash
# generate-android-keystore.sh
# Generates a release keystore for signing Android APKs and outputs
# the base64-encoded keystore + credentials for GitHub Secrets.
#
# Usage:
#   ./scripts/generate-android-keystore.sh
#
# This creates a new keystore file and displays the values to add to GitHub Secrets.
# Keep the output safe — the keystore and passwords are sensitive!

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_FILE="$PROJECT_ROOT/psymanager.keystore"
TEMP_CONFIG="$PROJECT_ROOT/.keystore_config"

# Keystore parameters (change these if you want different values)
KEYSTORE_ALIAS="psymanager"
KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-PsyManager@2024$(date +%s)}"  # Default: random password with timestamp
KEY_PASSWORD="$KEYSTORE_PASSWORD"  # Same as keystore password for simplicity
VALIDITY_DAYS=10957  # ~30 years

# Certificate details (non-interactive mode)
CN="PsyManager App"
OU="Development"
O="PsyManager"
L="Italy"
ST="Italy"
C="IT"

DNAME="CN=$CN, OU=$OU, O=$O, L=$L, ST=$ST, C=$C"

echo "=========================================="
echo "Android Release Keystore Generator"
echo "=========================================="
echo ""
echo "This will generate a release keystore for signing PsyManager APKs."
echo ""
echo "Keystore details:"
echo "  File: $KEYSTORE_FILE"
echo "  Alias: $KEYSTORE_ALIAS"
echo "  Password: $KEYSTORE_PASSWORD"
echo "  Validity: $VALIDITY_DAYS days (~30 years)"
echo ""
echo "Certificate details:"
echo "  $DNAME"
echo ""

if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  Keystore already exists at $KEYSTORE_FILE"
    read -p "Overwrite? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    rm "$KEYSTORE_FILE"
fi

echo "Generating keystore..."
keytool -genkey -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEYSTORE_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -dname "$DNAME" \
    -keypass "$KEY_PASSWORD" \
    -storepass "$KEYSTORE_PASSWORD" \
    -noprompt

echo "✓ Keystore generated."
echo ""

# Verify the keystore
keytool -list -v -keystore "$KEYSTORE_FILE" \
    -alias "$KEYSTORE_ALIAS" \
    -storepass "$KEYSTORE_PASSWORD" | grep -E "(Owner:|Valid)"

echo ""
echo "=========================================="
echo "GitHub Secrets Setup"
echo "=========================================="
echo ""
echo "1. Encode the keystore for GitHub Secrets:"
echo ""

KEYSTORE_B64=$(base64 -w0 < "$KEYSTORE_FILE")

echo "ANDROID_KEYSTORE_BASE64="
echo "$KEYSTORE_B64"
echo ""
echo "2. Add these secrets to GitHub:"
echo "   Repository → Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "Secret Name: ANDROID_KEYSTORE_BASE64"
echo "Secret Value: (paste the base64 string above)"
echo ""
echo "Secret Name: ANDROID_KEYSTORE_PASSWORD"
echo "Secret Value: $KEYSTORE_PASSWORD"
echo ""
echo "Secret Name: ANDROID_KEY_ALIAS"
echo "Secret Value: $KEYSTORE_ALIAS"
echo ""
echo "Secret Name: ANDROID_KEY_PASSWORD"
echo "Secret Value: $KEYSTORE_PASSWORD"
echo ""
echo "=========================================="
echo "⚠️  IMPORTANT"
echo "=========================================="
echo ""
echo "✓ BACKUP: Save the keystore file securely:"
echo "  cp $KEYSTORE_FILE ~/psymanager.keystore.backup"
echo ""
echo "✓ SECURITY: Never commit the keystore to git or share the password."
echo ""
echo "✓ KEEP SAFE: If you lose the keystore and password, you won't be able to"
echo "  sign future updates with the same key. Users will have to uninstall the"
echo "  old version, losing all local data."
echo ""
echo "Script complete. ✓"
