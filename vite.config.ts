import { defineConfig } from "vite";

export default defineConfig({
  // relative asset paths so the build works from any subpath
  // (e.g. GitHub Pages at /endless-mob-shooter/)
  base: "./",
});
