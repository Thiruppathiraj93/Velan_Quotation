import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      // Precache the app shell assets (icons, logo, quotation header) so the
      // splash screen and quotation render offline. Spec PDFs are intentionally
      // excluded — they total ~53 MB and are fetched on demand.
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'logo/velan-concast-logo.png',
        'templates/quotation-header.png',
      ],
    })
  ]
});