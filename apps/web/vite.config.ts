import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/socket.io': {
        target: 'http://localhost:8787',
        ws: true,
      },
    },
  },
})
