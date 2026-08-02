import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const sourceDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    assetsInlineLimit: 0,
    outDir: "dist-plugin",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(sourceDirectory, "src/legacy-entry.tsx"),
      output: {
        entryFileNames: "payout-account-actions.js",
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css")
            ? "payout-account-actions.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
