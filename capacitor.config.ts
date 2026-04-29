import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: For local development with hot-reload from the Lovable preview,
// temporarily uncomment the `server` block below. It MUST be removed
// (or commented out) for any build submitted to the App Store —
// Apple requires the app to load bundled web assets, not a remote URL.
//
// const devServer = {
//   url: 'https://276b1692-bb17-4817-a9c6-aeb43f8b06a0.lovableproject.com?forceHideBadge=true',
//   cleartext: true,
// };

const config: CapacitorConfig = {
  appId: 'org.deadset.app',
  appName: 'Dead Set',
  webDir: 'dist',
  // server: devServer, // <-- enable only for local dev, never for App Store builds
};

export default config;
