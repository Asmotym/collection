import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const devApiTarget = process.env.VITE_DEV_API_URL || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
      '/health': {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      core: path.resolve(__dirname, 'src/core'),
      modules: path.resolve(__dirname, 'src/modules'),
      assets: path.resolve(__dirname, 'src/assets'),
      api: path.resolve(__dirname, 'src/api'),
    }
  }
})
