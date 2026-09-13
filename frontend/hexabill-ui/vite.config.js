import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Stale browser tabs request index.html?html-proxy&index=N.js after HMR/git
    // pulls. Vite then throws "No matching HTML proxy module". Serve the same
    // React Refresh preamble Vite injects so the overlay does not block the app.
    {
      name: 'stale-html-proxy-fallback',
      enforce: 'pre',
      load(id) {
        if (!id.includes('html-proxy')) return
        return `import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;`
      },
    },
    // Serve app icon for /favicon.ico to avoid 404 (rewrite to logo svg)
    {
      name: 'favicon-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.split('?')[0] === '/favicon.ico') {
            req.url = '/hexabill-logo.svg'
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
    // Security: no source maps in production so source code and stack traces are not exposed
    sourcemap: false,
    // Terser compress only — identifier mangling disabled. Mangling produced TDZ crashes in prod
    // ("Cannot access 'pt' / 'xt' / 'st' before initialization") with Recharts + large app graph.
    minify: 'terser',
    terserOptions: {
      compress: {
        keep_fnames: true,
        keep_classnames: true,
        properties: false,
        reduce_vars: false,
        reduce_funcs: false,
      },
      mangle: false,
      format: {
        // Preserve comments for debugging
        comments: false,
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
