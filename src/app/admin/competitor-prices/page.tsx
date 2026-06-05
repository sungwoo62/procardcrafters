'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { Plus, ExternalLink, Trash2, RefreshCw, TrendingDown } from 'lucide-react'
import type { CompetitorPrice, CompetitorName } from '@/types/database'

const COMPETITOR_LABEL: Record<CompetitorName, string> = {
  vistaprint: 'Vistaprint',
  moo: 'MOO',
}

export default function CompetitorPricesAdmin() {
  const [rows, setRows] = useState<CompetitorPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const supabase = createBrowserClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('print_competitor_prices')
      .select('*')
      .order('captured_at', { ascending: false })
    setRows((data as CompetitorPrice[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    setDeleting(id)
    await supabase.from('print_competitor_prices').delete().eq('id', id)
    await load()
    setDeleting(null)
  }

  function isStale(capturedAt: string) {
    return new Date(capturedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-emerald-600" />
            경쟁사 가격 비교 데이터
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            7일 이내 데이터만 배지에 노출됩니다. 스크린샷 URL 필수.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
          <Link
            href="/admin/competitor-prices/new"
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> 가격 등록
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">등록된 경쟁사 가격이 없습니다.</p>
          <Link
            href="/admin/competitor-prices/new"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> 첫 번째 가격 등록
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="pb-3 pr-4">SKU</th>
                <th className="pb-3 pr-4">경쟁사</th>
                <th className="pb-3 pr-4">Spec</th>
                <th className="pb-3 pr-4 text-right">경쟁사 가격</th>
                <th className="pb-3 pr-4 text-right">우리 가격</th>
                <th className="pb-3 pr-4 text-right">절감률</th>
                <th className="pb-3 pr-4">수집일</th>
                <th className="pb-3 pr-4">상태</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => {
                const stale = isStale(row.captured_at)
                const savingsPct = Math.round(
                  (row.competitor_price_usd - row.our_price_usd) / row.competitor_price_usd * 100
                )
                const cheaper = savingsPct > 0
                return (
                  <tr key={row.id} className={stale ? 'opacity-50' : ''}>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-700">{row.sku_slug}</td>
                    <td className="py-3 pr-4 font-semibold text-gray-900">
                      {COMPETITOR_LABEL[row.competitor as CompetitorName] ?? row.competitor}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 max-w-xs truncate" title={row.sku_variant}>
                      {row.sku_variant}
                    </td>
                    <td className="py-3 pr-4 text-right text-red-600 font-semibold">
                      ${row.competitor_price_usd.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-right text-emerald-700 font-semibold">
                      ${row.our_price_usd.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {cheaper ? (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          -{savingsPct}%
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                          더 비쌈
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                      {new Date(row.captured_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-3 pr-4">
                      {stale ? (
                        <span className="text-xs text-orange-500 font-medium">만료 (7일 초과)</span>
                      ) : cheaper ? (
                        <span className="text-xs text-emerald-600 font-medium">배지 활성</span>
                      ) : (
                        <span className="text-xs text-gray-400">가격 역전</span>
                      )}
                    </td>
                    <td className="py-3 flex items-center gap-2 justify-end">
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-600"
                        title="출처 URL"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deleting === row.id}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
