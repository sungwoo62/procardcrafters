// OMO-3690 · Ad Studio 이미지 프로덕션 라우트.
// GOOGLE_GEMINI_API_KEY 로 Gemini 이미지 모델(nano-banana) 호출 → PNG 생성 →
// Supabase Storage 공개 버킷(studio-ads)에 업로드 → public URL 반환.
// 보호: x-studio-secret 헤더 === STUDIO_GEN_SECRET. (대외발송 아님, 내부 콘텐츠 생성)
// 컴플라이언스: 프롬프트에서 텍스트/로고/스탯 합성 금지(OMO-2760/2975). 대외 노출은 사람 승인 게이트.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  INSTAGRAM_POSTS,
  buildImagePrompt,
  STUDIO_IMAGE_BUCKET,
  type InstagramPost,
} from '@/config/adStudio'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// 우선순위 후보 모델(앞에서부터 시도, 404/400 시 다음).
const IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
]

function authed(req: NextRequest): boolean {
  const secret = process.env.STUDIO_GEN_SECRET
  if (!secret) return false
  return req.headers.get('x-studio-secret') === secret
}

interface GenResult {
  base64: string
  mime: string
  model: string
}

async function generateImage(prompt: string, apiKey: string): Promise<GenResult> {
  let lastErr = ''
  for (const model of IMAGE_MODELS) {
    // 일부 모델은 IMAGE 단독, 일부는 TEXT+IMAGE modalities 요구 → 순차 시도.
    for (const modalities of [['IMAGE'], ['TEXT', 'IMAGE']]) {
      try {
        const res = await fetch(
          `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: modalities },
            }),
          },
        )
        const json = await res.json()
        if (!res.ok) {
          lastErr = `${model}[${modalities.join('+')}] ${res.status} ${JSON.stringify(json?.error?.message ?? json).slice(0, 240)}`
          continue
        }
        const parts = json?.candidates?.[0]?.content?.parts ?? []
        const img = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p?.inlineData?.data)
        if (img?.inlineData?.data) {
          return {
            base64: img.inlineData.data,
            mime: img.inlineData.mimeType || 'image/png',
            model,
          }
        }
        lastErr = `${model}[${modalities.join('+')}] no inlineData in response`
      } catch (e) {
        lastErr = `${model}[${modalities.join('+')}] ${(e as Error).message}`
      }
    }
  }
  throw new Error(`image generation failed — ${lastErr}`)
}

async function ensureBucket(supabase: ReturnType<typeof createServerClient>) {
  // 멱등: 이미 있으면 에러 무시. 공개 버킷(내부 스튜디오 노출용).
  const { data } = await supabase.storage.getBucket(STUDIO_IMAGE_BUCKET)
  if (data) return
  await supabase.storage.createBucket(STUDIO_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: '8MB',
  })
}

// GET ?diag=1 → 사용 가능한 이미지 생성 모델 진단(키 노출 없음).
export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY not set' }, { status: 500 })

  const res = await fetch(`${GEMINI_BASE}/models?key=${apiKey}&pageSize=200`)
  const json = await res.json()
  if (!res.ok) return NextResponse.json({ error: json }, { status: res.status })
  const models = (json.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[]; name?: string }) =>
      (m.name ?? '').includes('image') ||
      (m.supportedGenerationMethods ?? []).includes('predict'),
    )
    .map((m: { name?: string; supportedGenerationMethods?: string[] }) => ({
      name: m.name,
      methods: m.supportedGenerationMethods,
    }))
  return NextResponse.json({ ok: true, candidateModels: IMAGE_MODELS, imageModels: models })
}

// POST { id } → 해당 IG 항목 1장 생성·업로드. 클라이언트 루프가 항목별 호출(서버 타임아웃 회피).
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY not set' }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { id?: string; prompt?: string }
  const id = body.id
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const post = INSTAGRAM_POSTS.find((p: InstagramPost) => p.id === id)
  if (!post) return NextResponse.json({ error: `unknown id ${id}` }, { status: 404 })

  const prompt = body.prompt || buildImagePrompt(post)

  let gen: GenResult
  try {
    gen = await generateImage(prompt, apiKey)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }

  const supabase = createServerClient()
  try {
    await ensureBucket(supabase)
  } catch {
    /* 버킷 보장 실패는 업로드 단계에서 다시 표면화 */
  }

  const buffer = Buffer.from(gen.base64, 'base64')
  const path = `procard/${id}.png`
  const { error: upErr } = await supabase.storage
    .from(STUDIO_IMAGE_BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (upErr) {
    return NextResponse.json({ error: `upload failed: ${upErr.message}` }, { status: 500 })
  }

  const { data } = supabase.storage.from(STUDIO_IMAGE_BUCKET).getPublicUrl(path)
  return NextResponse.json({
    ok: true,
    id,
    url: data.publicUrl,
    model: gen.model,
    bytes: buffer.length,
  })
}
