# Kid Commute Mobile App Deployment Checklist

Quick reference guide for deploying iOS and Android apps via GitHub Actions.

---

## 🎯 Pre-Deployment Setup (One-Time)

### GitHub Repository
- [ ] Code pushed to GitHub repository
- [ ] Repository is private or public (affects GitHub Actions cost)

### Apple Developer Account ($99/year)
- [ ] Account created and active
- [ ] Developer team ID noted
- [ ] App created in App Store Connect
- [ ] Bundle ID: `com.fleettrack.app`

### Google Play Console ($25 one-time)
- [ ] Account created and verified
- [ ] App created in Play Console
- [ ] Package name: `com.fleettrack.app`
- [ ] Google Play App Signing enabled

---

## 🔐 iOS Signing Setup

### Certificates & Profiles
- [ ] Distribution certificate created (.cer)
- [ ] Certificate exported as .p12 with password
- [ ] App Store provisioning profile downloaded (.mobileprovision)
- [ ] App Store Connect API Key created (.p8)
- [ ] Key ID and Issuer ID noted

### GitHub Secrets (iOS - 8 total)
- [ ] `BUILD_CERTIFICATE_BASE64` - Base64 of .p12 file
- [ ] `P12_PASSWORD` - Password used for .p12 export
- [ ] `BUILD_PROVISION_PROFILE_BASE64` - Base64 of .mobileprovision
- [ ] `KEYCHAIN_PASSWORD` - Random password (generate new)
- [ ] `APPLE_KEY_ID` - From App Store Connect API
- [ ] `APPLE_ISSUER_ID` - From App Store Connect API
- [ ] `APPLE_KEY_CONTENT` - Content of .p8 file
- [ ] `BUNDLE_IDENTIFIER` - `com.fleettrack.app`

**Helper:** Run `./scripts/encode-certificates.sh`

---

## 🔐 Android Signing Setup

