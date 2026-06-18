# PCCF (procardcrafters, 영문) 주문 회신메일 / 인보이스 산출물 (OMO-2841)

고객에게 나가는 주문 회신메일과 **100% 동일한 빌더**로 렌더링한 산출물 이미지입니다.

| 파일 | 설명 |
|---|---|
| `email-order-confirmation.png` | 주문 확정(Order Confirmed) 회신메일 HTML 렌더 — `buildEmailHtml('paid', ...)` |
| `invoice-pdf-page1.png` | 첨부 인보이스 PDF 1페이지 — `generateOrderInvoicePdf(...)` |

- 통화: USD. 합계 정합: $89.00 + $159.00 = **$248.00** (이메일·PDF 동일).
- 주문 접수(`pending`)·주문 확정(`paid`) 회신메일에는 인보이스 PDF가 첨부됩니다.

## 재생성

```bash
node --import ./scripts/_sample-register.mjs scripts/generate-quote-samples.mjs
# 또는
npm run quote-samples
```

`pdftoppm`(poppler)이 PATH에 있어야 PDF→PNG 변환이 동작합니다.

## 테스트 발송 (어드민)

어드민 테스트 발송 페이지(`/admin/test-email`)에서 임의 주소로 고객 회신메일과
동일한 메일을 발송할 수 있습니다. 수신자는 입력값으로만 강제되며 실고객/CC/BCC 로는
절대 전송되지 않습니다. (API: `POST /api/admin/test-quote-email`)

> 어드민 UI·API·발송기는 OMO-2840(PR #44)에서 머지된 것을 그대로 사용합니다.
> 본 OMO-2841 변경은 그 위에 **인보이스 PDF 첨부**(주문 접수/확정 회신메일)와
> **산출물 이미지**(회신메일 PNG + 인보이스 PDF PNG)를 추가합니다. 테스트 발송은
> `sendTestQuoteEmail` 을 통과하므로 PDF 첨부가 고객 발송과 100% 동일하게 포함됩니다.
