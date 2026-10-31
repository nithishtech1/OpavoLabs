import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'node:path'
import { PinataSDK } from 'pinata'

function apiDevServerPlugin() {
  let env = {}
  return {
    name: 'api-dev-server',
    configResolved(config) {
      env = {
        ...loadEnv(config.mode, path.resolve(config.root, '..'), ''),
        ...loadEnv(config.mode, config.root, ''),
        ...process.env,
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (url.pathname === '/api/upload-url') {
          if (req.method !== 'GET' && req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          const jwt = env.PINATA_JWT || process.env.PINATA_JWT
          const gateway = env.PINATA_GATEWAY || env.VITE_PINATA_GATEWAY || process.env.PINATA_GATEWAY || 'lime-careful-thrush-231.mypinata.cloud'

          if (!jwt) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: 'Missing PINATA_JWT',
              message: 'PINATA_JWT is not set in environment or .env.local'
            }))
            return
          }

          try {
            const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway })
            const signedUrl = await pinata.upload.public.createSignedURL({
              expires: 60,
              mimeTypes: ['image/*'],
              maxFileSize: 5000000,
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ url: signedUrl }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: 'could not create upload url',
              message: e?.message || String(e)
            }))
          }
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
    apiDevServerPlugin(),
  ],
})
