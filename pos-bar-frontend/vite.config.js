import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        id: "/",
        name: "POS Bar Restaurante",
        short_name: "POS Bar",
        description: "POS Bar Restaurante (mesas, ventas, inventario)",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F5F7FB",
        theme_color: "#BFE8DD",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
        ]
      }
    })
  ]
});
