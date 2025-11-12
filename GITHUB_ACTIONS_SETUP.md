# GitHub Actions CI/CD Setup Guide
## Automated Deployment for Kid Commute iOS & Android Apps

This guide will help you set up automated builds and deployments to the App Store and Google Play using GitHub Actions.

---

## 📋 Overview

Once configured, your deployment workflow will be:
1. **Push code to GitHub** (main branch or create a version tag like `v1.0.1`)
2. **GitHub Actions automatically builds** both iOS and Android apps
3. **iOS app uploaded to TestFlight** for testing
4. **Android app uploaded to Google Play Internal Testing**
5. **Promote to production** when ready via App Store Connect / Google Play Console

**Costs:**
- GitHub Actions is **free for public repos**
- For private repos: 2,000 free minutes/month, then ~$1 per iOS build, ~$0.02 per Android build

---

## 🎯 Prerequisites

### Required Accounts
1. **GitHub account** (free) - where your code will live
2. **Apple Developer Program** ($99/year) - required for App Store
3. **Google Play Console** ($25 one-time) - required for Google Play
4. **Access to a Mac** (one-time setup only) - to generate iOS certificates

### Software Requirements (for initial setup)
- **macOS** with Xcode installed (for iOS certificate generation)
- **Java JDK** (for Android keystore generation)
- **Git** installed locally

---

## 🚀 Step-by-Step Setup

### Phase 1: Push Your Code to GitHub

1. **Create a GitHub repository:**
   ```bash
   # From your Replit project, or locally
   git init
   git add .
   git commit -m "Initial commit - Kid Commute app"
   ```

2. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Name it `kid-commute` (or your preferred name)
   - Make it private if you prefer
   - Don't initialize with README (you already have code)

