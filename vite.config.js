import { defineConfig } from 'vite'

const apiProxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    timeout: 0
  }
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: apiProxy
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: apiProxy
  }
})
