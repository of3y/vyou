import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/vyou-mark.svg", "icons/apple-touch-icon.png"],
      manifestFilename: "manifest.webmanifest",
      manifest: {
        name: "VYU — what's in your view",
        short_name: "VYU",
        description: "Take a sky photo, see it become a directional cone on a shared, AI-verified weather map.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#0f1115",
        background_color: "#0f1115",
        categories: ["weather", "utilities", "social"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//, /^\/storage\//, /^\/auth\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.host.endsWith(".supabase.co") || url.host.endsWith(".tile.openstreetmap.org"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
});
