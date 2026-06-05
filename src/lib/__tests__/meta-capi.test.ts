import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendCapiEvent, extractClientSignals } from "../meta-capi";

describe("extractClientSignals", () => {
  it("프록시 헤더에서 IP/UA 와 _fbp/_fbc 쿠키 추출", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 70.41.3.18",
      "user-agent": "Mozilla/5.0 (test)",
      cookie:
        "_fbp=fb.1.1700000000.123; _fbc=fb.1.1700000000.AbcDef; other=value",
    });
    const out = extractClientSignals(headers);
    expect(out.ip).toBe("203.0.113.7");
    expect(out.userAgent).toBe("Mozilla/5.0 (test)");
    expect(out.fbp).toBe("fb.1.1700000000.123");
    expect(out.fbc).toBe("fb.1.1700000000.AbcDef");
  });

  it("쿠키 미존재 시 null 반환", () => {
    const headers = new Headers({ "user-agent": "ua" });
    const out = extractClientSignals(headers);
    expect(out.fbp).toBeNull();
    expect(out.fbc).toBeNull();
    expect(out.userAgent).toBe("ua");
  });
});

describe("sendCapiEvent", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.META_PIXEL_ID = "111";
    process.env.META_CAPI_ACCESS_TOKEN = "tkn";
    process.env.PCCF_META_APP_SECRET = "secret";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("env 미설정 시 silently skip", async () => {
    process.env.META_CAPI_ACCESS_TOKEN = "";
    delete process.env.PCCF_META_LONG_LIVED_TOKEN;
    const r = await sendCapiEvent({
      eventName: "Lead",
      eventId: "evt-1",
      eventSourceUrl: "https://procardcrafters.com/beta-tester",
      userData: { email: "x@y.com" },
    });
    expect(r.ok).toBe(false);
  });

  it("이메일을 SHA256 hex 로 해시해서 전송", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events_received: 1, fbtrace_id: "tr1" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const r = await sendCapiEvent({
      eventName: "Lead",
      eventId: "evt-2",
      eventSourceUrl: "https://procardcrafters.com/beta-tester",
      userData: { email: "Test@Example.com", phone: "+1 (555) 123-4567" },
      customData: { content_name: "beta_tester_landing" },
    });

    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("graph.facebook.com/v22.0/111/events");
    const body = JSON.parse((init as RequestInit).body as string);
    const ud = body.data[0].user_data;
    // SHA256("test@example.com") = 973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b
    expect(ud.em[0]).toBe(
      "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b"
    );
    // SHA256("15551234567") — digits only
    expect(ud.ph[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data[0].event_id).toBe("evt-2");
    expect(body.data[0].action_source).toBe("website");
  });
});
