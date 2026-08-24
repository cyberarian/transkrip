import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const strictContentSecurityPolicy = "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; worker-src 'self' blob:"
const workerContentSecurityPolicy = strictContentSecurityPolicy.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'")
const developmentContentSecurityPolicy = strictContentSecurityPolicy
  .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
  .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")

const securityHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const ollamaProxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: false,
  },
  '/ollama': {
    target: 'http://127.0.0.1:11434',
    changeOrigin: false,
    rewrite: (path: string) => path.replace(/^\/ollama/, ''),
  },
}

function scopedContentSecurityPolicy() {
  const install = (development: boolean) => (server: { middlewares: { use: (handler: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void }, next: () => void) => void) => void } }) => {
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split('?', 1)[0]
      const policy = path === '/whisper/engine-worker.js'
        ? workerContentSecurityPolicy
        : development ? developmentContentSecurityPolicy : strictContentSecurityPolicy
      response.setHeader('Content-Security-Policy', policy)
      next()
    })
  }

  return {
    name: 'transkrip-scoped-content-security-policy',
    configureServer: install(true),
    configurePreviewServer: install(false),
  }
}

export default defineConfig({
  plugins: [scopedContentSecurityPolicy(), react()],
  server: {
    headers: securityHeaders,
    proxy: ollamaProxy,
  },
  preview: {
    headers: securityHeaders,
    proxy: ollamaProxy,
  },
})
