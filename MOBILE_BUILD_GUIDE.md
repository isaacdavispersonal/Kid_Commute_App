# Kid Commute - Mobile App Build Guide

## 📱 Overview
Kid Commute is configured for iOS and Android using Capacitor. This guide explains how to build and deploy your mobile apps.

## 🔧 Configuration Summary

### App Identifiers
- **App ID**: `com.fleettrack.app`
- **App Name**: Kid Commute
- **Version**: 1.0
- **Build Number**: 1

### Platforms Configured
- ✅ Android (minSdk: 22, targetSdk: 34)
- ✅ iOS (iOS 13.0+)
- ✅ Splash screens and app icons configured
- ✅ Push notifications ready (Firebase Cloud Messaging)

---

## ⚠️ CRITICAL: Backend URL Configuration

**The mobile app MUST know the backend URL at build time.** This is the most common issue when the app shows "Backend URL not configured".

### Option 1: Create .env.production file (Recommended)

Create a file called `.env.production` in the project root (same folder as `package.json`):

```bash
# From your project root:
echo "VITE_API_URL=https://kid-commute.replit.app" > .env.production
```

Then build normally - Vite will automatically load this file.

### Option 2: Inline Environment Variable

Set the variable directly when building:

```bash
VITE_API_URL=https://kid-commute.replit.app npm run build
```

### Verify the URL was embedded

After building, check that the URL is in the compiled JavaScript:

```bash
grep -r "kid-commute" dist/
```

You should see the URL appear in the output. If not, the environment variable wasn't set correctly.

---

## 🚀 Building Your Apps

### Step 1: Build the Web App
First, ensure VITE_API_URL is set (see above), then build:

```bash
# Option A: Use .env.production file (create it first)
npm run build

# Option B: Set inline
VITE_API_URL=https://kid-commute.replit.app npm run build
```

This creates the production web bundle in `dist/public/`.

### Step 2: Sync with Native Platforms
Sync the web build to iOS and Android:

```bash
npx cap sync
```

This command:
- Copies web assets to native platforms
- Updates native dependencies
- Ensures Capacitor plugins are properly linked

### Alternative Commands:
```bash
# Copy web assets only (no dependency updates)
npx cap copy

# Update Capacitor and plugins
npx cap update
```

---

## 📲 Building for Android

### Prerequisites
- Android Studio installed
- Java Development Kit (JDK) 17+
- Android SDK with API Level 34

### Steps:

1. **Open in Android Studio**
   ```bash
   npx cap open android
   ```

2. **Configure Signing** (for release builds)
   - Generate a keystore file
   - Set environment variables:
     ```bash
     RELEASE_STORE_PASSWORD=your_password
     RELEASE_KEY_ALIAS=your_alias
     RELEASE_KEY_PASSWORD=your_key_password
     ```

3. **Build APK/AAB**
   - In Android Studio: `Build > Build Bundle(s) / APK(s)`
   - For release: `Build > Generate Signed Bundle / APK`

4. **Run on Device/Emulator**
   - Click the "Run" button in Android Studio
   - Or use: `npx cap run android`

### Output Files:
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 🍎 Building for iOS

### Prerequisites
- macOS with Xcode 14+
- Apple Developer account
- CocoaPods installed

### Steps:

1. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

2. **Configure Signing & Capabilities**
   - Select your project in Xcode
   - Go to "Signing & Capabilities" tab
   - Select your Team
   - Xcode will automatically manage provisioning profiles

3. **Update Bundle ID** (if needed)
   - Current: `com.fleettrack.app`
   - Change in Xcode project settings if you need a custom ID

4. **Build & Archive**
   - Select "Any iOS Device" as build target
   - `Product > Archive`
   - Use Organizer to distribute to App Store or TestFlight

5. **Run on Device/Simulator**
   - Select a device/simulator
   - Click "Run" button
   - Or use: `npx cap run ios`

---

## 🔔 Push Notifications Setup

Your app includes Firebase Cloud Messaging support.

### Required Configuration Files:

#### Android: `google-services.json`
- Download from Firebase Console
- Place in: `android/app/google-services.json`
- ⚠️ **Status**: Not yet configured

#### iOS: `GoogleService-Info.plist`
- Download from Firebase Console
- Place in: `ios/App/App/GoogleService-Info.plist`
- ⚠️ **Status**: Not yet configured

### Backend Configuration:
Set the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable with your Firebase service account credentials.

---

## 📝 Pre-Release Checklist

### Both Platforms:
- [ ] Test all core features
- [ ] Verify GPS tracking works
- [ ] Test push notifications
- [ ] Check authentication flow
- [ ] Validate offline behavior
- [ ] Test on multiple devices/OS versions
- [ ] Review app permissions

### Android Specific:
- [ ] Configure Firebase (`google-services.json`)
- [ ] Generate release keystore
- [ ] Set release signing environment variables
- [ ] Test on various Android versions (API 22-34)
- [ ] Prepare Play Store listing

### iOS Specific:
- [ ] Configure Firebase (`GoogleService-Info.plist`)
- [ ] Set up App Store Connect listing
- [ ] Configure push notification certificates
- [ ] Test on various iOS versions (13.0+)
- [ ] Prepare screenshots for App Store

---

## 🔄 Development Workflow

### Making Changes:

1. **Edit your code** (client/server files)

2. **Rebuild and sync**:
   ```bash
   npm run build
   npx cap sync
   ```

3. **Live Reload** (optional):
   - Start dev server: `npm run dev`
   - Update `capacitor.config.ts`:
     ```typescript
     server: {
       url: 'http://YOUR_LOCAL_IP:5000',
       cleartext: true
     }
     ```
   - Sync: `npx cap sync`
   - This allows testing on physical devices with hot reload

---

## 🛠️ Troubleshooting

### "Plugin not found" errors
```bash
npx cap sync
```

### Android build fails
- Check JDK version (needs 17+)
- Verify Android SDK is properly installed
- Clean build: `cd android && ./gradlew clean`

### iOS build fails
- Update CocoaPods: `cd ios/App && pod install --repo-update`
- Check Xcode version compatibility
- Verify provisioning profiles are valid

### Web assets not updating
```bash
npm run build
npx cap copy
```

---

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Publishing Guide](https://developer.android.com/studio/publish)
- [iOS App Store Guidelines](https://developer.apple.com/app-store/guidelines/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

---

## 🎯 Quick Reference Commands

```bash
# Build web app
npm run build

# Sync to native platforms
npx cap sync

# Copy web assets only
npx cap copy

# Update Capacitor
npx cap update

# Open in IDE
npx cap open android
npx cap open ios

# Run on device
npx cap run android
npx cap run ios
```

---

## ✅ Current Status

- ✅ Capacitor configured (v7.4.4)
- ✅ Android project ready
- ✅ iOS project ready
- ✅ App icons and splash screens configured
- ✅ Push notification infrastructure ready
- ⚠️ Firebase config files need to be added
- ⚠️ Release signing needs configuration

**Next Steps**: Add Firebase configuration files and test on physical devices!
