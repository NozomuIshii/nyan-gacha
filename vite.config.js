import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // サブディレクトリに置いても動くよう相対パスで出力する
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
