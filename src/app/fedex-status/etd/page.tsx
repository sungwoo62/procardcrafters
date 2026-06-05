// OMO-2371 — ETD (Electronic Trade Documents) 검증 결과 공개 대시보드.
//
// 보드가 PDF 직접 받거나 확인할 수 있게 만든 페이지.

import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { CheckCircle2, XCircle, Download, FileText, Tag, ExternalLink, Package } from 'lucide-react'

export const metadata = {
  title: 'FedEx ETD 검증 — OMO-2371',
  description: '통관 신속 처리 — FedEx 자동 Commercial Invoice 첨부 E2E 결과',
}

function safeRead<T>(rel: string): T | null {
  try {
    const p = path.join(process.cwd(), rel)
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

interface E2EResult {
  capturedAt: string
  sandbox: boolean
  orderNumber: string
  elapsedMs: number
  masterTrackingNumber: string
  serviceType: string
  serviceName?: string
  labelPdfBytes: number
  invoicePdfBytes: number
  etdInvoiceAttached: boolean
  artifacts: { label: string | null; invoice: string | null }
}

interface ScenarioResult {
  capturedAt: string
  sandbox: boolean
  ok: boolean
  stage?: string
  referenceId?: string
  masterTrackingNumber?: string
  docId?: string
  error?: string
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function publicPath(absRel: string | null): string | null {
  if (!absRel) return null
  // public/fedex-status/foo.pdf  →  /fedex-status/foo.pdf
  return absRel.startsWith('public/') ? `/${absRel.slice('public/'.length)}` : absRel
}

export default function EtdStatusPage() {
  const e2e = safeRead<E2EResult>('public/fedex-status/e2e-result.json')
  const s1  = safeRead<ScenarioResult>('public/fedex-status/etd-scenario1-result.json')
  const s2  = safeRead<ScenarioResult>('public/fedex-status/etd-scenario2-result.json')

  const labelHref   = publicPath(e2e?.artifacts.label   ?? null)
  const invoiceHref = publicPath(e2e?.artifacts.invoice ?? null)

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <Link href="/fedex-status" className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
          ← FedEx 통합 상태
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="h-6 w-6" />
          FedEx ETD 통관 신속 처리 — 검증 결과
        </h1>
        <p className="text-sm text-gray-600">
          OMO-2371 — Ship API + 자동 Commercial Invoice (ETD) 검증. 운영자가 [FedEx 라벨 생성]
          버튼 누르는 흐름을 sandbox 키로 in-process 재현.
        </p>
      </header>

      {/* E2E 결과 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">E2E — 운영 createFedexShipment()</h2>
          {e2e ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> 통과
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
              <XCircle className="h-3.5 w-3.5" /> 미실행
            </span>
          )}
        </div>

        {e2e ? (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">실행 시각</dt>
                <dd className="font-mono text-gray-900">{new Date(e2e.capturedAt).toLocaleString('ko-KR')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">주문 번호</dt>
                <dd className="font-mono text-gray-900">{e2e.orderNumber}</dd>
              </div>
              <div>
                <dt className="text-gray-500">master tracking</dt>
                <dd className="font-mono text-gray-900 font-semibold">{e2e.masterTrackingNumber}</dd>
              </div>
              <div>
                <dt className="text-gray-500">service</dt>
                <dd className="font-mono text-gray-900">{e2e.serviceType} {e2e.serviceName && <span className="text-gray-500">({e2e.serviceName})</span>}</dd>
              </div>
              <div>
                <dt className="text-gray-500">label PDF</dt>
                <dd className="font-mono text-gray-900">{formatBytes(e2e.labelPdfBytes)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">invoice PDF</dt>
                <dd className="font-mono text-gray-900">
                  {formatBytes(e2e.invoicePdfBytes)}{' '}
                  {e2e.etdInvoiceAttached && <span className="text-emerald-600 text-xs ml-1">✓ ETD 자동 첨부</span>}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">elapsed</dt>
                <dd className="font-mono text-gray-900">{(e2e.elapsedMs / 1000).toFixed(2)}s</dd>
              </div>
              <div>
                <dt className="text-gray-500">환경</dt>
                <dd className="font-mono text-gray-900">sandbox {e2e.sandbox && '(실제 청구 없음)'}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-3 pt-2">
              {labelHref && (
                <>
                  <a
                    href={labelHref}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Tag className="h-4 w-4" /> 라벨 PDF 보기
                  </a>
                  <a
                    href={labelHref}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <Download className="h-4 w-4" /> 라벨 다운로드
                  </a>
                </>
              )}
              {invoiceHref && (
                <>
                  <a
                    href={invoiceHref}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <FileText className="h-4 w-4" /> Invoice PDF 보기
                  </a>
                  <a
                    href={invoiceHref}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    <Download className="h-4 w-4" /> Invoice 다운로드
                  </a>
                </>
              )}
              <a
                href="/fedex-status/e2e-result.json"
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" /> e2e-result.json
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            아직 실행 결과가 없습니다. <code className="font-mono text-xs bg-gray-50 px-1 rounded">npx tsx scripts/test-fedex-create-label-e2e.ts</code>
          </p>
        )}
      </section>

      {/* 시나리오 1·2 결과 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">시나리오 1·2 — Upload Documents API</h2>
        <p className="text-xs text-gray-500">
          FedEx 표준 발송 서류 워크플로 (시나리오 1=발송 전 업로드, 시나리오 2=발송 후 업로드). 우리 자체
          PDF 양식 사용 경로 — 현재 sandbox 프로젝트에 Upload Documents API 구독 미포함 (
          <Link href="/fedex-status" className="underline">OMO-2372</Link>).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: '시나리오 1 (발송 전)', data: s1, file: '/fedex-status/etd-scenario1-result.json' },
            { name: '시나리오 2 (발송 후)', data: s2, file: '/fedex-status/etd-scenario2-result.json' },
          ].map(({ name, data, file }) => (
            <div key={name} className="rounded-lg border border-gray-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">{name}</h3>
                {data ? (
                  data.ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      <XCircle className="h-3 w-3" /> @{data.stage}
                    </span>
                  )
                ) : (
                  <span className="text-xs text-gray-400">미실행</span>
                )}
              </div>
              {data && (
                <dl className="text-xs space-y-1">
                  {data.referenceId && (
                    <div className="flex gap-2"><dt className="text-gray-500 w-24">reference</dt><dd className="font-mono">{data.referenceId}</dd></div>
                  )}
                  {data.masterTrackingNumber && (
                    <div className="flex gap-2"><dt className="text-gray-500 w-24">master tracking</dt><dd className="font-mono">{data.masterTrackingNumber}</dd></div>
                  )}
                  {data.docId && (
                    <div className="flex gap-2"><dt className="text-gray-500 w-24">docID</dt><dd className="font-mono">{data.docId}</dd></div>
                  )}
                  {data.error && (
                    <div className="text-amber-700 text-xs break-words pt-1 border-t border-gray-100 mt-2">{data.error}</div>
                  )}
                </dl>
              )}
              <a href={file} target="_blank" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> 전체 JSON
              </a>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-xs text-gray-400">
        <p>구현 코드: <code className="font-mono">src/lib/fedex-api.ts</code> · <code className="font-mono">src/lib/fedex-etd.ts</code></p>
        <p>운영 흐름: 관리자 주문 페이지 → 송장 row → [FedEx 라벨 생성] → 동일한 PDF 생성</p>
      </footer>
    </main>
  )
}
