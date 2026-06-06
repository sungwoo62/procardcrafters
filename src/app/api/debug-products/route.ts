import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    return NextResponse.json({ error: 'missing env', url: !!url, key: !!key })
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/print_products?select=slug,hero_image_url&is_active=eq.true&limit=3`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
    )
    const text = await res.text()
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      url: url.slice(0, 30) + '…',
      keyLen: key.length,
      srkSet: !!srk,
      body: text.slice(0, 300),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) })
  }
}
