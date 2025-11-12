#!/bin/bash
# Helper script to generate Android release keystore
# Usage: ./scripts/generate-android-keystore.sh

set -e

echo "=========================================="
echo "Android Release Keystore Generator"
echo "=========================================="
echo ""
echo "This script will generate a release keystore for signing"
echo "your Android app and encode it for GitHub Secrets."
echo ""

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo "❌ Error: keytool not found. Please install Java JDK."
    exit 1
fi

# Keystore details
KEYSTORE_FILE="android-release.keystore"
KEY_ALIAS="kidcommute"
VALIDITY_DAYS=10000

echo "Keystore Configuration:"
echo "  File: $KEYSTORE_FILE"
echo "  Alias: $KEY_ALIAS"
echo "  Validity: $VALIDITY_DAYS days (~27 years)"
echo ""

# Get user information
read -p "Enter your full name: " FULL_NAME
read -p "Enter your organization (e.g., Kid Commute): " ORG_NAME
read -p "Enter your city: " CITY
read -p "Enter your state/province: " STATE
read -p "Enter your country code (e.g., US): " COUNTRY

echo ""
echo "Creating keystore..."
echo "⚠️  You will be prompted to create two passwords:"
echo "   1. Keystore password (RELEASE_STORE_PASSWORD)"
echo "   2. Key password (RELEASE_KEY_PASSWORD)"
echo "   💡 Tip: Use the same password for both to simplify"
echo ""

# Generate keystore
keytool -genkey -v -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity $VALIDITY_DAYS \
  -dname "CN=$FULL_NAME, OU=$ORG_NAME, O=$ORG_NAME, L=$CITY, ST=$STATE, C=$COUNTRY"

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to generate keystore"
    exit 1
fi

echo ""
echo "✅ Keystore created successfully!"
echo ""

# Verify keystore
echo "Verifying keystore..."
keytool -list -v -keystore "$KEYSTORE_FILE" | head -20

echo ""
echo "=========================================="
echo "📦 Encoding for GitHub Secrets"
echo "=========================================="
echo ""

# Encode keystore
echo "Encoding keystore to base64..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    base64 -i "$KEYSTORE_FILE" | pbcopy
    echo "✅ Copied to clipboard!"
    echo ""
    echo "GitHub Secret Name: RELEASE_KEYSTORE_BASE64"
    echo ""
    echo "Or copy from here:"
    base64 -i "$KEYSTORE_FILE"
else
    # Linux
    base64 -w 0 "$KEYSTORE_FILE"
    echo ""
    echo "GitHub Secret Name: RELEASE_KEYSTORE_BASE64"
fi

echo ""
echo "=========================================="
echo "✅ GitHub Secrets to Create"
echo "=========================================="
echo ""
echo "In GitHub → Settings → Secrets and variables → Actions, create:"
echo ""
echo "1. RELEASE_KEYSTORE_BASE64 (encoded value above)"
echo "2. RELEASE_STORE_PASSWORD (keystore password you just created)"
echo "3. RELEASE_KEY_ALIAS (value: $KEY_ALIAS)"
echo "4. RELEASE_KEY_PASSWORD (key password you just created)"
echo ""

# Google Play Service Account
echo "=========================================="
echo "📱 Google Play Service Account"
echo "=========================================="
echo ""
echo "To enable automatic uploads to Google Play, create a service account:"
echo ""
echo "1. Go to: https://play.google.com/console"
echo "2. Select your app (or create one)"
echo "3. Setup → API access"
echo "4. Create a new service account (or use existing)"
echo "5. Grant 'Release Manager' permissions"
echo "6. Create a JSON key"
echo "7. Copy the entire JSON content to GitHub Secret: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
echo ""

# Security reminder
echo "=========================================="
echo "⚠️  IMPORTANT SECURITY NOTES"
echo "=========================================="
echo ""
echo "1. NEVER commit $KEYSTORE_FILE to git"
echo "2. Store $KEYSTORE_FILE in a secure location (password manager, encrypted backup)"
echo "3. If you lose this keystore, you cannot update your app!"
echo "4. Keep your passwords safe - you'll need them for future releases"
echo ""
echo "✅ Backup checklist:"
echo "   [ ] Save $KEYSTORE_FILE to secure location"
echo "   [ ] Save keystore password in password manager"
echo "   [ ] Save key password in password manager"
echo "   [ ] Save alias ($KEY_ALIAS) in documentation"
echo ""

# Clean up instructions
echo "After you've:"
echo "1. Backed up the keystore file"
echo "2. Added all secrets to GitHub"
echo ""
echo "You can delete the local keystore file:"
echo "  rm $KEYSTORE_FILE"
echo ""
