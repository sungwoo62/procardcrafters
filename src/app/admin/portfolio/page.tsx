'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, StarOff, AlertCircle, Loader2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'business_cards', label: 'Business Cards' },
  { value: 'stickers', label: 'Stickers' },
  { value: 'flyers', label: 'Flyers' },
  { value: 'postcards', label: 'Postcards' },
  { value: 'posters', label: 'Posters' },
  { value: 'other', label: 'Other' },
]

interface PortfolioItem {
  id: string
  title: string
  description: string | null
  category: string
  image_url: string
  thumbnail_url: string | null
  tags: string[]
  is_featured: boolean
  is_published: boolean
  sort_order: number
  created_at: string
}

interface FormState {
  title: string
  description: string
  category: string
  image_url: string
  thumbnail_url: string
  tags: string
  is_featured: boolean
  is_published: boolean
  sort_order: number
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  category: 'business_cards',
  image_url: '',
  thumbnail_url: '',
  tags: '',
  is_featured: false,
  is_published: true,
  sort_order: 0,
}

export default function AdminPortfolioPage() {
  const [secret, setSecret] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/portfolio', {
        headers: { 'x-admin-secret': secret },
      })
      if (!res.ok) throw new Error('인증 실패 또는 서버 오류')
      const data = await res.json()
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }, [secret])

  useEffect(() => {
    if (authenticated) fetchItems()
  }, [authenticated, fetchItems])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (secret.trim()) setAuthenticated(true)
  }

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(item: PortfolioItem) {
    setEditId(item.id)
    setForm({
      title: item.title,
      description: item.description ?? '',
      category: item.category,
      image_url: item.image_url,
      thumbnail_url: item.thumbnail_url ?? '',
      tags: item.tags.join(', '),
      is_featured: item.is_featured,
      is_published: item.is_published,
      sort_order: item.sort_order,
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      const url = editId ? `/api/admin/portfolio/${editId}` : '/api/admin/portfolio'
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('저장 실패')
      setShowForm(false)
      await fetchItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 오류')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 항목을 삭제할까요?')) return
    try {
      const res = await fetch(`/api/admin/portfolio/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': secret },
      })
      if (!res.ok) throw new Error('삭제 실패')
      await fetchItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 오류')
    }
  }

  async function toggleField(id: string, field: 'is_published' | 'is_featured', current: boolean) {
    try {
      const res = await fetch(`/api/admin/portfolio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ [field]: !current }),
      })
      if (!res.ok) throw new Error('업데이트 실패')
      await fetchItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-6">관리자 인증</h1>
          <input
            type="password"
            placeholder="Admin Secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 transition-colors"
          >
            입장
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">포트폴리오 관리</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> 새 항목 추가
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* 항목 그리드 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <div className="relative aspect-[4/3] bg-gray-100">
                  <Image
                    src={item.thumbnail_url ?? item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                  {!item.is_published && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">비공개</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">{item.title}</h3>
                    {item.is_featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-400 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
                    {' · '}순서 {item.sort_order}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> 수정
                    </button>
                    <button
                      onClick={() => toggleField(item.id, 'is_published', item.is_published)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
                    >
                      {item.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {item.is_published ? '숨기기' : '공개'}
                    </button>
                    <button
                      onClick={() => toggleField(item.id, 'is_featured', item.is_featured)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-yellow-600 transition-colors px-2 py-1 rounded-lg hover:bg-yellow-50"
                    >
                      {item.is_featured ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 추가/수정 폼 모달 */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <form
              onSubmit={handleSave}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            >
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                {editId ? '포트폴리오 수정' : '새 포트폴리오 항목'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">제목 *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">설명</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">카테고리 *</label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">이미지 URL *</label>
                  <input
                    required
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">썸네일 URL (선택)</label>
                  <input
                    type="url"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">태그 (콤마 구분)</label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="minimalist, matte, luxury"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_published}
                      onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    공개
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_featured}
                      onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded accent-yellow-400"
                    />
                    Featured
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editId ? '수정 완료' : '추가'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
