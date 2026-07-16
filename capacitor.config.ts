import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.robinjoseph.soufflet',
  appName: 'Soufflet',
  webDir: 'dist',
  server: {
    url: 'https://soufflet.robin-joseph.fr',
    cleartext: false,
    allowNavigation: ['soufflet.robin-joseph.fr'],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#f7f4ec',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 900,
      backgroundColor: '#f7f4ec',
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false,
      animation: 'NONE',
    },
  },
};

export default config;
