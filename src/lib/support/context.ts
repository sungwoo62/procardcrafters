// OMO-2774: PCCF 고객지원 AI 1차 회신용 컨텍스트(카탈로그 + FAQ)
//
// AI 초안 생성 시 system prompt 로 주입되는 "사실 근거(grounding)".
// 추측을 막기 위해, 여기에 명시되지 않은 가격/납기/정책은 AI가 단정하지 말고
// 에스컬레이션하도록 프롬프트가 지시한다. (classify.ts 와 함께 가드레일 구성)

export const PCCF_BRAND = "ProCardCrafters";
export const PCCF_SUPPORT_EMAIL = "hello@procardcrafters.com";
export const PCCF_SITE_URL = "https://procardcrafters.com";

/**
 * 영어 1차 회신을 위한 제품/정책 지식 베이스.
 * 사실만 담고, 단가/납기 확약은 견적 흐름으로 유도한다.
 */
export const PCCF_KNOWLEDGE_BASE = `
COMPANY: ${PCCF_BRAND} — a print-on-demand (POD) custom printing service (US market).
WEBSITE: ${PCCF_SITE_URL}
SUPPORT EMAIL: ${PCCF_SUPPORT_EMAIL}

PRODUCTS (print-on-demand, made to order):
- Business cards
- Flyers
- Postcards
- Eco-friendly stickers
- Banners
- Packaging / boxes
Browse + transparent pricing: ${PCCF_SITE_URL}/products

ORDERING:
- Customers configure specs (size, paper, finish, quantity) and see transparent pricing on the product page.
- Checkout is online via Stripe (cards) and PayPal.
- For custom or large specs, customers can request a quote: ${PCCF_SITE_URL}/quote

TURNAROUND & SHIPPING:
- Standard production turnaround is 3–5 business days (does not include shipping transit time).
- Shipping cost/time depends on destination and is calculated at checkout.
- Exact ship dates are NOT guaranteed by email — confirm via the order/quote flow.

QUALITY / REPRINTS:
- Manufacturing defects (printing errors, damage) are eligible for free reprint when reported with photos shortly after delivery.
- Simple change-of-mind on completed custom orders is generally not refundable.
- Any refund / chargeback / dispute must be handled by a human (do not promise refunds by email).

BETA / REVIEW PROGRAM:
- ${PCCF_BRAND} runs a beta-tester program. Details: ${PCCF_SITE_URL}/beta-tester

TONE: professional, warm, concise. American English. Sign off as "The ${PCCF_BRAND} Team".
`.trim();

/**
 * 회신 본문에 항상 붙는 안전 문구(서명/링크). 사실 확약을 견적/주문 흐름으로 유도.
 */
export const PCCF_REPLY_SIGNATURE = `Best regards,
The ${PCCF_BRAND} Team
${PCCF_SITE_URL}`;
