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

// Upload to Supabase Storage + file validation
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF, AI, PSD, PNG, JPG, TIFF files are supported' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File size must be 200MB or less' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const arrayBuffer = await file.arrayBuffer()

  // Run file validation
  const validation = await validateFile(arrayBuffer, file.type)

  // Block upload if there are critical errors
  if (!validation.isValid) {
    return NextResponse.json({
      error: 'File validation failed',
      validation: {
        errors: validation.errors,
        warnings: validation.warnings,
        details: validation.details,
      },
    }, { status: 422 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const storagePath = `print-files/${timestamp}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('print-assets')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      cacheControl: '3600',
    })

  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 })
  }

  // Record in print_files table (including validation result)
  const { data: fileRecord, error: dbError } = await supabase
    .from('print_files')
    .insert({
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
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
    return NextResponse.json({ error: `Database error: ${dbError.message}` }, { status: 500 })
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