3. **Push your code:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/kid-commute.git
   git branch -M main
   git push -u origin main
   ```

---

### Phase 2: iOS Setup

#### 2.1. Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Kid Commute
   - **Primary Language:** English
   - **Bundle ID:** `com.fleettrack.app` (must match your app)
   - **SKU:** kidcommute (or any unique identifier)
4. Click **Create**

#### 2.2. Generate Distribution Certificate

**On your Mac:**

1. Open **Keychain Access**
2. Menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Fill in:
   - Email address: your-email@example.com
   - Common Name: Your Name
   - Select: **Saved to disk**
4. Click **Continue** and save the `.certSigningRequest` file

5. Go to https://developer.apple.com/account/resources/certificates/list
6. Click **+** to create new certificate
7. Select **Apple Distribution** (for App Store)
8. Upload your `.certSigningRequest` file
9. Download the certificate (`.cer` file)

10. **Double-click the `.cer` file** to install it in Keychain Access

#### 2.3. Export Certificate as .p12

1. In **Keychain Access**, select **login** keychain
2. Select **My Certificates** category
3. Find your **Apple Distribution** certificate
4. Right-click → **Export "Apple Distribution..."**
5. Save as: `distribution.p12`
6. **Enter a password** (save this password - you'll need it for GitHub Secrets)

#### 2.4. Create Provisioning Profile

1. Go to https://developer.apple.com/account/resources/profiles/list
2. Click **+** to create new profile
3. Select **App Store** under Distribution
4. Select your App ID: `com.fleettrack.app`
5. Select the **Distribution certificate** you just created
6. Name it: `Kid Commute App Store`
7. **Download** the `.mobileprovision` file

#### 2.5. Create App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/api
2. Click **+** to generate a new key
3. Name: `GitHub Actions`
4. Access: **Developer** (or Admin if you have it)
5. Click **Generate**
6. **Download the .p8 file** (only shown once - save it securely!)
7. **Note the Key ID and Issuer ID** (shown on the page)

#### 2.6. Encode iOS Files for GitHub Secrets

Run the helper script (requires macOS):

```bash
./scripts/encode-certificates.sh
```

Follow the prompts to encode your:
- Distribution certificate (.p12)
- Provisioning profile (.mobileprovision)
- API key (.p8)

The script will copy encoded values to your clipboard.

#### 2.7. Create iOS GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Create these 8 secrets:

| Secret Name | Value | How to Get |
|-------------|-------|-----------|
| `BUILD_CERTIFICATE_BASE64` | Base64-encoded .p12 file | From encode-certificates.sh script |
| `P12_PASSWORD` | Password for .p12 | Password you set when exporting |
| `BUILD_PROVISION_PROFILE_BASE64` | Base64-encoded .mobileprovision | From encode-certificates.sh script |
| `KEYCHAIN_PASSWORD` | Any random password | Generate: `openssl rand -base64 32` |
| `APPLE_KEY_ID` | Key ID from App Store Connect | From API key page |
| `APPLE_ISSUER_ID` | Issuer ID from App Store Connect | From API key page |
| `APPLE_KEY_CONTENT` | Content of .p8 file | From encode-certificates.sh script |
| `BUNDLE_IDENTIFIER` | `com.fleettrack.app` | Your app's bundle ID |

---

### Phase 3: Android Setup

#### 3.1. Create App in Google Play Console

1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - **App name:** Kid Commute
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
4. Accept declarations and click **Create app**

#### 3.2. Generate Android Keystore

Run the helper script:

```bash
./scripts/generate-android-keystore.sh
```

Follow the prompts to create a release keystore. **Important:**
- Save the keystore password securely
- Save the key password securely
- Backup the `.keystore` file securely (if you lose it, you can't update your app!)

The script will encode the keystore to base64.

#### 3.3. Enable Google Play App Signing

1. In Google Play Console, go to **Setup** → **App signing**
2. Click **Use Google Play App Signing**
3. Follow the prompts to enable it
4. You'll upload your app bundle (AAB) later - Google will manage the final signing

#### 3.4. Create Google Play Service Account

1. In Google Play Console, go to **Setup** → **API access**
2. Link to Google Cloud Project (or create new one)
3. Click **Create new service account**
4. In Google Cloud Console:
   - Click **Create Service Account**
   - Name: `GitHub Actions`
   - Click **Create and Continue**
   - Skip granting roles (we'll do this in Play Console)
   - Click **Done**
5. Back in Play Console:
   - Find your new service account
   - Click **Grant access**
   - Select **Release Manager** role
   - Invite user
6. In Google Cloud Console:
   - Find your service account
   - Click **Keys** tab
   - **Add Key** → **Create new key**
   - Select **JSON**
   - Download the JSON file (save it securely!)

#### 3.5. Create Android GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

Create these 4 secrets:

| Secret Name | Value | How to Get |
|-------------|-------|-----------|
| `RELEASE_KEYSTORE_BASE64` | Base64-encoded keystore | From generate-android-keystore.sh |
| `RELEASE_STORE_PASSWORD` | Keystore password | Password you set during generation |
| `RELEASE_KEY_ALIAS` | `kidcommute` | Default from script |
| `RELEASE_KEY_PASSWORD` | Key password | Password you set during generation |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Full JSON content | Content of downloaded JSON file |

---

### Phase 4: Firebase Setup (for Push Notifications)

1. Go to https://console.firebase.google.com
2. Create a new project (or select existing one)
3. Add iOS app:
   - Bundle ID: `com.fleettrack.app`
   - Download `GoogleService-Info.plist`
   - Place in `ios/App/App/` directory
4. Add Android app:
   - Package name: `com.fleettrack.app`
   - Download `google-services.json`
   - Place in `android/app/` directory
5. Enable Cloud Messaging
6. For iOS: Upload APNs key to Firebase (Settings → Cloud Messaging)

**Add google-services.json as GitHub Secret** (optional, for security):

Create secret:
- Name: `GOOGLE_SERVICES_JSON`
- Value: Content of `google-services.json`

---

## ✅ Testing Your Setup

### Test iOS Build

1. **Commit and push** any changes:
   ```bash
   git add .
   git commit -m "Add GitHub Actions workflows"
   git push
   ```

2. **Go to GitHub** → **Actions** tab
3. You should see **Build & Deploy iOS** workflow running
4. Click on the workflow to see progress
5. It will take 10-15 minutes for the first build

### Test Android Build

1. Same as iOS - the **Build & Deploy Android** workflow will run automatically
2. Android builds are faster (3-5 minutes)

### Check Results

**iOS:**
- Go to https://appstoreconnect.apple.com
- **TestFlight** → **iOS** → You should see a new build
- Add internal testers and distribute

**Android:**
- Go to https://play.google.com/console
- **Testing** → **Internal testing** → You should see a new release
- Create a testing track and invite testers

---

## 🔄 Regular Deployment Workflow

Once setup is complete, your workflow is simple:

### Option 1: Push to Main (Continuous Deployment)
```bash
git add .
git commit -m "Fix bug in parent dashboard"
git push
```
→ Automatically builds and uploads to TestFlight/Play Internal Testing

### Option 2: Tagged Releases (Recommended)
```bash
# Update version in Info.plist and build.gradle first!
git tag v1.0.1
git push origin v1.0.1
```
→ Builds and uploads with proper version tagging

---

## 📱 Version Management

**Before each release, update version numbers:**

### iOS
Edit `ios/App/App/Info.plist`:
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.1</string>  <!-- User-facing version -->
<key>CFBundleVersion</key>
<string>2</string>  <!-- Build number - increment each build -->
```

