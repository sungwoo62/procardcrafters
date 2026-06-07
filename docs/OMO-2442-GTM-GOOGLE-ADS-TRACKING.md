# OMO-2442 — PCCF GTM + Google Ads 전환 추적 (Phase 1)

ProCardCrafters(이하 PCCF) 코드베이스의 GTM-first 분석 구조와 Google Ads 전환
매핑을 정리한다. 코드 측 작업은 완료되었으며, 아래 "남은 외부 입력" 항목만
GTM/Ads 계정에서 구성하면 전환 추적이 활성화된다.

## 1. 아키텍처 개요 (GTM-first)

- `NEXT_PUBLIC_GTM_ID` 가 설정되면 `src/app/layout.tsx` 가 GTM 컨테이너(head 스니펫
  + body noscript iframe)를 주입한다. 이때 **직접 GA4 gtag 로더는 비활성화**되며,
  GA4 Config 는 GTM 컨테이너 안의 GA4 Configuration Tag 가 담당한다.
- `NEXT_PUBLIC_GTM_ID` 가 없으면 기존 GA4 `gtag` 스니펫이 fallback 으로 동작한다.
- 모든 표준 이벤트는 `src/lib/analytics.ts` 의 `pushEvent()` 를 거친다.
  - GTM 주입 시: `window.dataLayer.push({ event, ...params })` (ecommerce 이벤트는
    직전에 `{ ecommerce: null }` push 로 잔여값 초기화 — GA4 권장 패턴)
  - GTM 미주입 시: `window.gtag('event', name, params)` fallback

## 2. 코드에서 발사되는 표준 이벤트

| 이벤트 | 발사 위치 | 트리거 |
|--------|-----------|--------|
| `page_view` | GTM/GA4 자동 | 페이지 로드 |
| `view_item` | `ProductDetail.tsx` (useEffect) | 상품 상세 진입 |
| `select_item` | `ProductDetail.tsx` (CTA onClick) | "Get a Free Quote" 클릭 |
| `request_quote` | `QuoteForm.tsx` (submit 성공) | 견적/문의 폼 제출 — **핵심 리드** |
| `generate_lead` | `QuoteForm.tsx` (submit 성공) | 견적 폼 제출 (GA4 표준 리드) |
| `contact_submit` | `QuoteForm.tsx` (submit 성공) | 문의 폼 제출 |
| `begin_checkout` | `QuoteForm.tsx` (디파짓 UI 노출) | 디파짓 결제 섹션 표시 |
| `purchase` | `QuoteForm.tsx` (PayPal onSuccess) | $50 디파짓 결제 완료 — **핵심 전환** |

> PCCF 는 현재 장바구니 대신 위시리스트 기반이라 `add_to_cart` / `view_cart` /
> `remove_from_cart` 는 실제 발사처가 없다. 추후 카트 도입 시 GTM 트리거를
> 재사용할 수 있도록 `analytics.ts` 에 표준 함수만 미리 제공해 두었다.

## 3. GTM 컨테이너 구성 (계정 작업 — 남은 외부 입력)

### 3-1. Variables (Data Layer Variables)
- `DLV - value`, `DLV - currency`, `DLV - transaction_id`,
  `DLV - product`, `DLV - quantity`, `DLV - items`

### 3-2. Triggers (Custom Event)
| Trigger 이름 | Event name(정규식 아님, 정확히 일치) |
|--------------|--------------------------------------|
| `CE - request_quote` | `request_quote` |
| `CE - generate_lead` | `generate_lead` |
| `CE - begin_checkout` | `begin_checkout` |
| `CE - purchase` | `purchase` |

### 3-3. Tags
1. **GA4 Configuration Tag** — Measurement ID = `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
   trigger = All Pages (Initialization).
2. **GA4 Event Tags** — 각 표준 이벤트를 위 Custom Event Trigger 에 연결
   (view_item / select_item / request_quote / begin_checkout / purchase).
3. **Google Ads Conversion Tags**:
   - 리드 전환: `Conversion ID` + `Conversion Label`(리드용), trigger = `CE - request_quote`
   - 구매 전환: `Conversion ID` + `Conversion Label`(구매용), trigger = `CE - purchase`,
     `Conversion Value` = `DLV - value`, `Transaction ID` = `DLV - transaction_id`,
     `Currency` = `DLV - currency`
4. **(선택) Enhanced Conversions** — Google Ads 태그에서 enhanced conversions 활성화 시,
   이메일/전화 등 user-provided data 변수를 추가로 매핑. 현재 폼은 email 을 수집하므로
   해시 처리 후 전달하도록 GTM 에서 구성 가능.

## 4. `trackGoogleAdsConversion()` 처리

GTM 주입 환경에서는 위 Conversion Tag 가 dataLayer 커스텀 이벤트로 발사되므로
`trackGoogleAdsConversion()` 직접 호출은 불필요하다. 따라서 helper 는
**GTM 미주입(직접 gtag) fallback 으로만 유지**하도록 가드를 추가했다
(`gtmEnabled()` 면 early return). 호출처가 없으므로 제거해도 무방하나, GA4 단독
운영 가능성을 위해 보존한다.

## 5. 남은 외부 입력 (코드 외 작업)

1. `NEXT_PUBLIC_GTM_ID` 환경변수 주입 (Vercel + `.env.local`) — GTM 컨테이너 ID 필요
2. Google Ads 계정에서 conversion action(리드/구매) 생성 → Conversion ID/Label 확보
3. 위 3장 기준 GTM 컨테이너 태그/트리거/변수 구성 및 게시(Publish)
4. GTM Preview / Tag Assistant 실계정 검증 (view_item → request_quote → begin_checkout
   → purchase 발사 확인)

## 6. 검증 (코드)

- `pnpm exec tsc --noEmit` — 본 변경 파일(analytics.ts / layout.tsx / QuoteForm.tsx /
  ProductDetail.tsx) 오류 없음. (기존 무관 오류 `scripts/test-batch-orders.ts` 별개)
- 실계정 검증은 위 5장 외부 입력 확보 후 진행.

## 연관 이슈
- 부모 플랜: OMO-2299 · 광고 런칭: OMO-2309 · 전환 지시 출처: OMO-2312
