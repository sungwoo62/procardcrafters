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
 * 자격증명(서버 전용 env — OMO-3737에서 확보·검증):
 *   PCCF_META_IG_PUBLISH_TOKEN     allpack-ai 시스템유저 토큰(비만료, app 1337409018349199,
 *                                  instagram_content_publish). procard 자체 토큰 아님(보드 지정).
 *   PCCF_META_INSTAGRAM_ACTOR_ID   organic 게시 대상 = 실 @procard IG 비즈니스 user id
 *                                  (=17841464131369489). content_publishing_limit 검증 완료(100/일).
 *   (구 키 PCCF_META_LONG_LIVED_TOKEN / PCCF_META_IG_USER_ID 는 폴백으로만 인정)
 *
 * ⚠️ appsecret_proof 미전송: 이 발행 앱(allpack-ai)은 appsecret_proof 불요이며(OMO-3737
 *   라이브 검증), 다른 앱 시크릿으로 계산한 proof를 보내면 오히려 인증이 깨진다. 보내지 않는다.
 *
 * 게이트(OMO-1908/2760): 이 모듈은 트랜스포트일 뿐이다. "무엇을/언제" 게시할지는
 *   igPostQueue(사람 승인 게이트)가 통제한다. 직접 호출 금지.
 */

const API_VERSION = process.env.META_API_VERSION || 'v22.0'
const GRAPH = `https://graph.facebook.com/${API_VERSION}`

/** organic 게시 대상 @procard IG 비즈니스 계정 user id 기본값(OMO-3742/3737 명시). */
const DEFAULT_IG_USER_ID = '17841464131369489'

interface IgCreds {
  accessToken: string
  igUserId: string
}

function igCreds(): IgCreds {
  return {
    // OMO-3737 확정 키 우선, 구 키는 폴백.
    accessToken:
      process.env.PCCF_META_IG_PUBLISH_TOKEN ||
      process.env.PCCF_META_LONG_LIVED_TOKEN ||
      '',
    igUserId:
      process.env.PCCF_META_INSTAGRAM_ACTOR_ID ||
      process.env.PCCF_META_IG_USER_ID ||
      DEFAULT_IG_USER_ID,
  }
}

/** 실제 IG 게시에 필요한 토큰이 설정돼 있는지(연결 여부와 별개의 1차 게이트). */
export function isInstagramPublishConfigured(): boolean {
  const { accessToken, igUserId } = igCreds()
  return Boolean(accessToken && igUserId)
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
  // appsecret_proof 미전송(allpack-ai 발행 앱은 불요 — OMO-3737 검증).
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
 * IG user id 의 `content_publishing_limit`(일일 게시 한도)를 조회한다. 이 엔드포인트가
 * 정상 응답하면 해당 IG가 Content Publishing API 대상으로 연결돼 있음을 의미한다
 * (OMO-3737 라이브 검증: quota 100/일). PBIA/미연결 계정은 오류로 걸러진다.
 * 토큰 미설정 시 'not_configured'.
 */
export async function checkOrganicPublishReadiness(): Promise<{
  ready: boolean
  reason: string
  igUserId: string | null
  quotaTotal: number | null
  quotaUsage: number | null
}> {
  const creds = igCreds()
  if (!creds.accessToken) {
    return {
      ready: false,
      reason: 'not_configured: PCCF_META_IG_PUBLISH_TOKEN 미설정',
      igUserId: creds.igUserId || null,
      quotaTotal: null,
      quotaUsage: null,
    }
  }
  try {
    const limit = await graphGet(
      `${creds.igUserId}/content_publishing_limit`,
      creds,
      'quota_usage,config'
    )
    const row = Array.isArray(limit.data) ? limit.data[0] : limit
    const quotaUsage = Number((row as Record<string, unknown>)?.quota_usage ?? 0)
    const config = (row as { config?: { quota_total?: number } })?.config
    const quotaTotal = Number(config?.quota_total ?? 0) || null
    return {
      ready: true,
      reason: `ready: content_publishing_limit 응답 OK (사용 ${quotaUsage}/${quotaTotal ?? '?'} 일일)`,
      igUserId: creds.igUserId,
      quotaTotal,
      quotaUsage,
    }
  } catch (e) {
    return {
      ready: false,
      reason: `not_ready: ${e instanceof Error ? e.message : '조회 실패'} — IG가 Content Publishing 대상으로 연결되지 않았거나 토큰 권한 부족`,
      igUserId: creds.igUserId,
      quotaTotal: null,
      quotaUsage: null,
    }
  }
}

export { buildContainerPayload }
