#!/bin/bash
# Helper script to encode iOS certificates and provisioning profiles for GitHub Secrets
# Usage: ./scripts/encode-certificates.sh

set -e

echo "=========================================="
echo "iOS Certificate & Profile Encoder"
echo "=========================================="
echo ""
echo "This script will help you encode your iOS signing files"
echo "for use as GitHub Secrets."
echo ""

# Function to encode a file
encode_file() {
    local file_path=$1
    local secret_name=$2
    
    if [ ! -f "$file_path" ]; then
        echo "❌ Error: File not found: $file_path"
        return 1
    fi
    
    echo ""
    echo "📦 Encoding: $file_path"
    echo "📋 GitHub Secret Name: $secret_name"
    echo ""
    echo "Encoded value (copy this to GitHub Secrets):"
    echo "----------------------------------------"
    base64 -i "$file_path" | pbcopy
    echo "✅ Copied to clipboard!"
    echo ""
    echo "Or copy from here:"
    base64 -i "$file_path"
    echo "----------------------------------------"
    echo ""
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: This script is designed for macOS."
    echo "On Linux, use 'base64 -w 0' instead of 'base64 -i'"
fi

# Certificate
echo "Step 1: Distribution Certificate (.p12)"
echo "----------------------------------------"
echo "First, export your Distribution Certificate from Keychain Access:"
echo "1. Open Keychain Access"
echo "2. Select 'login' keychain and 'My Certificates'"
echo "3. Find your 'Apple Distribution' or 'iOS Distribution' certificate"
echo "4. Right-click → Export → Save as .p12 file"
echo "5. Enter a password (you'll need this for P12_PASSWORD secret)"
echo ""
read -p "Enter path to your .p12 file (or press Enter to skip): " p12_path

if [ -n "$p12_path" ]; then
    encode_file "$p12_path" "BUILD_CERTIFICATE_BASE64"
    echo "⚠️  Remember to set P12_PASSWORD secret to the password you used!"
fi

# Provisioning Profile
echo ""
echo "Step 2: Provisioning Profile (.mobileprovision)"
echo "----------------------------------------"
echo "Download your App Store provisioning profile from:"
echo "https://developer.apple.com/account/resources/profiles/list"
echo "1. Find your App Store profile for com.fleettrack.app"
echo "2. Download it"
echo ""
read -p "Enter path to your .mobileprovision file (or press Enter to skip): " profile_path

if [ -n "$profile_path" ]; then
    encode_file "$profile_path" "BUILD_PROVISION_PROFILE_BASE64"
fi

# App Store Connect API Key
echo ""
echo "Step 3: App Store Connect API Key (.p8)"
echo "----------------------------------------"
echo "Create an API key at:"
echo "https://appstoreconnect.apple.com/access/api"
echo "1. Click '+' to create a new key"
echo "2. Name it 'GitHub Actions'"
echo "3. Role: 'Developer' or 'Admin'"
echo "4. Download the .p8 file (only shown once!)"
echo "5. Note the Key ID and Issuer ID"
echo ""
read -p "Enter path to your .p8 file (or press Enter to skip): " p8_path

if [ -n "$p8_path" ]; then
    echo ""
    echo "📦 Encoding: $p8_path"
    echo "📋 GitHub Secret Name: APPLE_KEY_CONTENT"
    echo ""
    echo "Encoded value (copy this to GitHub Secrets):"
    echo "----------------------------------------"
    cat "$p8_path" | pbcopy
    echo "✅ Copied to clipboard!"
    echo ""
    echo "Or copy from here:"
    cat "$p8_path"
    echo "----------------------------------------"
    echo ""
    echo "⚠️  Also set these secrets:"
    echo "   APPLE_KEY_ID: (the key ID from App Store Connect)"
    echo "   APPLE_ISSUER_ID: (the issuer ID from App Store Connect)"
fi

# Summary
echo ""
echo "=========================================="
echo "✅ Summary of GitHub Secrets to Create"
echo "=========================================="
echo ""
echo "In GitHub → Settings → Secrets and variables → Actions, create:"
echo ""
echo "1. BUILD_CERTIFICATE_BASE64 (from .p12 file above)"
echo "2. P12_PASSWORD (password you used when exporting .p12)"
echo "3. BUILD_PROVISION_PROFILE_BASE64 (from .mobileprovision file above)"
echo "4. KEYCHAIN_PASSWORD (any random secure password, e.g., openssl rand -base64 32)"
echo "5. APPLE_KEY_ID (from App Store Connect API key)"
echo "6. APPLE_ISSUER_ID (from App Store Connect API key)"
echo "7. APPLE_KEY_CONTENT (content of .p8 file above)"
echo "8. BUNDLE_IDENTIFIER (should be: com.fleettrack.app)"
echo ""
echo "Next, run: ./scripts/generate-android-keystore.sh"
echo ""
