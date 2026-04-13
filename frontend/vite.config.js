import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      host: env.VITE_DEV_HOST || true,
      allowedHosts: allowedHosts.length ? allowedHosts : true,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || 4173),
      host: env.VITE_PREVIEW_HOST || "0.0.0.0",
    },
  };
});
