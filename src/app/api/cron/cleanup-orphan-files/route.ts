import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const maxDuration = 60

// 24h 이상 된 고아 파일(order_id 미연결) 자동 정리
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 24h 이상 된 고아 파일 조회 (최대 100건씩 처리)
  const { data: orphans, error: fetchError } = await supabase
    .from('print_files')
    .select('id, storage_path')
    .is('order_id', null)
    .lt('uploaded_at', cutoff)
    .limit(100)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!orphans?.length) {
    return NextResponse.json({ deleted: 0, message: '정리할 고아 파일 없음' })
  }

  const storagePaths = orphans.map((f) => f.storage_path)
  const fileIds = orphans.map((f) => f.id)

  // Storage에서 삭제
  const { error: storageError } = await supabase.storage
    .from('print-assets')
    .remove(storagePaths)

  if (storageError) {
    console.error('[cleanup] Storage 삭제 오류:', storageError.message)
    // Storage 오류가 있어도 DB 레코드는 계속 삭제 (고아 레코드 제거 우선)
  }

  // DB에서 삭제
  const { error: dbError } = await supabase
    .from('print_files')
    .delete()
    .in('id', fileIds)

  if (dbError) {
    return NextResponse.json(
      { error: `DB 삭제 오류: ${dbError.message}`, storageDeleted: storagePaths.length },
      { status: 500 },
    )
  }

  // rate limit 오래된 레코드도 정리 (1일 이상 된 항목)
  const rlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('print_upload_rate_limits')
    .delete()
    .lt('window_start', rlCutoff)

  return NextResponse.json({
    deleted: fileIds.length,
    storagePaths,
    message: `고아 파일 ${fileIds.length}건 삭제 완료`,
  })
}
