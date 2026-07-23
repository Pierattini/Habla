import type { CapacitorConfig } from '@capacitor/cli';

/// <reference types="@capacitor-firebase/authentication" />

const config: CapacitorConfig = {
  appId: 'app.conecta.mobileapp',
  appName: 'Conecta',
  webDir: 'dist/habla-app/browser',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
