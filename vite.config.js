import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 0
      }
    }
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live']
  }
})
