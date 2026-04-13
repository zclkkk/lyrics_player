import { defineConfig } from "vite"

export default defineConfig({
  build: { target: "esnext" },
  css: { devSourcemap: true },
})
