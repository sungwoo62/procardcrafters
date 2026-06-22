import { createHmac } from 'crypto'

/**
 * procardcrafters — Instagram **Content Publishing**(organic 게시) 트랜스포트 (OMO-3742).
 *
 * 보드가 지정한 컨셉/콘텐츠(이미지+캡션)를 공식 Instagram Graph API로 @procard 피드에
 * organic 게시한다. bioridge OMO-3638 모델 재사용 — **브라우저 자동화 금지**, 공식
 * 엔드포인트만 사용(봇 휴리스틱/밴 방지).
 *
 * 게시 흐름(공식 2단계 + 폴링):
 *   1) 미디어 컨테이너 생성: POST /{ig-user-id}/media (image_url[, is_carousel_item])
 *   2) (캐러셀이면) 부모 컨테이너: POST /{ig-user-id}/media (media_type=CAROUSEL, children, caption)
 *   3) 상태 폴링: GET /{container-id}?fields=status_code → FINISHED 대기
 *   4) 게시: POST /{ig-user-id}/media_publish (creation_id) → media id
 *   5) permalink 조회: GET /{media-id}?fields=permalink
 *
 * ⚠️ 하드 전제(OMO-3742 / OMO-3737 감사): organic 게시는 **실 @procard IG가
 *   비즈니스 계정으로 BM에 연결**되어 있어야 한다. page-backed IG(PBIA)는 광고용일 뿐
 *   organic 게시 불가. 연결 전에는 자격증명/연결 미완으로 간주되어 'simulated'(드라이런)
 *   결과만 반환한다 — 실제 IG 호출 0건.
 *
 * 자격증명(서버 전용 env):
 *   PCCF_META_LONG_LIVED_TOKEN   시스템유저 장기 토큰(instagram_content_publish 스코프 필요)
 *   PCCF_META_IG_USER_ID         organic 게시 대상 = 실 @procard IG 비즈니스 계정 user id
 *                                (광고용 PBIA actor id PCCF_META_INSTAGRAM_ACTOR_ID 와 다름)
 *   PCCF_META_APP_SECRET         appsecret_proof 서명용(있으면 첨부)
 *
 * 게이트(OMO-1908/2760): 이 모듈은 트랜스포트일 뿐이다. "무엇을/언제" 게시할지는
 *   igPostQueue(사람 승인 게이트)가 통제한다. 직접 호출 금지.
 */

const API_VERSION = process.env.META_API_VERSION || 'v22.0'
const GRAPH = `https://graph.facebook.com/${API_VERSION}`

/** organic 게시 대상 @procard IG 비즈니스 계정 user id 기본값(OMO-3742 명시). */
const DEFAULT_IG_USER_ID = '17841464131369489'

interface IgCreds {
  accessToken: string
  igUserId: string
  appSecret: string
}

function igCreds(): IgCreds {
  return {
    accessToken: process.env.PCCF_META_LONG_LIVED_TOKEN || '',
    igUserId: process.env.PCCF_META_IG_USER_ID || DEFAULT_IG_USER_ID,
    appSecret: process.env.PCCF_META_APP_SECRET || '',
  }
}

/** 실제 IG 게시에 필요한 토큰이 설정돼 있는지(연결 여부와 별개의 1차 게이트). */
export function isInstagramPublishConfigured(): boolean {
  const { accessToken, igUserId } = igCreds()
  return Boolean(accessToken && igUserId)
}

function appsecretProof(token: string, secret: string): string | null {
  if (!secret) return null
  return createHmac('sha256', secret).update(token).digest('hex')
}

export interface IgPublishInput {
  /** 공개 https 이미지 URL(1장=단일 게시물, 2~10장=캐러셀). */
  imageUrls: string[]
  caption: string
}

export interface IgPublishResult {
  mode: 'simulated' | 'live'
  status: 'success' | 'failed'
  creationId: string | null
  mediaId: string | null
  permalink: string | null
  /** 드라이런 시 실제로 보낼 컨테이너 payload(감사/검증용). */
  containerPayload: Record<string, unknown> | null
  error: string | null
}

/** Graph POST(폼 인코딩) + appsecret_proof. */
async function graphPost(
  path: string,
  creds: IgCreds,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const form = new URLSearchParams()
  form.set('access_token', creds.accessToken)
  const proof = appsecretProof(creds.accessToken, creds.appSecret)
  if (proof) form.set('appsecret_proof', proof)
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    form.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message
    throw new Error(err || `IG API 오류(${res.status}) on ${path}`)
  }
  return json
}

