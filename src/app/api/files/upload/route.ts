import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateFile } from '@/lib/file-validation'

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
const RATE_LIMIT_PER_MINUTE = 5

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function checkRateLimit(
  supabase: ReturnType<typeof createServerClient>,
  ip: string,
): Promise<boolean> {
  const ipHash = await sha256Hex(ip)
  // 현재 1분 윈도우 (초 이하 버림)
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()

  const { data, error } = await supabase.rpc('increment_upload_rate_limit', {
    p_ip_hash: ipHash,
    p_window_start: windowStart,
    p_limit: RATE_LIMIT_PER_MINUTE,
  })

  if (error) {
    // DB 오류 시 fail-open (서비스 우선)
    console.error('[upload] rate limit RPC 오류:', error.message)
    return true
  }

  return data === true
}

// Upload to Supabase Storage + file validation
export async function POST(request: NextRequest) {
  const supabase = createServerClient()

  // ── 1. IP 기반 Rate Limit (IP당 분당 5건) ──────────────────────────
  const ip = getClientIp(request)
  const allowed = await checkRateLimit(supabase, ip)
  if (!allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 1분 후 다시 시도해 주세요.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(RATE_LIMIT_PER_MINUTE),
        },
      },
    )
  }

  // ── 2. 기본 입력 검증 ──────────────────────────────────────────────
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF, AI, PSD, PNG, JPG, TIFF files are supported' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File size must be 200MB or less' },
      { status: 400 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()

  // ── 3. 파일 hash 중복 검출 (동일 파일 재업로드 방지) ──────────────
  const fileHash = await sha256Hex(arrayBuffer)

  const { data: existing } = await supabase
    .from('print_files')
    .select('id, storage_path, validation_result')
    .eq('file_hash', fileHash)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    // 동일 파일이 이미 존재하면 기존 레코드 반환 (Storage 절약)
    return NextResponse.json({
      fileId: existing.id,
      storagePath: existing.storage_path,
      deduplicated: true,
      validation: existing.validation_result ?? { isValid: true, warnings: [], details: {} },
    })
  }

  // ── 4. 파일 콘텐츠 검증 ───────────────────────────────────────────
  const validation = await validateFile(arrayBuffer, file.type)

  if (!validation.isValid) {
    return NextResponse.json(
      {
        error: 'File validation failed',
        validation: {
          errors: validation.errors,
          warnings: validation.warnings,
          details: validation.details,
        },
      },
      { status: 422 },
    )
  }

  // ── 5. Supabase Storage 업로드 ────────────────────────────────────
  const ext = file.name.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const storagePath = `print-files/${timestamp}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('print-assets')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '3600',
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    )
  }

  // ── 6. DB 기록 (file_hash 포함) ───────────────────────────────────
  const { data: fileRecord, error: dbError } = await supabase
    .from('print_files')
    .insert({
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      file_hash: fileHash,
      status: 'uploaded',
      validation_result: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        errors: validation.errors,
        details: validation.details,
      },
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json(
      { error: `Database error: ${dbError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    fileId: fileRecord.id,
    storagePath,
    validation: {
      isValid: validation.isValid,
      warnings: validation.warnings,
      details: validation.details,
    },
  })
}
