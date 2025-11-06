# FleetTrack Mobile Deployment Guide

This guide explains how to build and deploy FleetTrack to the iOS App Store and Google Play Store using Capacitor.

## ✅ Setup Complete

Your FleetTrack app has been successfully configured for mobile deployment with:
- **Capacitor Core**: Installed and initialized
- **iOS Platform**: Native Xcode project created in `/ios`
- **Android Platform**: Native Android Studio project created in `/android`
- **Essential Plugins**: App, Splash Screen, and Status Bar
- **App Configuration**:
  - App ID: `com.fleettrack.app`
  - App Name: `FleetTrack`
  - Web Directory: `dist/public`

## 📋 Prerequisites

Before you can deploy to the app stores, you'll need:

### For iOS (App Store)
- **macOS Computer**: Required by Apple for iOS development
- **Xcode**: Install from Mac App Store (free)
- **Apple Developer Account**: $99/year
  - Sign up at [developer.apple.com](https://developer.apple.com)
  - Provides TestFlight, App Store submission, and signing certificates

### For Android (Google Play)
- **Any Computer**: Windows, Mac, or Linux
- **Android Studio**: Download from [developer.android.com](https://developer.android.com/studio)
- **Google Play Console Account**: $25 one-time fee
  - Sign up at [play.google.com/console](https://play.google.com/console)

## 🚀 Development Workflow

Whenever you make changes to your React app, follow these steps:

### 1. Build Your Web App
```bash
npm run build
```

### 2. Sync Changes to Native Projects
```bash
npx cap sync
```
This copies your web assets and updates native plugins.

### 3. Open Native Projects

**For iOS:**
```bash
npx cap open ios
```
Opens the project in Xcode (macOS only)

**For Android:**
```bash
npx cap open android
```
Opens the project in Android Studio

## 📱 iOS Deployment (App Store)

### Step 1: Configure Your App in Xcode

1. **Open the iOS project:**
   ```bash
   npx cap open ios
   ```

2. **In Xcode, configure:**
   - **Bundle Identifier**: Set to `com.fleettrack.app` (or your custom domain)
   - **Team**: Select your Apple Developer account
   - **Display Name**: FleetTrack
   - **Version**: Start with 1.0.0
   - **Build Number**: Start with 1

3. **Add App Icons:**
   - Create 1024x1024 px app icon
   - Add to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
   - Xcode will generate all required sizes

4. **Configure Signing:**
   - Select your team in "Signing & Capabilities"
   - Enable "Automatically manage signing"

### Step 2: Build and Archive

1. **Select Device:**
   - Choose "Any iOS Device (arm64)" from device dropdown

2. **Archive:**
   - Menu: Product → Archive
   - Wait for build to complete (5-15 minutes first time)

3. **Validate Archive:**
   - In Organizer window, click "Validate App"
   - Fix any errors before proceeding

### Step 3: Submit to App Store Connect

1. **Create App in App Store Connect:**
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Click "My Apps" → "+" → "New App"
   - Fill in app details:
     - Name: FleetTrack
     - Primary Language: English
     - Bundle ID: com.fleettrack.app
     - SKU: com.fleettrack.app.001

2. **Upload Build:**
   - In Xcode Organizer, click "Distribute App"
   - Choose "App Store Connect"
   - Follow prompts to upload

3. **Complete App Information:**
   - Screenshots (required for various device sizes)
   - App description
   - Keywords
   - Privacy policy URL
   - Age rating
   - App category

4. **Submit for Review:**
   - Add uploaded build to app version
   - Submit for review
   - Review typically takes 1-7 days

### Step 4: TestFlight (Optional Beta Testing)

Before public release, you can test with TestFlight:
- Uploaded builds automatically appear in TestFlight
- Invite testers via email
- Get feedback before App Store release

## 🤖 Android Deployment (Google Play)

### Step 1: Configure Your App in Android Studio

1. **Open the Android project:**
   ```bash
   npx cap open android
   ```

2. **Update App Details:**
   - Open `android/app/build.gradle`
   - Update:
     ```gradle
     defaultConfig {
         applicationId "com.fleettrack.app"
         minSdkVersion 22
         targetSdkVersion 34
         versionCode 1
         versionName "1.0.0"
     }
     ```

3. **Add App Icon:**
   - Create launcher icons (various sizes)
   - Place in `android/app/src/main/res/mipmap-*/`
   - Or use Android Studio's Image Asset tool:
     - Right-click `res` → New → Image Asset
     - Upload 512x512 icon
     - Generate all sizes

### Step 2: Generate Signing Key

Android apps must be signed. Create a keystore:

```bash
keytool -genkeypair -v -keystore fleettrack-release.keystore \
  -alias fleettrack -keyalg RSA -keysize 2048 -validity 10000
```

**Save this information securely:**
- Keystore password
- Key alias: fleettrack
- Key password
- Store the `.keystore` file safely (you'll need it for all future updates)

### Step 3: Configure Signing in Android Studio

1. **Add Keystore to Project:**
   - Place `fleettrack-release.keystore` in `android/app/`

2. **Configure Signing:**
   - Edit `android/app/build.gradle`
   - Add signing config (OR use Android Studio UI: Build → Generate Signed Bundle)

### Step 4: Build Release AAB

1. **In Android Studio:**
   - Menu: Build → Generate Signed Bundle / APK
   - Choose "Android App Bundle" (AAB)
   - Select your keystore
   - Enter passwords
   - Build type: Release
   - Click "Finish"

2. **Locate Build:**
   - File will be at: `android/app/release/app-release.aab`

### Step 5: Upload to Google Play Console

1. **Create App in Google Play Console:**
   - Go to [play.google.com/console](https://play.google.com/console)
   - Click "Create app"
   - Fill in details:
     - App name: FleetTrack
     - Default language: English
     - App or game: App
     - Free or paid: Choose based on your model

2. **Complete Store Listing:**
   - Short description (80 characters)
   - Full description (4000 characters)
   - App icon: 512x512 px
   - Feature graphic: 1024x500 px
   - Screenshots (minimum 2, various device sizes)
   - Privacy policy URL
   - App category: Transportation or Business

3. **Complete Content Rating:**
   - Answer questionnaire about app content
   - Receive rating (e.g., Everyone, Teen, etc.)

4. **Upload AAB:**
   - Navigate to "Production" or "Internal testing"
   - Create new release
   - Upload `app-release.aab` file
   - Add release notes
   - Review and roll out

5. **Submit for Review:**
   - Google Play review typically takes a few hours to 2 days
   - Much faster than iOS

## 🔄 Updating Your App

When you make changes to FleetTrack:

### Update Process
```bash
# 1. Make your code changes in React app
npm run build

# 2. Sync to native projects
npx cap sync

# 3. Open native projects and rebuild
npx cap open ios      # For iOS
npx cap open android  # For Android
```

### Version Numbers
- **iOS**: Increment build number for each submission
  - Version: 1.0.0, 1.1.0, 2.0.0 (semantic versioning)
  - Build: 1, 2, 3, 4 (sequential)

- **Android**: Increment both:
  - versionCode: 1, 2, 3, 4 (integer, must increase)
  - versionName: "1.0.0", "1.1.0", "2.0.0" (user-facing)

## 🎨 Required Assets

Create the following assets for your app stores:

### App Icons
- **iOS**: 1024x1024 px PNG (no transparency)
- **Android**: 512x512 px PNG

### Screenshots (Both Platforms)
- iPhone screenshots (various sizes: 6.5", 5.5")
- iPad screenshots (12.9", 11")
- Android phone screenshots
- Android tablet screenshots (optional but recommended)

**Tip**: Use your browser's device emulation or real devices to capture screenshots

### Store Graphics
- **Android Feature Graphic**: 1024x500 px
- **Privacy Policy**: Required by both stores (hosted on your website)

## 📝 App Store Metadata Checklist

### Both Stores Need:
- [ ] App name (30 characters)
- [ ] Short description
- [ ] Full description
- [ ] App icon
- [ ] Screenshots
- [ ] Privacy policy URL
- [ ] Contact email
- [ ] Support URL
- [ ] App category
- [ ] Age/content rating

### iOS Specific:
- [ ] Keywords (100 characters, comma-separated)
- [ ] Promotional text (170 characters)
- [ ] Copyright information

### Android Specific:
- [ ] Feature graphic
- [ ] Promo video URL (optional)
- [ ] Target audience and content

## 🔧 Common Issues & Solutions

### iOS Issues

**"No valid code signing identity found"**
- Solution: Add your Apple Developer account in Xcode Preferences → Accounts
- Solution: Select your team in project signing settings

**"App Store submission failed"**
- Check App Store Connect for specific errors
- Common: Missing privacy descriptions in Info.plist
- Solution: Add required permission descriptions

**"TestFlight build processing stuck"**
- Wait 5-15 minutes
- Check email for processing errors
- Verify app doesn't violate guidelines

### Android Issues

**"Keystore not found"**
- Ensure keystore file is in correct location
- Check path in `build.gradle`

**"App not compatible with any devices"**
- Check `minSdkVersion` (should be 22 or higher)
- Verify target API level (should be 33+)

**"Upload failed - Version code must be unique"**
- Increment `versionCode` in `build.gradle`

## 🌐 Backend Configuration for Production

**⚠️ CRITICAL: This step is required for mobile apps to work!**

FleetTrack uses WebSocket and backend APIs. Mobile apps need to connect to your deployed backend server.

### Step 1: Deploy Your Backend

First, deploy FleetTrack to production using Replit's deployment:
1. Click "Deploy" in your Replit project
2. Note your production URL (e.g., `https://your-app-name.replit.app`)

### Step 2: Configure API URL for Mobile

**Before building your mobile app**, you MUST configure the production API URL:

1. **Set the VITE_API_URL environment variable:**
   
   Create or edit `.env` file in your project root:
   ```bash
   VITE_API_URL=https://your-app-name.replit.app
   ```
   
   Replace `https://your-app-name.replit.app` with your actual production URL.

2. **Verify the configuration:**
   
   The mobile app automatically detects when running natively and uses `VITE_API_URL` for all API calls and WebSocket connections. The configuration is in `client/src/lib/config.ts`.

3. **Rebuild after configuration:**
   ```bash
   npm run build
   npx cap sync
   ```

**How it works:**
- **Web version**: Uses relative URLs (proxied by Vite in dev, same origin in production)
- **Mobile app**: Uses absolute URL from `VITE_API_URL` to connect to your deployed backend

### Important Requirements

1. **HTTPS is required** - App stores reject apps without HTTPS
2. **WebSocket connections** automatically use `wss://` (secure WebSocket) in production
3. **CORS must be configured** - Already set up in your Express server

### CORS Configuration

Your Express backend should allow mobile app origins:
```javascript
// Already configured in your server, but verify:
app.use(cors({
  origin: '*', // Or specify your domains
  credentials: true
}));
```

### Session Cookies

Mobile apps may need adjustments to cookie/session handling:
- Use secure cookies (`secure: true`)
- Set proper SameSite policies
- Consider token-based auth for better mobile support

## 📚 Additional Resources

### Official Documentation
- **Capacitor**: [capacitorjs.com/docs](https://capacitorjs.com/docs)
- **iOS Human Interface Guidelines**: [developer.apple.com/design](https://developer.apple.com/design)
- **Android Design Guidelines**: [material.io](https://material.io)

### App Store Guidelines
- **Apple App Store Review**: [developer.apple.com/app-store/review](https://developer.apple.com/app-store/review)
- **Google Play Policy**: [play.google.com/about/developer-content-policy](https://play.google.com/about/developer-content-policy)

### Helpful Tools
- **App Icon Generator**: [appicon.co](https://appicon.co)
- **Screenshot Design**: [screenshots.pro](https://screenshots.pro)
- **Privacy Policy Generator**: [privacypolicies.com](https://privacypolicies.com)

## 🎯 Next Steps

1. **Download Your Code**: Clone this Replit project to your local machine
2. **Install Native IDEs**: Xcode (Mac) and/or Android Studio
3. **Create Developer Accounts**: Apple Developer and/or Google Play Console
4. **Create App Assets**: Icons, screenshots, descriptions
5. **Build and Test**: Use native IDEs to build and test
6. **Submit to Stores**: Follow the deployment steps above
7. **Monitor Reviews**: Respond to user feedback and update regularly

---

**Questions?** Check the Capacitor community forum at [forum.ionicframework.com](https://forum.ionicframework.com) or file issues on GitHub.

**Good luck with your app launch! 🚀**
