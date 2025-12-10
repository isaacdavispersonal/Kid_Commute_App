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
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'automatic',
  },
};

export default config;
