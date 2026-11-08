import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function copyVisionWasm() {
  const source = resolve("node_modules/@mediapipe/tasks-vision/wasm");
  const target = resolve("public/wasm");
  return {
    name: "copy-mediapipe-wasm",
    buildStart() {
      if (existsSync(source)) cpSync(source, target, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [copyVisionWasm()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
