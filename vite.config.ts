import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, frontendRoot, ''), ...process.env }
  return {
    plugins: [react()],
    server: {
      port: Number(env.FRONTEND_PORT || 3007),
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
        },
      },
    },
  }
})
