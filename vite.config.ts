import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      core: path.resolve(__dirname, 'src/core'),
      modules: path.resolve(__dirname, 'src/modules'),
      netlify: path.resolve(__dirname, 'netlify'),
      assets: path.resolve(__dirname, 'src/assets'),
    }
  }
})