async function graphGet(
  path: string,
  creds: IgCreds,
  fields: string
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ access_token: creds.accessToken, fields })
  const proof = appsecretProof(creds.accessToken, creds.appSecret)
  if (proof) qs.set('appsecret_proof', proof)
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`, { method: 'GET' })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message
    throw new Error(err || `IG API 오류(${res.status}) on ${path}`)
  }
  return json
}

/** 컨테이너가 FINISHED 될 때까지 폴링. ERROR/EXPIRED 면 throw. */
async function waitForContainerReady(
  containerId: string,
  creds: IgCreds,
  opts: { tries?: number; delayMs?: number } = {}
): Promise<void> {
  const tries = opts.tries ?? 12
  const delayMs = opts.delayMs ?? 3_000
  for (let i = 0; i < tries; i++) {
    const json = await graphGet(containerId, creds, 'status_code')
    const code = String(json.status_code || '')
    if (code === 'FINISHED') return
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`컨테이너 상태=${code} (${containerId})`)
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error(`컨테이너 준비 시간 초과(${containerId})`)
}

/** 단일/캐러셀 부모 컨테이너 생성에 쓸 payload를 구성(드라이런 검증과 라이브 게시 공용). */
function buildContainerPayload(
  igUserId: string,
  imageUrls: string[],
  caption: string
): { endpoint: string; payload: Record<string, unknown> } {
  if (imageUrls.length === 1) {
    return {
      endpoint: `${igUserId}/media`,
      payload: { image_url: imageUrls[0], caption },
    }
  }
  return {
    endpoint: `${igUserId}/media`,
    payload: {
      media_type: 'CAROUSEL',
      caption,
      // children 은 슬라이드 컨테이너 생성 후 채워지므로 검증 payload엔 원본 URL을 노출.
      _children_image_urls: imageUrls.slice(0, 10),
    },
  }
}

/**
 * 보드 지정 콘텐츠(이미지+캡션)를 @procard IG에 organic 게시한다.
 *
 * - 자격증명/연결 미완 → 'simulated'(실제 호출 0건) + 보낼 payload 반환(드라이런 검증).
 * - 이미지 1장 → 단일 게시물, 2~10장 → 캐러셀, 0장 → 실패.
 */
export async function publishToInstagram(
  input: IgPublishInput
): Promise<IgPublishResult> {
  const creds = igCreds()
  const imageUrls = (input.imageUrls || []).filter(Boolean).slice(0, 10)

  const base: Omit<IgPublishResult, 'mode' | 'status' | 'error'> = {
    creationId: null,
    mediaId: null,
    permalink: null,
    containerPayload: null,
  }

  if (imageUrls.length === 0) {
    return {
      ...base,
      mode: isInstagramPublishConfigured() ? 'live' : 'simulated',
      status: 'failed',
      error: '게시할 공개 이미지 URL이 없습니다.',
    }
  }

  const { payload } = buildContainerPayload(creds.igUserId, imageUrls, input.caption)

  // 드라이런: 토큰 미완이면 실제 호출 없이 payload만 반환.
  if (!isInstagramPublishConfigured()) {
    return {
      ...base,
      mode: 'simulated',
      status: 'success',
      creationId: 'SIMULATED_CONTAINER',
      mediaId: 'SIMULATED_MEDIA',
      containerPayload: payload,
      error: null,
    }
  }

  try {
    let parentContainerId: string

    if (imageUrls.length === 1) {
      const single = await graphPost(`${creds.igUserId}/media`, creds, {
        image_url: imageUrls[0],
        caption: input.caption,
      })
      parentContainerId = String(single.id)
    } else {
      const childIds: string[] = []
      for (const url of imageUrls) {
        const child = await graphPost(`${creds.igUserId}/media`, creds, {
          image_url: url,
          is_carousel_item: 'true',
        })
        childIds.push(String(child.id))
      }
      const carousel = await graphPost(`${creds.igUserId}/media`, creds, {
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: input.caption,
      })
      parentContainerId = String(carousel.id)
    }

    await waitForContainerReady(parentContainerId, creds)

    const published = await graphPost(`${creds.igUserId}/media_publish`, creds, {
      creation_id: parentContainerId,
    })
    const mediaId = String(published.id)

    let permalink: string | null = null
    try {
      const meta = await graphGet(mediaId, creds, 'permalink')
      permalink = (meta.permalink as string) || null
    } catch {
      permalink = null
    }

    return {
      ...base,
      mode: 'live',
      status: 'success',
      creationId: parentContainerId,
      mediaId,
      permalink,
      containerPayload: payload,
      error: null,
    }
  } catch (e) {
    return {
      ...base,
      mode: 'live',
      status: 'failed',
      containerPayload: payload,
      error: e instanceof Error ? e.message : 'IG 게시 실패(알 수 없는 오류).',
    }
  }
}

/**
 * organic 게시 가능 여부 점검(OMO-3742 하드 전제).
 *
 * IG user id 가 콘텐츠 게시 가능한 비즈니스/크리에이터 계정인지 Graph API로 확인한다.
 * page-backed IG(PBIA)는 username/account_type 조회가 불가하거나 organic 게시 권한이
 * 없어 여기서 걸러진다. 토큰 미설정 시 'not_configured'.
 */
export async function checkOrganicPublishReadiness(): Promise<{
  ready: boolean
  reason: string
  igUserId: string | null
  username: string | null
  accountType: string | null
}> {
  const creds = igCreds()
  if (!creds.accessToken) {
    return {
      ready: false,
      reason: 'not_configured: PCCF_META_LONG_LIVED_TOKEN 미설정',
      igUserId: creds.igUserId || null,
      username: null,
      accountType: null,
    }
  }
  try {
    const me = await graphGet(creds.igUserId, creds, 'id,username,account_type')
    const accountType = (me.account_type as string) || null
    const username = (me.username as string) || null
    // BUSINESS / MEDIA_CREATOR 만 content publishing 가능.
    const ok = accountType === 'BUSINESS' || accountType === 'MEDIA_CREATOR'
    return {
      ready: ok,
      reason: ok
        ? `ready: @${username} (${accountType})`
        : `not_ready: account_type=${accountType ?? 'unknown'} — BM에 IG 비즈니스 계정 연결 필요(PBIA는 organic 불가)`,
      igUserId: creds.igUserId,
      username,
      accountType,
    }
  } catch (e) {
    return {
      ready: false,
      reason: `not_ready: ${e instanceof Error ? e.message : '조회 실패'} — IG가 BM 자산으로 연결되지 않았을 수 있음`,
      igUserId: creds.igUserId,
      username: null,
      accountType: null,
    }
  }
}

export { buildContainerPayload }
