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

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024

interface RouteContext {
  params: Promise<{ fileId: string }>
}

// Replace a rejected file — verifies ownership via orderNumber
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { fileId } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const orderNumber = formData.get('orderNumber') as string | null

  if (!file || !orderNumber) {
    return NextResponse.json({ error: 'file and orderNumber are required' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF, AI, PSD, PNG, JPG, TIFF files are supported' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File size must be 200MB or less' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Verify the file belongs to the claimed order
  const { data: existing, error: fetchError } = await supabase
    .from('print_files')
    .select('id, status, storage_path, print_orders!left(order_number)')
    .eq('id', fileId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  type FileWithOrder = { status: string; storage_path: string; print_orders?: { order_number?: string } | null }
  const fileRecord = existing as FileWithOrder

  if (fileRecord.status !== 'rejected') {
    return NextResponse.json({ error: 'Only rejected files can be replaced' }, { status: 409 })
  }

  if (fileRecord.print_orders?.order_number !== orderNumber) {
    return NextResponse.json({ error: 'Order number does not match' }, { status: 403 })
  }

  const arrayBuffer = await file.arrayBuffer()

  const validation = await validateFile(arrayBuffer, file.type)
  if (!validation.isValid) {
    return NextResponse.json({
      error: 'File validation failed',
      validation: { errors: validation.errors, warnings: validation.warnings, details: validation.details },
    }, { status: 422 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const newPath = `print-files/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('print-assets')
    .upload(newPath, arrayBuffer, { contentType: file.type, cacheControl: '3600' })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  // Delete old file from storage (best-effort)
  await supabase.storage.from('print-assets').remove([fileRecord.storage_path]).catch(() => null)

  const { data: updated, error: updateError } = await supabase
    .from('print_files')
    .update({
      storage_path: newPath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      status: 'uploaded',
      rejection_reason: null,
      validation_result: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        errors: validation.errors,
        details: validation.details,
      },
    })
    .eq('id', fileId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: `Database error: ${updateError.message}` }, { status: 500 })
  }

  return NextResponse.json({ file: updated })
}
