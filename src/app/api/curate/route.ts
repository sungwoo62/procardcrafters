// OMO-3265: AI 큐레이션 API.
//  - 프리셋 후킹(mode=premium|value|cheap): 결정론적 휴리스틱(LLM 미사용, 즉시 응답).
//  - 자유 입력(intent): Claude 로 의도 해석 → 제품 2~3종 추천. 가격은 서버 산정값만 사용.
// 어느 경로든 결과는 /order 딥링크를 포함해 "바로 주문" 전환을 노린다.
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import {
  loadCurationCatalog,
  heuristicCuration,
  toPick,
  type CurationMode,
  type CurationResult,
  type CurationProduct,
} from '@/lib/curation/products'
import { FINISHING_CATALOG } from '@/config/finishing-catalog'

export const dynamic = 'force-dynamic'

const MODES: CurationMode[] = ['premium', 'value', 'cheap']

interface RawPick {
  slug: string
  tier: string
  hook: string
  why: string
  finishing?: string[]
  quantity?: number | null
}

function buildSystemPrompt(catalog: CurationProduct[]): string {
  const products = catalog
    .map((p) => `- ${p.slug} | ${p.name} | category=${p.category} | premium=${p.isPremium} | from=$${p.fromUsd}`)
    .join('\n')
  const finishes = FINISHING_CATALOG.map((f) => `- ${f.value} | ${f.label_en} | fits=${f.fits.join(',')}`).join('\n')

  return `You are the AI product curator for Procardcrafters, a premium online print shop.
A customer describes what they want in their own words. Build a short, compelling curation of 2-3 products that nails their intent and makes them want to order now.

CATALOG (choose ONLY from these slugs):
${products}

FINISHING OPTIONS (recommend ONLY these values, only when they genuinely fit the picked product's category):
${finishes}

Rules:
- Pick 2-3 products. Order them best-fit first.
- Match the customer's vibe: luxury/no-budget → premium products + luxury finishes; value → premium feel at a fair price; cheapest → lowest "from" price.
- "tier": a punchy 1-3 word label, e.g. "Top-Tier", "Best Value", "Lowest Price", "Editor's Pick".
- "hook": a punchy benefit headline, max 12 words, no period.
- "why": one sentence (max 22 words) on why it fits THIS customer.
- "finishing": array of finishing values from the list (only if they fit the product category), or [].
- "quantity": a sensible round quantity (e.g. 200, 500, 1000) or null.
- Never invent slugs or finishing values. Never mention prices in text (the UI shows them).

Respond with ONLY valid JSON, no markdown, in this exact shape:
{"summary":"<one friendly sentence reading back what they want>","picks":[{"slug":"","tier":"","hook":"","why":"","finishing":[],"quantity":null}]}`
}

function formatResult(
  catalog: CurationProduct[],
  summary: string,
  rawPicks: RawPick[],
  heuristic: boolean,
): CurationResult {
  const picks = rawPicks
    .map((r) => toPick(catalog, r))
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .slice(0, 3)
  return { summary, heuristic, picks }
}

export async function POST(req: NextRequest) {
  let body: { intent?: string; mode?: string; group?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const { intent, mode, group } = body

  const catalog = await loadCurationCatalog()
  if (!catalog.length) {
    return NextResponse.json({ error: 'No products are available right now.' }, { status: 503 })
  }

  // 1) 프리셋 후킹 — 결정론적, 항상 동작.
  if (mode && (MODES as string[]).includes(mode)) {
    return NextResponse.json(heuristicCuration(catalog, mode as CurationMode, group))
  }

  if (!intent || typeof intent !== 'string' || !intent.trim()) {
    return NextResponse.json({ error: 'Tell us what you are looking for.' }, { status: 400 })
  }

  // 2) 자유 입력 — LLM. 키 없거나 실패 시 가성비 휴리스틱으로 우아하게 폴백.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(heuristicCuration(catalog, 'value', group))
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system: buildSystemPrompt(catalog),
      messages: [
        { role: 'user', content: intent.slice(0, 600) },
        { role: 'assistant', content: '{' }, // JSON 프리필로 출력 강제
      ],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse('{' + text) as { summary?: string; picks?: RawPick[] }
    const result = formatResult(
      catalog,
      parsed.summary?.trim() || 'Here is a curation matched to what you described.',
      Array.isArray(parsed.picks) ? parsed.picks : [],
      false,
    )
    // LLM이 유효 제품을 못 골랐으면 휴리스틱으로 폴백.
    if (!result.picks.length) {
      return NextResponse.json(heuristicCuration(catalog, 'value', group))
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(heuristicCuration(catalog, 'value', group))
  }
}
