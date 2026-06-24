#!/usr/bin/env node
// OMO-3736 — 로컬 ZPL 프린트 브리지
//
// 왜 필요한가:
//   브라우저는 raw TCP(9100) 소켓을 못 연다. admin 앱이 Vercel(클라우드)에 떠 있으면
//   서버도 매장 LAN의 Xprinter(예: 192.168.0.50:9100)에 도달 못 한다.
//   → 매장 PC에서 이 작은 브리지를 띄우면, 웹 admin 버튼이 localhost 로 ZPL 을 보내고
//     브리지가 그걸 그대로 프린터 9100 포트로 RAW 전송한다 (이미지 변환 없음 = FedEx 인증 통과 방식).
//
// 흐름:  웹 admin(버튼) → POST http://localhost:9110/print (body=raw ZPL) → TCP printer:9100 → Xprinter 출력
//
// 실행 (매장 PC, 프린터와 같은 네트워크):
//   PRINTER_HOST=192.168.0.50 node scripts/zpl-print-bridge.mjs
//   (또는)  node scripts/zpl-print-bridge.mjs --printer 192.168.0.50 --printer-port 9100 --port 9110
//
// 헬스체크:  curl http://localhost:9110/health
// 출력테스트: curl -X POST --data-binary @label.zpl http://localhost:9110/print

import http from 'node:http'
import net from 'node:net'

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const BRIDGE_PORT = Number(arg('--port', process.env.BRIDGE_PORT || '9110'))
const DEFAULT_PRINTER = arg('--printer', process.env.PRINTER_HOST || '')
const DEFAULT_PRINTER_PORT = Number(arg('--printer-port', process.env.PRINTER_PORT || '9100'))
// CORS: 웹 admin 출처. 기본은 모두 허용(로컬 전용 브리지라 안전). 좁히려면 ALLOW_ORIGIN 지정.
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*'

/** raw ZPL 바이트를 프린터 host:port(9100)로 그대로 전송. 절대 이미지로 변환하지 않음. */
function sendZplRaw(host, port, zpl) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(zpl, 'binary', () => socket.end())
    })
    socket.setTimeout(8000)
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`프린터 ${host}:${port} 응답 시간초과`)) })
    socket.on('error', (e) => reject(e))
    socket.on('close', () => resolve())
  })
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-Host, X-Printer-Port')
}

const server = http.createServer((req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  const url = new URL(req.url, `http://localhost:${BRIDGE_PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, defaultPrinter: DEFAULT_PRINTER || null, printerPort: DEFAULT_PRINTER_PORT }))
  }

  if (req.method === 'POST' && url.pathname === '/print') {
    const host = req.headers['x-printer-host'] || url.searchParams.get('host') || DEFAULT_PRINTER
    const port = Number(req.headers['x-printer-port'] || url.searchParams.get('port') || DEFAULT_PRINTER_PORT)
    if (!host) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: '프린터 IP 미지정 (PRINTER_HOST env 또는 X-Printer-Host 헤더)' }))
    }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', async () => {
      const zpl = Buffer.concat(chunks)
      if (!zpl.length) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ ok: false, error: '빈 ZPL 본문' }))
      }
      try {
        await sendZplRaw(host, port, zpl)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, bytes: zpl.length, printer: `${host}:${port}` }))
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(e.message || e), printer: `${host}:${port}` }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false, error: 'not found' }))
})

server.listen(BRIDGE_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[zpl-print-bridge] http://localhost:${BRIDGE_PORT}  → printer ${DEFAULT_PRINTER || '(미지정)'}:${DEFAULT_PRINTER_PORT}`)
})
