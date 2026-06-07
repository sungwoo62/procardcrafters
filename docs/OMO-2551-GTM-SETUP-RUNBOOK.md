# OMO-2551 — GTM 컨테이너 + Google Ads 전환 구성 실행 런북

> 대상: Google/GTM/Google Ads 계정 접근 권한 보유자(보드 또는 위임받은 운영자).
> 코드 측은 OMO-2442에서 완료됨. 이 문서대로 **클릭 구성 → ID 회수 → env 주입**만 하면 추적이 활성화된다.
> 코드 검증 기준 커밋: `src/app/layout.tsx`, `src/lib/analytics.ts` (2026-06-07 확인).

---

## 🔑 보드가 전달해야 할 값 — "어디서 찾나" 빠른 안내

| 값 | 어디서 만들고/읽나 (정확한 화면 경로) | 형식 | 어디에 쓰나 |
|----|------------------------------------|------|------------|
| **GTM 컨테이너 ID** | tagmanager.google.com → 컨테이너 선택 → 우상단 워크스페이스 헤더에 `GTM-XXXXXXX` 표시. (또는 Admin → Container Settings) | `GTM-XXXXXXX` | Vercel 환경변수 `NEXT_PUBLIC_GTM_ID` |
| **Google Ads Conversion ID** | ads.google.com → Goals → Conversions → Summary → 아무 전환 액션 클릭 → "Tag setup" → Conversion ID = `AW-XXXXXXXXX` (계정 공통 1개) | `AW-XXXXXXXXX` | GTM Ads 전환 태그 |
| **Purchase Conversion Label** | 위 Conversions에서 **구매** 액션 클릭 → Tag setup → "Use Google Tag Manager" 선택 시 표시되는 **Conversion Label** 문자열 | 예) `AbC-D_efGh12` | GTM 구매 전환 태그 |
| **Lead Conversion Label(들)** | 동일 경로, **리드** 액션(들)에서 읽음. 리드 종류별로 따로 만들면 라벨이 여러 개 | 라벨 문자열 | GTM 리드 전환 태그(들) |

전달 방법: 위 값들을 이 이슈 댓글에 붙여넣어 주시면(또는 인터랙션 응답) 제가 GTM 컨테이너 구성 스펙·env 주입 가이드를 마무리합니다.
**Vercel 환경변수 위치**: Vercel → 프로젝트(procardcrafters) → Settings → Environment Variables → Add (`NEXT_PUBLIC_GTM_ID` = `GTM-XXXXXXX`, Production+Preview) → 재배포.

---

## 0. 코드 측 실제 상태 (검증 완료)

`src/app/layout.tsx`:
- `NEXT_PUBLIC_GTM_ID`(권장) 또는 `NEXT_PUBLIC_GTM_CONTAINER_ID`가 있으면 GTM을 primary로 head 주입 + body noscript fallback 주입.
- GTM이 있으면 direct `gtag` 로더 비활성화 → GA4/Ads 이중 발사 방지(`USE_GTM_PRIMARY`).

`src/lib/analytics.ts` — **실제로 발사되는** dataLayer 이벤트:

| 이벤트 | 발사 위치 | 비고 |
|--------|-----------|------|
| `page_view` | 전 페이지 | page_path 포함 |
| `view_item` | `components/ViewItemTracker.tsx` (상품 상세) | items[] 포함 |
| `add_to_cart` | 5개소 | items[] 포함 |
| `begin_checkout` | 주문 폼 진입 | value, items[] 포함 |
| `purchase` | 주문 완료 페이지 | transaction_id, value, items[], enhanced conversions user_data |
| `promo_*` 6종 | 프로모션 UI/API | promo_impression/click/code_view/add_to_cart/checkout_start/code_redeem |

### 리드 이벤트 — 구현 완료 (다중 정의)
보드 결정에 따라 리드 이벤트를 **여러 정의**로 구현했다. 단일 `generate_lead` 이벤트에 `lead_type` 파라미터로 구분한다:

| `lead_type` | 발사 위치 | 트리거 시점 |
|-------------|-----------|------------|
| `email_signup` | `components/CouponPopup.tsx` | 쿠폰 팝업 이메일 구독 성공 |
| `chat_quote` | `components/ChatWidget.tsx` | 챗 어시스턴트가 견적(estimate) 산출 (세션당 1회) |

- 이슈 본문의 `select_item`, `request_quote` 이벤트는 코드에 없음 → 위 실제 이벤트 기준으로 검증한다.
- GTM에서는 `generate_lead` 트리거 1개를 만들고, `{{dlv.lead_type}}` 값으로 리드 종류별 Google Ads 전환 액션에 분기 매핑한다(§3-3).

---

## 1. GTM 컨테이너 생성 → 컨테이너 ID 회수
1. https://tagmanager.google.com → Create Container
2. Container name: `procardcrafters.com`, Target platform: **Web**
3. 생성 후 상단 `GTM-XXXXXXX` 컨테이너 ID 복사 → 아래 §5 env에 주입.

## 2. Google Ads 전환 액션 생성 → ID/Label 회수
Google Ads → Goals → Conversions → New conversion action → **Website**.

