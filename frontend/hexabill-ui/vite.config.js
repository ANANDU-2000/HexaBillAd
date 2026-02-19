import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Serve app icon for /favicon.ico to avoid 404
    {
      name: 'favicon-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.split('?')[0] === '/favicon.ico') {
            req.url = '/favicon.ico'
          }
          next()
        })
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        // Prevent variable name conflicts that cause TDZ errors
        keep_fnames: true,
        keep_classnames: true,
      },
      mangle: {
        // Prevent mangling variables that start with 'st' to avoid conflicts
        reserved: ['st', 'status', 'statusColor', 'entryStatus', 'invoiceStatus', 'safeFilters']
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
