import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const AI_HOST = process.env.AI_HOST ?? 'ai'
const AI_PORT = Number(process.env.AI_PORT ?? 8080)
const PORT = Number(process.env.PORT ?? 80)
const AI_PROXY_TIMEOUT_MS = Number(process.env.AI_PROXY_TIMEOUT_MS ?? 600_000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

function proxyToAi(req, res, targetPath) {
  const headers = { ...req.headers, host: `${AI_HOST}:${AI_PORT}` }
  delete headers.connection

  const proxyReq = http.request(
    {
      hostname: AI_HOST,
      port: AI_PORT,
      path: targetPath,
      method: req.method,
      headers,
      timeout: AI_PROXY_TIMEOUT_MS,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`AI 服务不可用: ${err.message}`)
    }
  })

  req.pipe(proxyReq)
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const index = path.join(DIST, 'index.html')
      fs.readFile(index, (e2, html) => {
        if (e2) {
          res.writeHead(404)
          res.end('Not Found')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      })
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/'

  if (url === '/lama-api' || url.startsWith('/lama-api/')) {
    const targetPath = url.replace(/^\/lama-api/, '') || '/'
    proxyToAi(req, res, targetPath)
    return
  }

  const safePath = path.normalize(url).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(DIST, safePath === '/' ? 'index.html' : safePath)

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  serveStatic(res, filePath)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`YXWatermark web → http://0.0.0.0:${PORT}`)
  console.log(`AI proxy   → http://${AI_HOST}:${AI_PORT} (timeout ${AI_PROXY_TIMEOUT_MS}ms)`)
})
