import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/encounter/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "background.html"),
        menu: resolve(__dirname, "menu.html"),
        index: resolve(__dirname, "index.html"),
      },
    },
  },
});
