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
  const [printerName, setPrinterName] = useState('Xprinter XP-DT108B LABEL')

  // 폴백(브리지 없이 1회성): API로 ZPL 생성 후 USB 프린터로 RAW 전송 (winspool, node 불필요).
  const buildPs = () => {
    const pr = printerName || 'Xprinter XP-DT108B LABEL'
    return `$src = @'
using System; using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DI { [MarshalAs(UnmanagedType.LPWStr)] public string n; [MarshalAs(UnmanagedType.LPWStr)] public string o; [MarshalAs(UnmanagedType.LPWStr)] public string t; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr p);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr h, int l, ref DI di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter")] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter")] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter")] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter")] public static extern bool WritePrinter(IntPtr h, IntPtr b, int n, out int w);
  public static bool Send(string pr, byte[] bytes){ IntPtr h; if(!OpenPrinter(pr,out h,IntPtr.Zero)) return false; DI d=new DI(); d.n="FedEx ZPL"; d.t="RAW"; bool ok=false;
    if(StartDocPrinter(h,1,ref d)){ if(StartPagePrinter(h)){ IntPtr p=Marshal.AllocCoTaskMem(bytes.Length); Marshal.Copy(bytes,0,p,bytes.Length); int w; ok=WritePrinter(h,p,bytes.Length,out w); Marshal.FreeCoTaskMem(p); EndPagePrinter(h);} EndDocPrinter(h);} ClosePrinter(h); return ok; }
}
'@
Add-Type -TypeDefinition $src -Language CSharp

$Key = "${key}"
$Printer = "${pr}"
$resp = Invoke-RestMethod -Method Post -Uri "https://procardcrafters.com/api/fedex/test-label?key=$Key"
if (-not $resp.ok) { Write-Host "생성 실패: $($resp.error)" -ForegroundColor Red; return }
[System.IO.File]::WriteAllText("$HOME\\Downloads\\fedex-test-label-$($resp.trackingNumber).zpl", $resp.zpl)
$bytes = [System.Text.Encoding]::ASCII.GetBytes($resp.zpl)
if ([RawPrinter]::Send($Printer, $bytes)) { Write-Host "출력 완료 -> $Printer" -ForegroundColor Green }
else { Write-Host "출력 실패: 프린터 이름 확인 또는 관리자 권한 실행" -ForegroundColor Red }`
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

      {/* 2) 자동 출력 설정 — 1회만, 이후 버튼만 누르면 출력 */}
      <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Terminal className="h-4 w-4" /> 2. 자동 출력 설정 (1회만 — 이후 버튼만 누르면 출력)
        </h2>
        <p className="text-xs text-gray-600">
          USB 라벨프린터가 연결된 윈도우 PC에서 아래 <b>브리지를 한 번만 실행</b>해두면, 그 다음부터는
          매번 스크립트 없이 <b>[ZPL 바로 출력]</b> 버튼만으로 출력됩니다. (node 설치 불필요)
        </p>
        <ol className="text-xs text-gray-700 space-y-2 list-decimal pl-4">
          <li>
            <a href="/fedex-status/zpl-print-bridge.ps1" download
              className="text-indigo-700 underline inline-flex items-center gap-1">
              <Download className="h-3 w-3" /> 브리지 다운로드 (zpl-print-bridge.ps1)
            </a>
          </li>
          <li>PowerShell에서 1회 실행 (창은 열어둠):
            <code className="block mt-1 bg-white px-2 py-1 rounded font-mono text-[11px] break-all">powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\zpl-print-bridge.ps1"</code>
            <span className="text-[11px] text-gray-500">프린터가 다르면 파일 맨 위 <code className="bg-white px-1 rounded">$Printer</code> 이름만 변경. "접근 거부"면 관리자 권한으로 실행.</span>
          </li>
          <li>"실행 중"이라고 뜨면 준비 완료. 컴퓨터 켤 때마다 자동 실행하려면 파일 맨 아래 '자동시작' 참고.</li>
        </ol>
      </section>

      {/* 3) 출력 */}
      {zpl && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">3. 출력</h2>
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

      {/* 폴백: 브리지 없이 1회성 출력 */}
      <details className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">브리지 없이 한 번만 출력 (고급 · 매번 붙여넣어야 함)</summary>
        <div className="mt-3 space-y-2">
          <label className="block max-w-md">
            <span className="text-gray-600">프린터 이름</span>
            <input value={printerName} onChange={(e) => setPrinterName(e.target.value)}
              className="w-full rounded-lg border-gray-200 text-xs font-mono" />
          </label>
          <button onClick={copyPs}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white">
            <Copy className="h-3.5 w-3.5" /> USB 출력 명령 복사
          </button>
          {copyMsg && <p className="text-emerald-700">{copyMsg}</p>}
          <textarea readOnly value={buildPs()} className="w-full h-48 rounded-lg border-gray-200 font-mono text-[11px]" />
        </div>
      </details>

      <section className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-700">출력 후</p>
        <p>나온 라벨을 스캔/사진 → FedEx case 27122658 메일에 회신·첨부 (마감 7/10).</p>
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
