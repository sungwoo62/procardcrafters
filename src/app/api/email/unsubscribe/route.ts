// 이메일 수신거부 (opt-out) — OMO-2423
// 메일 푸터 링크. 누구나 GET으로 호출 가능 (이메일 자체가 토큰 역할).

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getServiceSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("email");
  const email = raw?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "email 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = getServiceSupabase();
  await supabase
    .from("print_email_unsubscribes")
    .upsert(
      { email, source: "link" },
      { onConflict: "email", ignoreDuplicates: true }
    );

  return NextResponse.json({
    ok: true,
    message: "수신거부 처리되었습니다.",
  });
}
