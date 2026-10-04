import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
            { name: 'chart-vendor', test: /[\\/]node_modules[\\/](?:lightweight-charts|fancy-canvas)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/storage-api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/storage-api/, '/api/v1'),
      },
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
