import { describe, it, expect } from "vitest";
import { classifyInbound } from "../classify";

describe("classifyInbound (고관여 휴리스틱)", () => {
  it("일반 제품 문의는 escalate=false", () => {
    const r = classifyInbound(
      "Question about business cards",
      "Hi, what paper options do you offer for business cards and how long is turnaround?"
    );
    expect(r.escalate).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it("환불/chargeback 문의 → escalate", () => {
    const r = classifyInbound("Refund please", "I want a refund for my order, it never arrived.");
    expect(r.escalate).toBe(true);
    expect(r.reasons).toContain("refund_or_chargeback");
  });

  it("법적 표현 → escalate", () => {
    const r = classifyInbound("Legal notice", "My attorney will contact you regarding a lawsuit.");
    expect(r.reasons).toContain("legal");
  });

  it("대량/도매 문의 → escalate", () => {
    const r = classifyInbound("Wholesale", "We need 5000 business cards on net 30 terms, wholesale pricing?");
    expect(r.reasons).toContain("bulk_or_wholesale");
  });

  it("강한 불만 → escalate", () => {
    const r = classifyInbound("This is unacceptable", "Worst service ever, this is a scam, I will report you.");
    expect(r.reasons).toContain("complaint");
  });
});
