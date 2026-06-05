// Meta Conversions API v22 — server-side Lead/CompleteRegistration 이벤트 (OMO-2427)
// 픽셀(브라우저)과 동일 event_id 로 dedup. PII 는 SHA256 해시 후 전송.
//
// docs: https://developers.facebook.com/docs/marketing-api/conversions-api

import { createHash, createHmac } from "crypto";

const META_API_BASE = "https://graph.facebook.com/v22.0";

function getPixelId(): string {
  return (
    process.env.META_PIXEL_ID ??
    process.env.NEXT_PUBLIC_META_PIXEL_ID ??
    "1421706653319003" // PCCF Auto Pixel
  );
}

function getAccessToken(): string {
  return (
    process.env.META_CAPI_ACCESS_TOKEN ??
    process.env.PCCF_META_LONG_LIVED_TOKEN ??
    ""
  );
}

function sha256(input: string): string {
  return createHash("sha256")
    .update(input.trim().toLowerCase())
    .digest("hex");
}

function appsecretProof(token: string): string | undefined {
  const appSecret = process.env.PCCF_META_APP_SECRET ?? "";
  if (!appSecret || !token) return undefined;
  return createHmac("sha256", appSecret).update(token).digest("hex");
}

export type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null; // _fbp 쿠키
  fbc?: string | null; // _fbc 쿠키
};

export type CapiEvent = {
  eventName: "Lead" | "CompleteRegistration" | "ViewContent";
  eventId: string;
  eventSourceUrl: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
  /** 미지정 시 현재 시각 (unix seconds). 브라우저 픽셀과 동일 시각으로 맞추려면 명시. */
  eventTimeSec?: number;
};

export type CapiResult =
  | { ok: true; eventsReceived: number; fbtrace_id?: string }
  | { ok: false; reason: string; status?: number };

/**
 * Meta CAPI에 단일 서버 이벤트 전송.
 * 미설정 env(액세스 토큰/픽셀 ID) 또는 미설정 PII 일 경우 silently skip.
 */
export async function sendCapiEvent(event: CapiEvent): Promise<CapiResult> {
  const pixelId = getPixelId();
  const accessToken = getAccessToken();
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;
  if (!pixelId) return { ok: false, reason: "META_PIXEL_ID 미설정" };
  if (!accessToken)
    return { ok: false, reason: "META_CAPI_ACCESS_TOKEN 미설정" };

  const eventTime = event.eventTimeSec ?? Math.floor(Date.now() / 1000);

  const user_data: Record<string, unknown> = {};
  if (event.userData.email) user_data.em = [sha256(event.userData.email)];
  if (event.userData.phone) {
    const digits = event.userData.phone.replace(/[^\d]/g, "");
    if (digits) user_data.ph = [sha256(digits)];
  }
  if (event.userData.clientIp) user_data.client_ip_address = event.userData.clientIp;
  if (event.userData.userAgent) user_data.client_user_agent = event.userData.userAgent;
  if (event.userData.fbp) user_data.fbp = event.userData.fbp;
  if (event.userData.fbc) user_data.fbc = event.userData.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: eventTime,
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        user_data,
        ...(event.customData ? { custom_data: event.customData } : {}),
      },
    ],
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  const url = new URL(`${META_API_BASE}/${pixelId}/events`);
  url.searchParams.set("access_token", accessToken);
  const proof = appsecretProof(accessToken);
  if (proof) url.searchParams.set("appsecret_proof", proof);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // CAPI 는 best-effort, signup 응답 지연 방지를 위해 짧은 타임아웃
      signal: AbortSignal.timeout(5000),
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (json.error as Record<string, unknown> | undefined) ?? {};
      const message = (err.message as string) ?? `HTTP ${res.status}`;
      return { ok: false, reason: message, status: res.status };
    }

    return {
      ok: true,
      eventsReceived: Number(json.events_received ?? 0),
      fbtrace_id: json.fbtrace_id as string | undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown CAPI error";
    return { ok: false, reason: message };
  }
}

/** Next.js Request 에서 클라이언트 IP/UA 추출 (Vercel edge headers 우선) */
export function extractClientSignals(headers: Headers): {
  ip: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
} {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    headers.get("x-real-ip") ??
    (forwarded ? forwarded.split(",")[0]?.trim() ?? null : null);
  const userAgent = headers.get("user-agent");

  const cookieHeader = headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(/;\s*/)
      .filter(Boolean)
      .map((kv) => {
        const idx = kv.indexOf("=");
        if (idx === -1) return [kv, ""];
        return [kv.slice(0, idx), decodeURIComponent(kv.slice(idx + 1))];
      })
  ) as Record<string, string>;

  return {
    ip,
    userAgent,
    fbp: cookies._fbp ?? null,
    fbc: cookies._fbc ?? null,
  };
}
