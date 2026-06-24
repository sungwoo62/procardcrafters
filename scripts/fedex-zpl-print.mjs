#!/usr/bin/env node
// OMO-3736 — ZPL 라벨을 Xprinter(9100 RAW)로 바로 출력하는 CLI
//
// FedEx 인증용: API가 준 ZPL 원본을 이미지로 바꾸지 않고 그대로 프린터로 보낸다.
//   API → ZPL 원본(.zpl) → 9100 RAW 전송 → Xprinter 출력 → 스캔 → FedEx 회신 첨부
//
// 사용:
//   node scripts/fedex-zpl-print.mjs --host 192.168.0.50 label.zpl
//   node scripts/fedex-zpl-print.mjs --host 192.168.0.50 --port 9100 < label.zpl
//   node scripts/fedex-zpl-print.mjs --host 192.168.0.50 --url "https://...signed-url-to-label.zpl"

import net from 'node:net'
import { readFileSync } from 'node:fs'

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const host = arg('--host', process.env.PRINTER_HOST)
const port = Number(arg('--port', process.env.PRINTER_PORT || '9100'))
const url = arg('--url', null)
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--') && a !== String(port) && a !== host && a !== url)

if (!host) {
  console.error('오류: --host <프린터IP> (또는 PRINTER_HOST env) 필요')
  process.exit(1)
}

function readStdin() {
  return new Promise((resolve) => {
    const chunks = []
    process.stdin.on('data', (c) => chunks.push(c))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks)))
    if (process.stdin.isTTY) resolve(Buffer.alloc(0))
  })
}

function sendZplRaw(h, p, zpl) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: h, port: p }, () => {
      socket.write(zpl, 'binary', () => socket.end())
    })
    socket.setTimeout(8000)
    socket.on('timeout', () => { socket.destroy(); reject(new Error(`프린터 ${h}:${p} 응답 시간초과`)) })
    socket.on('error', reject)
    socket.on('close', () => resolve())
  })
}

const zpl = url
  ? Buffer.from(await (await fetch(url)).arrayBuffer())
  : fileArg
    ? readFileSync(fileArg)
    : await readStdin()

if (!zpl.length) {
  console.error('오류: 보낼 ZPL 없음 (파일/STDIN/--url 중 하나 지정)')
  process.exit(1)
}

try {
  await sendZplRaw(host, port, zpl)
  console.log(`출력 완료: ${zpl.length} bytes → ${host}:${port}`)
} catch (e) {
  console.error(`출력 실패: ${e.message}`)
  process.exit(1)
}
