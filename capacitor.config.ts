import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.deadsetharmony',
  appName: 'dead-set-harmony',
  webDir: 'dist',
  server: {
    url: 'https://276b1692-bb17-4817-a9c6-aeb43f8b06a0.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
