import { describe, it, expect } from "vitest";
import { parseInboundPayload } from "@/app/api/support/inbound/route";

describe("parseInboundPayload (provider 호환)", () => {
  it("Resend 래핑 payload({type,data}) 파싱", () => {
    const r = parseInboundPayload({
      type: "email.inbound",
      data: {
        from: '"Jane Doe" <jane@example.com>',
        to: "hello@procardcrafters.com",
        subject: "Hello",
        text: "Body here",
        message_id: "abc-123",
      },
    });
    expect(r).not.toBeNull();
    expect(r!.fromEmail).toBe("jane@example.com");
    expect(r!.fromName).toBe("Jane Doe");
    expect(r!.subject).toBe("Hello");
    expect(r!.messageId).toBe("abc-123");
  });

  it("Postmark 스타일(From/TextBody/MessageID) 파싱", () => {
    const r = parseInboundPayload({
      From: "bob@example.com",
      To: "hello@procardcrafters.com",
      Subject: "Quote",
      TextBody: "Need a quote",
      MessageID: "pm-9",
    });
    expect(r!.fromEmail).toBe("bob@example.com");
    expect(r!.bodyText).toBe("Need a quote");
    expect(r!.messageId).toBe("pm-9");
  });

  it("from 없으면 null", () => {
    expect(parseInboundPayload({ subject: "x" })).toBeNull();
  });
});
