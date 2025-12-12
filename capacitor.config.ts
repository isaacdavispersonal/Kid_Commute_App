import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fleettrack.app',
  appName: 'Kid Commute',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#F8F9FA',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F8F9FA',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    backgroundColor: '#F8F9FA',
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#F8F9FA',
  },
};

export default config;
