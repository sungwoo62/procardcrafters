// OMO-2774: 고관여/민감 문의 휴리스틱 분류기 (가드레일)
//
// AI 판단과 별개로, 결정적(deterministic) 키워드 기반 분류를 한 번 더 돌려
// 환불/법적/대량/도매 같은 고관여 문의는 무조건 사람 검토 큐로 보낸다.
// AI가 "괜찮다"고 해도 이 분류기가 escalate 하면 자동발송하지 않는다.

export type EscalationReason =
  | "refund_or_chargeback"
  | "legal"
  | "bulk_or_wholesale"
  | "complaint"
  | "press_or_partnership";

const PATTERNS: { reason: EscalationReason; re: RegExp }[] = [
  {
    reason: "refund_or_chargeback",
    re: /\b(refund|chargeback|charge ?back|dispute|money back|reimburse|cancel(l)?ed? my order|never received|did ?n'?t (arrive|receive))\b/i,
  },
  {
    reason: "legal",
    re: /\b(lawyer|attorney|legal|lawsuit|sue|liability|gdpr|ccpa|cease and desist|copyright|trademark infring)/i,
  },
  {
    reason: "bulk_or_wholesale",
    re: /\b(wholesale|bulk|reseller|distributor|net ?\d+ terms|purchase order|\bPO\b|tax exempt|\b(\d{1,3},?\d{3,}|[5-9]\d{2,})\s*(units|pcs|pieces|cards|copies)\b|enterprise|corporate account)/i,
  },
  {
    reason: "complaint",
    re: /\b(terrible|awful|worst|unacceptable|furious|angry|scam|fraud|report you|bbb|better business bureau|leave a (bad|1[\- ]star) review)\b/i,
  },
  {
    reason: "press_or_partnership",
    re: /\b(press|journalist|media inquiry|partnership|sponsor|collaborat(e|ion)|affiliate program)\b/i,
  },
];

export interface ClassifyResult {
  escalate: boolean;
  reasons: EscalationReason[];
}

/**
 * 메일 제목+본문을 받아 고관여 사유를 탐지한다.
 */
export function classifyInbound(subject: string, body: string): ClassifyResult {
  const haystack = `${subject || ""}\n${body || ""}`;
  const reasons: EscalationReason[] = [];
  for (const { reason, re } of PATTERNS) {
    if (re.test(haystack)) reasons.push(reason);
  }
  return { escalate: reasons.length > 0, reasons };
}

export function reasonsToText(reasons: EscalationReason[]): string {
  const labels: Record<EscalationReason, string> = {
    refund_or_chargeback: "Refund/chargeback",
    legal: "Legal",
    bulk_or_wholesale: "Bulk/wholesale",
    complaint: "Complaint",
    press_or_partnership: "Press/partnership",
  };
  return reasons.map((r) => labels[r]).join(", ");
}
