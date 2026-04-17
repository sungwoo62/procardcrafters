import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/illustrator',
  'application/postscript',
  'image/vnd.adobe.photoshop',
  'image/png',
  'image/jpeg',
  'image/tiff',
]

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024 // 200MB

// Supabase Storage에 직접 업로드 (서버 사이드)
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'PDF, AI, PSD, PNG, JPG, TIFF 파일만 지원합니다' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: '파일 크기는 200MB 이하여야 합니다' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  const ext = file.name.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const storagePath = `print-files/${timestamp}-${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('print-assets')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '3600',
    })

  if (error) {
    return NextResponse.json({ error: `업로드 실패: ${error.message}` }, { status: 500 })
  }

  // print_files 테이블에 기록
  const { data: fileRecord, error: dbError } = await supabase
    .from('print_files')
    .insert({
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      status: 'uploaded',
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: `DB 기록 실패: ${dbError.message}` }, { status: 500 })
  }

  return NextResponse.json({ fileId: fileRecord.id, storagePath })
}
