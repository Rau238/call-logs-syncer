import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.enterprise.calllogsync',
  appName: 'Call Log Sync',
  webDir: 'www',
  android: {
    // Minimum Android 11 (API 30) for modern Call Log APIs
    minWebViewVersion: 60,
  },
};

export default config;