- **구매(Purchase)**: Category=Purchase, Value=Use different values(dynamic), Count=One.
  - 생성 후 "Tag setup → Use Google Tag Manager"에서 **Conversion ID**(`AW-XXXXXXXXX`)와 **Conversion Label** 복사.
- **리드(Lead)**: §6 결정에 따라 생성 여부 결정. 생성 시 Category=Submit lead form, Conversion Label 복사.

회수해야 할 값:
- `AW-` Conversion ID (계정당 1개 공통)
- Purchase Conversion Label
- (선택) Lead Conversion Label

## 3. GTM 컨테이너 구성

### 3-1. Data Layer 변수 (Variables → New → Data Layer Variable)
- `dlv.transaction_id`, `dlv.value`, `dlv.currency`, `dlv.items`, `dlv.lead_type`

### 3-2. 트리거 (Triggers → New → Custom Event) — **실제 발사 이벤트 기준**
- `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `generate_lead`
- 리드 종류별 분기 트리거(택1 방식):
  - Custom Event=`generate_lead` + 조건 `{{dlv.lead_type}}` equals `email_signup`
  - Custom Event=`generate_lead` + 조건 `{{dlv.lead_type}}` equals `chat_quote`

### 3-3. 태그
- **GA4 Configuration tag**: All Pages.
- **GA4 Event tags**: 위 트리거별 동일 이름 매핑(`view_item`/`add_to_cart`/`begin_checkout`/`purchase`/`generate_lead`). `generate_lead`에는 `lead_type` 파라미터를 함께 보냄.
- **Google Ads Conversion Linker**: All Pages (필수).
- **Google Ads Conversion Tracking — Purchase**: trigger=`purchase`,
  Conversion ID=`AW-...`, Label=구매 Label, Value=`{{dlv.value}}`, Currency=`{{dlv.currency}}`, Transaction ID=`{{dlv.transaction_id}}`.
- **Google Ads Conversion — Lead (다중)**: 리드 종류별로 전환 액션/라벨을 분리하는 것을 권장:
  - `email_signup` 분기 트리거 → Lead(email) 전환 라벨
  - `chat_quote` 분기 트리거 → Lead(chat) 전환 라벨, Value=`{{dlv.value}}`
  - (라벨을 1개만 쓸 경우엔 `generate_lead` 트리거 1개에 단일 라벨 매핑)
- **Enhanced Conversions**: Google Ads 전환 액션에서 enhanced conversions for web 활성화, 데이터 소스=GTM. 코드는 이미 `gtag('set','user_data',...)` 후 purchase 발사함.

### 3-4. Publish
Submit → Version name `OMO-2551 initial` → Publish.

## 4. 중복 집계 방지
purchase를 (a) Google Ads 직접 전환 + (b) GA4 → Ads import 둘 다 쓰면 이중 집계됨.
→ **한 경로만** primary 전환으로 지정(권장: GTM 직접 Ads 전환). GA4 import 전환은 "보조" 또는 비활성.

## 5. 환경변수 주입
Vercel(Production/Preview) + 로컬 `.env.local`:
```
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
```
- `NEXT_PUBLIC_GOOGLE_ADS_ID`/`NEXT_PUBLIC_GA_MEASUREMENT_ID`는 GTM 경로 사용 시 **주입하지 않는다**(GTM이 primary일 때 direct gtag 비활성화되므로 불필요, 주입해도 무시됨).
- 주입 후 재배포.

## 6. 리드 전환 — 코드 구현 완료 (보드: 다중 정의 선택)
`generate_lead` 이벤트를 `lead_type`으로 다중 정의 구현 완료:
- `email_signup` (쿠폰 팝업 이메일 구독) · `chat_quote` (챗 견적 산출)
보드 작업: Google Ads에서 리드 전환 액션을 **1개(통합) 또는 2개(종류별)** 중 선택해 생성 → 라벨 회수.
추가 리드 종류가 필요하면 코드에 `LeadType` 확장 + 발사 지점 추가(자식 이슈로 처리 가능).

## 7. 실계정 검증 체크리스트 (Preview / Tag Assistant)
1. GTM Preview 모드 연결 → 사이트 접속.
2. 상품 상세: `view_item` 발사 확인.
3. 장바구니 담기: `add_to_cart`.
4. 주문 폼 진입: `begin_checkout`.
5. 테스트 결제 완료: `purchase` (transaction_id/value 채워짐 + Ads 전환 태그 fired).
6. 쿠폰 팝업 이메일 제출: `generate_lead` (`lead_type=email_signup`).
7. 챗 위젯에서 견적 받기: `generate_lead` (`lead_type=chat_quote`).
8. Google Ads → Conversions → 각 액션 status가 "Recording conversions"로 전환되는지 24–48h 내 확인.

---

## 회수해서 보드/에이전트에 전달할 값
- [ ] `NEXT_PUBLIC_GTM_ID` = GTM-________
- [ ] Google Ads Conversion ID = AW-________
- [ ] Purchase Conversion Label = ________
- [ ] Lead Conversion Label (email_signup) = ________
- [ ] Lead Conversion Label (chat_quote) = ________  ← 통합 1개로 갈 경우 1개만
- [ ] 중복 집계 정책 결정(GTM 직접 vs GA4 import)