### Keystore
- [ ] Release keystore generated (.keystore file)
- [ ] Keystore password saved securely
- [ ] Key alias: `kidcommute`
- [ ] Key password saved securely
- [ ] **Keystore backed up** (CRITICAL - can't update app without it!)

### Google Play Service Account
- [ ] Service account created in Google Cloud
- [ ] Service account granted "Release Manager" role in Play Console
- [ ] JSON key downloaded from Google Cloud

### GitHub Secrets (Android - 5 total)
- [ ] `RELEASE_KEYSTORE_BASE64` - Base64 of keystore file
- [ ] `RELEASE_STORE_PASSWORD` - Keystore password
- [ ] `RELEASE_KEY_ALIAS` - `kidcommute`
- [ ] `RELEASE_KEY_PASSWORD` - Key password
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` - Full JSON content

**Helper:** Run `./scripts/generate-android-keystore.sh`

---

## 📱 Firebase Setup (Push Notifications)

### Firebase Project
- [ ] Firebase project created
- [ ] iOS app added with bundle ID: `com.fleettrack.app`
- [ ] `GoogleService-Info.plist` downloaded
- [ ] Android app added with package: `com.fleettrack.app`
- [ ] `google-services.json` downloaded

### Firebase Configuration
- [ ] Cloud Messaging enabled
- [ ] APNs authentication key uploaded (iOS)
- [ ] `GoogleService-Info.plist` placed in `ios/App/App/`
- [ ] `google-services.json` placed in `android/app/`

### Backend Configuration
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` secret added to Replit/production backend
- [ ] Push notification service tested

---

## 🚀 First Deployment

### Pre-Flight Checks
- [ ] Version numbers updated:
  - [ ] iOS: `ios/App/App/Info.plist` (CFBundleShortVersionString & CFBundleVersion)
  - [ ] Android: `android/app/build.gradle` (versionCode & versionName)
- [ ] All GitHub Secrets verified (13 total: 8 iOS + 5 Android)
- [ ] `.gitignore` updated (no secrets committed)
- [ ] Workflow files present:
  - [ ] `.github/workflows/build-ios.yml`
  - [ ] `.github/workflows/build-android.yml`
- [ ] Fastlane configured: `ios/App/fastlane/Fastfile`

### Trigger Build
- [ ] Code committed to main branch, OR
- [ ] Version tag pushed (recommended): `git tag v1.0.0 && git push origin v1.0.0`

### Monitor Build
- [ ] GitHub Actions → Build & Deploy iOS (check status)
- [ ] GitHub Actions → Build & Deploy Android (check status)
- [ ] Review logs if build fails
- [ ] Download build artifacts if needed

### Verify Upload
- [ ] iOS: Check App Store Connect → TestFlight for new build
- [ ] Android: Check Play Console → Internal Testing for new release

---

## 📝 App Store Listings

### iOS - App Store Connect
- [ ] App name: Kid Commute
- [ ] Subtitle (optional)
- [ ] Description written
- [ ] Keywords added
- [ ] Screenshots uploaded (required sizes):
  - [ ] 6.5" iPhone (1284 x 2778)
  - [ ] 5.5" iPhone (1242 x 2208)
  - [ ] 12.9" iPad Pro (2048 x 2732)
- [ ] Privacy Policy URL: `https://your-domain.com/privacy`
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Category selected: Education / Transportation
- [ ] Age rating completed
- [ ] App Privacy details completed:
  - [ ] Location data (driver app)
  - [ ] Contact info (name, email, phone)
  - [ ] Usage data
- [ ] Review notes added (mention background location for driver app)

### Android - Google Play Console
- [ ] App name: Kid Commute
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Screenshots uploaded (required):
  - [ ] Phone (16:9 ratio, min 1920 x 1080)
  - [ ] 7" tablet
  - [ ] 10" tablet
- [ ] Feature graphic (1024 x 500)
- [ ] App icon (512 x 512)
- [ ] Privacy Policy URL
- [ ] Category: Education / Maps & Navigation
- [ ] Content rating questionnaire completed
- [ ] Target audience: 18+ (parents/drivers)
- [ ] Data safety form completed:
  - [ ] Location data (driver app)
  - [ ] Personal info (name, email, phone)
  - [ ] All data encrypted in transit
  - [ ] Users can request data deletion

---

## 🧪 Testing Phase

### Internal Testing
- [ ] iOS: Add internal testers in TestFlight
- [ ] iOS: Distribute build to internal testers
- [ ] Android: Create internal testing track
- [ ] Android: Add internal testers
- [ ] Android: Promote release to internal track
- [ ] Test on real devices (iPhone & Android)
- [ ] Verify push notifications work
- [ ] Verify GPS tracking works (driver app)
- [ ] Test all critical user flows

### Beta Testing (Optional)
- [ ] iOS: External TestFlight beta (public link or invite)
- [ ] Android: Closed testing or open testing track
- [ ] Collect feedback from beta testers
- [ ] Fix critical bugs
- [ ] Deploy updated builds

---

## 🎉 Production Release

### Final Checks
- [ ] All critical bugs fixed
- [ ] App tested on multiple devices
- [ ] Privacy policy deployed and accessible
- [ ] Terms of service deployed and accessible
- [ ] Support email active: support@kidcommute.com
- [ ] Backend production environment stable
- [ ] Database backups configured
- [ ] Monitoring/alerting set up (Sentry, etc.)

### Submit for Review
- [ ] iOS: App Store Connect → Submit for Review
- [ ] Android: Play Console → Promote to Production
- [ ] Monitor review status daily
- [ ] Respond to reviewer questions within 24 hours

### Expected Review Times
- iOS: 1-3 days (can be rejected if background location not justified)
- Android: 1-3 days (usually faster than iOS)

### If Rejected
- [ ] Read rejection reason carefully
- [ ] Fix issues mentioned
- [ ] Update app and resubmit
- [ ] Consider requesting review call (iOS) if unclear

---

## 📈 Post-Launch

### Monitoring (First Week)
- [ ] Check crash reports daily (App Store Connect / Play Console)
- [ ] Monitor user reviews and ratings
- [ ] Check backend error logs
- [ ] Monitor push notification delivery rates
- [ ] Track GPS data accuracy

### Marketing
- [ ] App Store / Play Store links shared
- [ ] Website updated with download links
- [ ] Email sent to existing users
- [ ] Social media announcement
- [ ] Press release (optional)

### Maintenance
- [ ] Plan for regular updates (monthly or quarterly)
- [ ] Monitor OS updates (iOS 18, Android 15, etc.)
- [ ] Update dependencies regularly
- [ ] Renew Apple Developer membership annually
- [ ] Keep Google Play account in good standing

---

## 🔄 Regular Update Workflow

When you need to release an update:

1. **Update version numbers:**
   ```bash
   # iOS: ios/App/App/Info.plist
   # Increment CFBundleVersion (build number)
   # Update CFBundleShortVersionString if needed (e.g., 1.0.0 → 1.0.1)
   
   # Android: android/app/build.gradle
   # Increment versionCode (e.g., 1 → 2)
   # Update versionName if needed (e.g., "1.0.0" → "1.0.1")
   ```

2. **Create tagged release:**
   ```bash
   git add .
   git commit -m "Version 1.0.1 - Bug fixes and improvements"
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

3. **Monitor GitHub Actions** - builds run automatically

4. **Test in TestFlight / Internal Testing**

5. **Submit to Production** when ready

---

## 💡 Pro Tips

### Cost Optimization
- Only trigger builds on tags (`v*`), not every push
- Test locally before pushing to GitHub
- Use manual `workflow_dispatch` for on-demand builds
- Consider making repo public for unlimited free builds

### Version Naming Convention
- Major: Breaking changes (1.0.0 → 2.0.0)
- Minor: New features (1.0.0 → 1.1.0)
- Patch: Bug fixes (1.0.0 → 1.0.1)

### Common Mistakes to Avoid
- ❌ Don't commit keystore or certificates to Git
- ❌ Don't lose your Android keystore (can't update app!)
- ❌ Don't forget to increment build numbers
- ❌ Don't submit without testing on real devices
- ❌ Don't use debug builds for production
- ❌ Don't forget to renew Apple Developer membership

### Backup Strategy
- **iOS:** Keep .p12 and .mobileprovision in password manager
- **Android:** Keep .keystore file in 3 secure locations
- **Passwords:** Store all passwords in password manager
- **GitHub Secrets:** Document what each secret contains
- **Firebase:** Keep service account JSON backed up

---

## 🆘 Quick Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| iOS build fails: "No identity found" | Re-export .p12, verify password is correct |
| Android signing fails | Verify keystore password matches GitHub secret |
| Upload to App Store fails | Check API key has proper permissions |
| Upload to Play fails | Verify service account has "Release Manager" role |
| Build is too slow/expensive | Switch to manual triggers or tags-only |
| Version already exists | Increment build number (iOS) or versionCode (Android) |

For detailed troubleshooting, see: [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)

---

## ✅ Launch Day Checklist

The big day! Use this for final checks:

- [ ] Version: `1.0.0`, Build: `1` (iOS and Android)
- [ ] All features tested on real devices
- [ ] Crash reporting working (Sentry/Firebase Crashlytics)
- [ ] Analytics tracking working
- [ ] Push notifications tested end-to-end
- [ ] Privacy policy accessible
- [ ] Terms of service accessible
- [ ] Support email responding
- [ ] Backend production ready
- [ ] Database backed up
- [ ] App Store listing complete
- [ ] Play Store listing complete
- [ ] Screenshots look great
- [ ] App icons correct (all sizes)
- [ ] Submit for review clicked! 🚀

---

**Good luck with your launch! 🎉**

For detailed setup instructions, see [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)