### Android
Edit `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 2           // Integer - increment each build
    versionName "1.0.1"    // String - user-facing version
}
```

**Pro tip:** Automate this with a script or Fastlane action

---

## 🐛 Troubleshooting

### iOS Build Fails: "No signing identity found"

**Cause:** Certificate or provisioning profile issue

**Fix:**
1. Verify certificate is still valid in Apple Developer account
2. Re-export and re-encode certificate
3. Verify `BUNDLE_IDENTIFIER` secret matches your app exactly
4. Check provisioning profile includes the distribution certificate

### iOS Build Fails: "Code signing error"

**Cause:** Provisioning profile doesn't match bundle ID

**Fix:**
1. Re-download provisioning profile for exact bundle ID
2. Re-encode and update `BUILD_PROVISION_PROFILE_BASE64` secret

### Android Build Fails: "Keystore password incorrect"

**Cause:** Wrong password in secrets

**Fix:**
1. Verify `RELEASE_STORE_PASSWORD` matches what you used during generation
2. Verify `RELEASE_KEY_PASSWORD` matches the alias password

### Upload to Google Play Fails: "Service account not authorized"

**Cause:** Service account doesn't have proper permissions

**Fix:**
1. In Play Console → API access
2. Find service account
3. Verify it has "Release Manager" role
4. May need to wait 24 hours for permissions to propagate

### Build Takes Too Long / Costs Too Much

**Solutions:**
1. Only run on specific branches: Change `branches: [main]` to `branches: [release]`
2. Only run on tags: Remove `push:` trigger, keep only `tags: ['v*']`
3. Separate iOS and Android: Trigger manually via `workflow_dispatch`

---

## 💰 Cost Management

### Free Tier
- Public repos: **Unlimited** GitHub Actions minutes
- Private repos: **2,000** free minutes/month

### Typical Costs (Private Repos)
- iOS build: 10-15 min on macOS = ~$0.80-$1.20 per build
- Android build: 3-5 min on Linux = ~$0.02-$0.04 per build

### Cost Saving Tips
1. **Use manual triggers** instead of automatic on every push
2. **Only build on tags** for production releases
3. **Make your repo public** if you're comfortable (unlimited free)
4. **Test locally** before pushing to GitHub

---

## 📚 Next Steps

1. **Complete App Store listing:** Screenshots, description, privacy policy
2. **Complete Google Play listing:** Screenshots, description, data safety form
3. **Internal testing:** Invite team members to TestFlight/Play Internal Testing
4. **Beta testing:** Expand to external testers
5. **Production release:** Submit for review when ready

---

## 🔐 Security Best Practices

1. **Never commit** signing files to Git (`.p12`, `.keystore`, `.mobileprovision`)
2. **Use GitHub Secrets** for all sensitive data (already configured)
3. **Backup your keystore** - if you lose it, you can't update your Android app!
4. **Backup your certificates** - store in password manager or secure location
5. **Rotate API keys** periodically (App Store Connect API, Play Service Account)
6. **Use branch protection** - require reviews before merging to main

---

## 📞 Support

**GitHub Actions Documentation:**
- https://docs.github.com/en/actions

**Capacitor CI/CD Guide:**
- https://capacitorjs.com/docs/guides/ci-cd

**Fastlane Documentation:**
- https://docs.fastlane.tools

**Apple Developer:**
- https://developer.apple.com/support

**Google Play Support:**
- https://support.google.com/googleplay/android-developer

---

## ✨ You're All Set!

Your Kid Commute app now has a professional CI/CD pipeline. Every push to GitHub will automatically build and deploy to both app stores, saving you hours of manual work.

Happy shipping! 🚀
