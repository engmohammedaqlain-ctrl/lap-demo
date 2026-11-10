import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import banfoushApi from "./server/banfoushApi.js";

export default defineConfig(({ mode }) => ({
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  plugins: [
    react(),
    // مساعد بنفوش: المفتاح من .env.local على الخادم فقط (لا يُضمَّن في الحزمة)
    banfoushApi(loadEnv(mode, process.cwd(), "XAI_")),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "المختبر التفاعلي",
        short_name: "المختبر",
        description: "تجارب علمية عربية تفاعلية",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#FAF6EE",
        theme_color: "#1B7340",
        dir: "rtl",
        lang: "ar",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,ico,png,jpg,jpeg,webp,mp3}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
}));
