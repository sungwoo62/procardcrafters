import { createServerClient } from '@/lib/supabase'
import {
  publishToInstagram,
  checkOrganicPublishReadiness,
} from '@/lib/marketing/instagramPublish'

/**
 * procardcrafters @procard IG organic 게시 큐 + 사람 승인 게이트 (OMO-3742).
 *
 * 보드가 컨셉/콘텐츠(이미지+캡션)를 지정하면 `pending_approval` 로 적재되고,
 * 사람(사장님 업무 계정 등)이 승인(`approved`)한 건만 IG 트랜스포트로 넘어간다.
 * 고객접점 정책(OMO-2760) — 대외 콘텐츠 사람 승인 게이트 필수.
 *
 * 라이브 게시는 추가로 organic 연결 게이트(OMO-3737)를 통과해야 한다:
 *   실 @procard IG 가 BM 비즈니스 계정으로 연결되기 전에는 dry-run만 가능.
 */

export type IgPostStatus =
  | 'pending_approval'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'

export interface IgPostRow {
  id: string
  concept: string
  caption: string
  image_urls: string[]
  status: IgPostStatus
  approved_by: string | null
  approved_at: string | null
  mode: 'simulated' | 'live' | null
  creation_id: string | null
  media_id: string | null
  permalink: string | null
  publish_error: string | null
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** 보드 지정 콘텐츠를 승인 대기 상태로 적재. */
export async function enqueueIgPost(input: {
  concept: string
  caption: string
  imageUrls: string[]
  createdBy?: string
}): Promise<IgPostRow> {
  const db = createServerClient()
  const { data, error } = await db
    .from('pccf_ig_posts')
    .insert({
      concept: input.concept,
      caption: input.caption,
      image_urls: input.imageUrls,
      created_by: input.createdBy ?? 'board',
      status: 'pending_approval',
    })
    .select('*')
    .single()
  if (error) throw new Error(`IG 게시 큐 적재 실패: ${error.message}`)
  return data as IgPostRow
}

/** 사람 승인 게이트(OMO-2760). 승인자 식별 필수. */
export async function approveIgPost(
  id: string,
  approvedBy: string
): Promise<IgPostRow> {
  if (!approvedBy) throw new Error('승인자(approvedBy)가 필요합니다 — 사람 승인 게이트.')
  const db = createServerClient()
  const { data, error } = await db
    .from('pccf_ig_posts')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_approval')
    .select('*')
    .single()
  if (error) throw new Error(`IG 게시 승인 실패: ${error.message}`)
  return data as IgPostRow
}

/**
 * 승인된 게시물 1건을 IG로 디스패치.
 *
 * 게이트:
 *   1) status === 'approved' 가 아니면 거부(사람 승인 게이트).
 *   2) organic 연결 미완(OMO-3737)이면 dry-run으로만 진행 — 실제 호출 0건.
 *   3) `force` 없이 라이브 게시가 불가하면 'simulated' 결과로 기록.
 */
export async function dispatchIgPost(id: string): Promise<IgPostRow> {
  const db = createServerClient()

  const { data: post, error: fetchErr } = await db
    .from('pccf_ig_posts')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !post) throw new Error(`게시물 조회 실패: ${fetchErr?.message ?? '없음'}`)
  const row = post as IgPostRow

  if (row.status !== 'approved') {
    throw new Error(
      `게시 불가: status=${row.status} (승인된 게시물만 디스패치 가능 — OMO-2760)`
    )
  }

  // organic 연결 게이트(OMO-3737) — 미완이면 트랜스포트가 자동으로 simulated 반환.
  const readiness = await checkOrganicPublishReadiness()

  await db.from('pccf_ig_posts').update({ status: 'publishing' }).eq('id', id)

  const result = await publishToInstagram({
    imageUrls: row.image_urls,
    caption: row.caption,
  })

  const nextStatus: IgPostStatus =
    result.status === 'success' && result.mode === 'live' ? 'published' : 'failed'

  // organic 연결 미완으로 simulated 인 경우, 실패가 아니라 게이트 상태임을 명시.
  const publishError =
    result.status === 'success' && result.mode === 'simulated'
      ? `게이트: organic 연결 미완 — ${readiness.reason}`
      : result.error

  const finalStatus: IgPostStatus =
    result.mode === 'simulated' ? 'approved' : nextStatus // simulated면 승인상태 유지(재시도 가능)

  const { data: updated, error: updErr } = await db
    .from('pccf_ig_posts')
    .update({
      status: finalStatus,
      mode: result.mode,
      creation_id: result.creationId,
      media_id: result.mediaId,
      permalink: result.permalink,
      publish_error: publishError,
      published_at: nextStatus === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (updErr) throw new Error(`게시 결과 기록 실패: ${updErr.message}`)
  return updated as IgPostRow
}

/** 승인 대기 목록. */
export async function listPendingIgPosts(): Promise<IgPostRow[]> {
  const db = createServerClient()
  const { data, error } = await db
    .from('pccf_ig_posts')
    .select('*')
    .eq('status', 'pending_approval')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`목록 조회 실패: ${error.message}`)
  return (data ?? []) as IgPostRow[]
}
