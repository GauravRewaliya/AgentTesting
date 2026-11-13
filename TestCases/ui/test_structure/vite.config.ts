import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// /api goes to the Bun server (bun server/index.ts, port 5189)
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@root": at("../../.."), "@test_cases": at("../.."), "@test_harness": at("../../../test_harness"), "@core": at("../../../test_harness/core"),
      "@": at("./src"),
    },
  },
  server: { proxy: { "/api": { target: `http://127.0.0.1:${process.env.API_PORT ?? 5189}`, ws: true } } },
});
