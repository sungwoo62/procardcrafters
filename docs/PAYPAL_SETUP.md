# PayPal 결제 환경 셋업

Procardcrafters(B2C 인쇄) 주문 폼은 PayPal 단일 결제수단으로 USD 결제만 받습니다.

## 1. 환경변수

`.env.local` 에 다음을 채워주세요. Sandbox / Live 모두 동일한 키 이름을 사용하고,
`PAYPAL_API_URL` 만 분기됩니다.

```bash
# 브라우저 SDK (PayPalScriptProvider) — public
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AeXxxxxxxxxxxxxxxxx

# 서버 OAuth (lib/paypal.ts) — secret
PAYPAL_CLIENT_ID=AeXxxxxxxxxxxxxxxxx       # NEXT_PUBLIC 과 동일한 값
PAYPAL_SECRET=ELxxxxxxxxxxxxxxxxx

# Sandbox 일 땐 비워두고, Live 전환 시 주석 해제
# PAYPAL_API_URL=https://api-m.paypal.com
```

> `PAYPAL_CLIENT_ID` 가 비어 있으면 서버는 자동으로 `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
> 를 fallback 으로 읽기 때문에, 최소한 `NEXT_PUBLIC_PAYPAL_CLIENT_ID` + `PAYPAL_SECRET` 만
> 채우면 동작합니다.

## 2. Sandbox 키 발급 절차 (테스트용)

1. https://developer.paypal.com → "Apps & Credentials" → Sandbox 탭
2. "Create App" → App Name 입력 (예: `procardcrafters-sandbox`)
3. Default Application 으로 두고 Create
4. 발급된 Client ID / Secret 을 `.env.local` 에 복사

테스트용 Sandbox personal 계정 (구매자 역할) 도 같은 페이지의 "Sandbox Accounts" 탭에서 만들 수 있습니다.
(SB 계정 이메일/비밀번호로 PayPal 버튼 클릭 후 로그인하여 결제 흐름 검증)

## 3. Live 전환

1. PayPal 비즈니스 계정 승인 후 Live 탭에서 같은 절차로 App 생성
2. `.env.local` (또는 Vercel 환경변수) 의 Sandbox 키를 Live 키로 교체
3. `PAYPAL_API_URL=https://api-m.paypal.com` 주석 해제 (또는 Vercel 환경변수 추가)
4. Vercel 에서 `redeploy` 로 변경 반영

## 4. 결제 흐름 (구현 위치)

| 단계 | 파일 |
|------|------|
| 폼 UI + PayPal 버튼 | `src/app/order/OrderForm.tsx` |
| 주문 생성 (DB insert + PayPal Order create) | `src/app/api/paypal/create-order/route.ts` |
| 결제 캡처 (capture + 주문 상태 paid) | `src/app/api/paypal/capture-order/route.ts` |
| PayPal SDK 래퍼 | `src/lib/paypal.ts` |

DB 테이블:
- `print_orders.payment_provider = 'paypal'`
- `print_orders.paypal_order_id`
- `print_orders.payment_status` (`COMPLETED` 시 paid 처리)

## 5. 국제 주문 폼

`src/app/order/OrderForm.tsx` 는 `src/lib/intl-address.ts` 의 국가 메타데이터를 사용해서

- 30 개국 국가 셀렉터 (미국/캐나다/영국/EU/일본/한국/홍콩/싱가폴/호주 등 PayPal 주요 시장 + 동남아 + 중남미)
- US/CA/AU/IN/MX/BR 는 주(state)/도(province) 드롭다운 필수
- 우편번호 라벨/placeholder/정규식 검증 (국가별로 다름)
- 전화번호 placeholder 국가별 국번 자동 (+1, +44, +81, +82 …)
- 도시/주소 라인 placeholder 국가별 예시

를 자동으로 바꿔 줍니다. 새 국가 추가하려면 `COUNTRIES` 배열에 한 줄 추가하면 됩니다.

## 6. 체크리스트

PayPal 키 받은 직후:

- [ ] `.env.local` 에 3 개 변수 채우기
- [ ] `npm run dev` 후 http://localhost:3000/order?product=... 진입
- [ ] 폼 채우고 PayPal 버튼 클릭 → Sandbox 구매자 계정 로그인 → 결제
- [ ] `/order/success?order=...` 로 리다이렉트 확인
- [ ] `print_orders` 테이블에서 `status=paid`, `payment_status=COMPLETED` 확인
- [ ] 구매자/관리자 이메일 발송 (Resend) 확인
- [ ] Live 전환 시 `PAYPAL_API_URL` + 라이브 키 교체 후 동일 시나리오 재검증
