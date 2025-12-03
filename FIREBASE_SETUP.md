# Firebase Push Notifications Setup Guide

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the Kid Commute mobile app.

## Overview

Push notifications allow the app to send real-time alerts to parents and drivers, including:
- Student pickup/dropoff notifications
- Route delay alerts
- Driver messages
- Emergency announcements

## Prerequisites

1. A Google account
2. Access to [Firebase Console](https://console.firebase.google.com/)
3. iOS Developer account (for iOS app)
4. Android Studio installed (for Android app)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: "Kid Commute" (or your preferred name)
4. Enable Google Analytics if desired
5. Click "Create project"

## Step 2: Add Android App

1. In Firebase Console, click the Android icon to add an Android app
2. Enter the Android package name: `com.fleettrack.app`
3. Enter app nickname: "Kid Commute Android"
4. Click "Register app"
5. Download `google-services.json`
6. Place the file in: `android/app/google-services.json`

## Step 3: Add iOS App

1. In Firebase Console, click the iOS icon to add an iOS app
2. Enter the iOS bundle ID: `com.fleettrack.app`
3. Enter app nickname: "Kid Commute iOS"
4. Click "Register app"
5. Download `GoogleService-Info.plist`
6. Place the file in: `ios/App/App/GoogleService-Info.plist`

## Step 4: Generate Service Account Key

The backend needs a service account key to send push notifications:

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. Copy the entire contents of the JSON file
6. Set it as an environment variable in Replit:
   - Go to Secrets tab
   - Add key: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Paste the JSON content as the value

## Step 5: Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings**
2. Click **Cloud Messaging** tab
3. Note your Server Key (for reference)

## Step 6: Configure iOS for Push Notifications

### APNs Configuration

1. Create an APNs Key in [Apple Developer Console](https://developer.apple.com/):
   - Go to Certificates, Identifiers & Profiles
   - Click Keys → + (Create a key)
   - Check "Apple Push Notifications service (APNs)"
   - Download the .p8 file

2. Upload APNs Key to Firebase:
   - In Firebase Console → Project Settings → Cloud Messaging
   - Under "Apple app configuration", click Upload
   - Upload the .p8 file
   - Enter Key ID and Team ID

### Xcode Configuration

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the App target
3. Go to Signing & Capabilities
4. Click "+ Capability"
5. Add "Push Notifications"
6. Add "Background Modes" and enable:
   - Background fetch
   - Remote notifications

## Step 7: Build and Test

### Android
```bash
npm run build
npx cap sync android
# Open in Android Studio and run on device
```

### iOS
```bash
npm run build
npx cap sync ios
# Open in Xcode and run on device
```

## File Locations Summary

| File | Location | Source |
|------|----------|--------|
| `google-services.json` | `android/app/google-services.json` | Firebase Console → Android app |
| `GoogleService-Info.plist` | `ios/App/App/GoogleService-Info.plist` | Firebase Console → iOS app |
| Service Account JSON | Replit Secrets → `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Service Accounts |

## Troubleshooting

### "Push notifications disabled" warning
- Ensure `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable is set correctly
- Check that the JSON is valid and contains all required fields

### Android: "Failed to get FCM token"
- Verify `google-services.json` is in the correct location
- Check that the package name matches exactly

### iOS: No push notifications received
- Ensure APNs key is uploaded to Firebase
- Verify Push Notifications capability is added in Xcode
- Test on a real device (simulators don't support push)

## Security Notes

- Never commit Firebase config files to public repositories
- Keep `FIREBASE_SERVICE_ACCOUNT_JSON` secret
- Use `.gitignore` to exclude sensitive files (already configured)

## Related Files

- Backend service: `server/push-notification-service.ts`
- Device token API: `server/routes.ts` (POST/DELETE `/api/push-tokens`)
- Token storage: `shared/schema.ts` (`deviceTokens` table)
