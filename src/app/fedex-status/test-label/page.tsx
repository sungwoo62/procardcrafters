// OMO-3736 — FedEx 테스트 라벨(ZPL) 생성 + Xprinter 직접출력 페이지 (비-admin)
//
// 흐름: [테스트 라벨 생성] → FedEx ZPL 원본 수신 → [ZPL 바로 출력] → 로컬 브리지 → Xprinter
//       또는 [.zpl 다운로드] 후 CLI 출력. 절대 이미지로 변환하지 않음 (FedEx 인증 방식).

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, Download, Tag, Loader2, CheckCircle2, AlertTriangle, Copy, Terminal } from 'lucide-react'

function TestLabelInner() {
  const params = useSearchParams()
  const key = params.get('key') ?? ''

  const [busy, setBusy] = useState(false)
  const [zpl, setZpl] = useState('')
  const [tracking, setTracking] = useState('')
  const [msg, setMsg] = useState('')
  const [bridge, setBridge] = useState('http://localhost:9110')
  const [printerHost, setPrinterHost] = useState('')
  const [printMsg, setPrintMsg] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  // Windows PowerShell: API로 ZPL 생성 후 프린터 9100으로 raw 전송 (node/브리지 불필요).
  const buildPs = () => {
    const ip = printerHost || '192.168.0.50'
    return `$Key = "${key}"
$PrinterIP = "${ip}"   # <- 프린터 IP (Get-PrinterPort 로 확인)
$Port = 9100

$resp = Invoke-RestMethod -Method Post -Uri "https://procardcrafters.com/api/fedex/test-label?key=$Key"
if (-not $resp.ok) { Write-Host "생성 실패: $($resp.error)" -ForegroundColor Red; return }
$zpl  = $resp.zpl
$path = "$HOME\\Downloads\\fedex-test-label-$($resp.trackingNumber).zpl"
[System.IO.File]::WriteAllText($path, $zpl)
Write-Host "ZPL 생성: tracking $($resp.trackingNumber), $($resp.bytes) bytes"

try {
  $client = New-Object System.Net.Sockets.TcpClient($PrinterIP, $Port)
  $bytes  = [System.Text.Encoding]::ASCII.GetBytes($zpl)
  $client.GetStream().Write($bytes, 0, $bytes.Length)
  $client.Close()
  Write-Host ("출력 완료 -> {0}:{1}" -f $PrinterIP, $Port) -ForegroundColor Green
} catch { Write-Host "출력 실패: $_" -ForegroundColor Red }`
  }

  const copyPs = async () => {
    try { await navigator.clipboard.writeText(buildPs()); setCopyMsg('복사됨! PowerShell 창에 붙여넣기 하세요') }
    catch { setCopyMsg('복사 실패 — 아래 박스에서 직접 복사하세요') }
  }

  useEffect(() => {
    const b = window.localStorage.getItem('zplBridgeUrl'); if (b) setBridge(b)
    const p = window.localStorage.getItem('zplPrinterHost'); if (p) setPrinterHost(p)
  }, [])

  const generate = async () => {
    setBusy(true); setMsg(''); setZpl(''); setTracking('')
    try {
      const res = await fetch(`/api/fedex/test-label?key=${encodeURIComponent(key)}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || `생성 실패 (${res.status})`)
      setZpl(data.zpl)
      setTracking(data.trackingNumber)
      setMsg(`생성됨 — tracking ${data.trackingNumber} (${data.bytes}B ZPL)`)
    } catch (e) {
      setMsg(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const printDirect = async () => {
    setPrintMsg('')
    try {
      window.localStorage.setItem('zplBridgeUrl', bridge)
      window.localStorage.setItem('zplPrinterHost', printerHost)
      const headers: Record<string, string> = { 'Content-Type': 'text/plain' }
      if (printerHost) headers['X-Printer-Host'] = printerHost
      const res = await fetch(`${bridge.replace(/\/$/, '')}/print`, { method: 'POST', headers, body: zpl })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) throw new Error(data.error || `출력 실패 (${res.status})`)
      setPrintMsg(`출력됨 (${data.bytes ?? zpl.length}B → ${data.printer ?? '프린터'})`)
    } catch (e) {
      setPrintMsg(`오류: ${(e as Error).message}. 브리지 실행/프린터IP 확인`)
    }
  }

  const download = () => {
    const blob = new Blob([zpl], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `fedex-test-label-${tracking || 'zpl'}.zpl`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Printer className="h-6 w-6" /> FedEx 테스트 라벨 (ZPL) 출력
        </h1>
        <p className="text-sm text-gray-600">
          FedEx가 준 ZPL 원본을 이미지로 바꾸지 않고 그대로 Xprinter(9100)로 출력 — 인증(case 27122658) 제출용.
          출력 후 스캔본을 FedEx 메일에 회신하세요.
        </p>
      </header>

      {!key && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          URL에 <code className="font-mono">?key=...</code> 가 없습니다. 받은 풀링크로 접속하세요.
        </div>
      )}

      {/* 1) 생성 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">1. 테스트 라벨 생성</h2>
        <button
          onClick={generate}
          disabled={busy || !key}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
          {busy ? 'FedEx 호출 중...' : '테스트 라벨 생성 (ZPL)'}
        </button>
        {msg && (
          <p className={`text-xs ${msg.startsWith('오류') ? 'text-red-600' : 'text-emerald-700'} flex items-center gap-1`}>
            {!msg.startsWith('오류') && <CheckCircle2 className="h-3.5 w-3.5" />} {msg}
          </p>
        )}
      </section>

      {/* 2-A) Windows PowerShell — 프린터가 윈도우 PC에 연결된 경우 (권장) */}
      <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Terminal className="h-4 w-4" /> 2-A. Windows PC에서 출력 (프린터가 윈도우에 연결 · node 불필요)
        </h2>
        <p className="text-xs text-gray-600">
          프린터가 원격 윈도우 PC에 연결돼 있으면 이 방법이 가장 쉽습니다. 아래 명령을 복사해 PowerShell에
          붙여넣으면 ZPL 생성 + 프린터 출력이 한 번에 됩니다. (이 페이지 버튼을 누를 필요 없음)
        </p>
        <label className="block max-w-xs">
          <span className="text-xs text-gray-600">프린터 IP</span>
          <input value={printerHost} onChange={(e) => setPrinterHost(e.target.value)}
            className="w-full rounded-lg border-gray-200 text-sm font-mono" placeholder="192.168.0.50" />
          <span className="text-[11px] text-gray-500">모르면 PowerShell에: <code className="bg-white px-1 rounded">Get-PrinterPort | ? PrinterHostAddress | ft Name,PrinterHostAddress</code></span>
        </label>
        <button onClick={copyPs}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
          <Copy className="h-4 w-4" /> PowerShell 명령 복사
        </button>
        {copyMsg && <p className="text-xs text-emerald-700">{copyMsg}</p>}
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer">명령 직접 보기/복사</summary>
          <textarea readOnly value={buildPs()} className="mt-2 w-full h-56 rounded-lg border-gray-200 font-mono text-[11px]" />
        </details>
        <p className="text-[11px] text-amber-700">프린터가 USB라 IP가 없으면 알려주세요 — USB용(프린터 공유) 방법을 드립니다.</p>
      </section>

      {/* 2-B) 브라우저/브리지 (Mac·Linux 또는 로컬 브리지 사용 시) */}
      {zpl && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">2-B. 브리지로 바로 출력 (Mac/Linux · 로컬 브리지)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-600">프린트 브리지 주소 (매장 PC)</span>
              <input value={bridge} onChange={(e) => setBridge(e.target.value)}
                className="w-full rounded-lg border-gray-200 text-sm font-mono" placeholder="http://localhost:9110" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">프린터 IP (선택, 브리지 기본값 사용 시 공란)</span>
              <input value={printerHost} onChange={(e) => setPrinterHost(e.target.value)}
                className="w-full rounded-lg border-gray-200 text-sm font-mono" placeholder="192.168.0.50" />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={printDirect}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
              <Printer className="h-4 w-4" /> ZPL 바로 출력
            </button>
            <button onClick={download}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-4 w-4" /> .zpl 다운로드
            </button>
          </div>
          {printMsg && <p className={`text-xs ${printMsg.startsWith('오류') ? 'text-red-600' : 'text-emerald-700'}`}>{printMsg}</p>}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer">ZPL 원본 보기 ({zpl.length}B)</summary>
            <textarea readOnly value={zpl} className="mt-2 w-full h-48 rounded-lg border-gray-200 font-mono text-[11px]" />
          </details>
        </section>
      )}

      <section className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-700">출력 후</p>
        <p>나온 라벨을 스캔/사진 → FedEx case 27122658 메일에 회신·첨부 (마감 7/10).</p>
        <p className="text-gray-400 pt-1">Mac/Linux에서 로컬 브리지를 쓰려면: <code className="font-mono bg-white px-1 rounded">PRINTER_HOST=&lt;IP&gt; node scripts/zpl-print-bridge.mjs</code></p>
      </section>
    </main>
  )
}

export default function FedexTestLabelPage() {
  return (
    <Suspense fallback={<div className="p-12 text-sm text-gray-500">로딩...</div>}>
      <TestLabelInner />
    </Suspense>
  )
}
