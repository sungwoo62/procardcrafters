import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_HOURS = 1;

function getSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface CachedRate {
  rate: number;
  fetched_at: string;
}

async function getCachedRate(
  base: string,
  target: string
): Promise<CachedRate | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("print_exchange_rates")
    .select("rate, fetched_at")
    .eq("base_currency", base)
    .eq("target_currency", target)
    .single();

  if (!data) return null;

  const ageHours =
    (Date.now() - new Date(data.fetched_at).getTime()) / 3_600_000;
  if (ageHours > CACHE_TTL_HOURS) return null;

  return data as CachedRate;
}

async function fetchLiveRate(
  base: string,
  target: string
): Promise<number> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) throw new Error("EXCHANGE_RATE_API_KEY 환경변수가 없습니다.");

  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${base}/${target}`,
    { next: { revalidate: 0 } }
  );

  if (!res.ok) {
    throw new Error(`환율 API 호출 실패: ${res.status}`);
  }

  const data = await res.json();
  if (data.result !== "success") {
    throw new Error(`환율 API 오류: ${data["error-type"]}`);
  }

  return data.conversion_rate as number;
}

async function upsertCachedRate(
  base: string,
  target: string,
  rate: number
): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("print_exchange_rates").upsert(
    {
      base_currency: base,
      target_currency: target,
      rate,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "base_currency,target_currency" }
  );
}

// GET /api/exchange-rate?base=USD&target=KRW
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") || "USD").toUpperCase();
  const target = (searchParams.get("target") || "KRW").toUpperCase();

  try {
    const cached = await getCachedRate(base, target);
    if (cached) {
      return NextResponse.json({
        base,
        target,
        rate: cached.rate,
        cachedAt: cached.fetched_at,
        source: "cache",
      });
    }

    const rate = await fetchLiveRate(base, target);
    await upsertCachedRate(base, target, rate);

    return NextResponse.json({
      base,
      target,
      rate,
      cachedAt: new Date().toISOString(),
      source: "live",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
