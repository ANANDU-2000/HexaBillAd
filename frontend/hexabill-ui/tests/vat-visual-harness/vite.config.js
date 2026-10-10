import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '../../services/index', replacement: resolve(here, 'mock-services.js') },
      { find: '../../hooks/useAuth', replacement: resolve(here, 'mock-auth.js') },
      { find: '../../utils/roles', replacement: resolve(here, 'mock-roles.js') },
      { find: '../../utils/currency', replacement: resolve(here, 'mock-currency.js') },
      { find: /^react-hot-toast$/, replacement: resolve(here, 'mock-toast.js') }
    ]
  },
  server: { host: '127.0.0.1', port: 4178, strictPort: true }
})
