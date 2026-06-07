# OMO-2551 — GTM 컨테이너 + Google Ads 전환 구성 실행 런북

> 대상: Google/GTM/Google Ads 계정 접근 권한 보유자(보드 또는 위임받은 운영자).
> 코드 측은 OMO-2442에서 완료됨. 이 문서대로 **클릭 구성 → ID 회수 → env 주입**만 하면 추적이 활성화된다.
> 코드 검증 기준 커밋: `src/app/layout.tsx`, `src/lib/analytics.ts` (2026-06-07 확인).

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

### ⚠️ 리드 전환 경고 (반드시 읽을 것)
- 이슈 본문의 검증 시퀀스 `view_item → select_item → request_quote → begin_checkout → purchase` 중
  **`select_item`, `request_quote` 이벤트는 코드에 존재하지 않는다.**
- 리드용으로 정의된 `trackGenerateLead`(`generate_lead`)는 **정의만 되어 있고 호출하는 곳이 없어 실제로 발사되지 않는다(dead code).**
- 따라서 **"Google Ads 전환 액션(리드용)"을 만들어도 이를 트리거할 이벤트가 현재 없다.**
  → 아래 §6 결정 필요.

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
- `dlv.transaction_id`, `dlv.value`, `dlv.currency`, `dlv.items`

### 3-2. 트리거 (Triggers → New → Custom Event) — **실제 발사 이벤트 기준**
- `view_item`, `add_to_cart`, `begin_checkout`, `purchase`
- (리드 결정 시) `generate_lead`

### 3-3. 태그
- **GA4 Configuration tag**: All Pages.
- **GA4 Event tags**: 위 트리거별 동일 이름 매핑(`view_item`/`add_to_cart`/`begin_checkout`/`purchase`).
- **Google Ads Conversion Linker**: All Pages (필수).
- **Google Ads Conversion Tracking — Purchase**: trigger=`purchase`,
  Conversion ID=`AW-...`, Label=구매 Label, Value=`{{dlv.value}}`, Currency=`{{dlv.currency}}`, Transaction ID=`{{dlv.transaction_id}}`.
- (리드 결정 시) **Ads Conversion — Lead**: trigger=`generate_lead`.
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

## 6. 보드 결정 필요 — 리드 전환
다음 중 택1:
1. **리드 전환 descope**: 구매 전환만 활성화. (현재 코드에 리드 이벤트 없음 → 가장 빠름)
2. **리드 이벤트 구현 후 활성화**: `trackGenerateLead`를 실제 리드 액션(견적/문의 제출 등)에 연결하는 코드 작업 추가 → 별도 자식 이슈 필요. 연결할 "리드"의 정의(견적 요청? 문의 폼?)를 보드가 지정해야 함.

## 7. 실계정 검증 체크리스트 (Preview / Tag Assistant)
1. GTM Preview 모드 연결 → 사이트 접속.
2. 상품 상세: `view_item` 발사 확인.
3. 장바구니 담기: `add_to_cart`.
4. 주문 폼 진입: `begin_checkout`.
5. 테스트 결제 완료: `purchase` (transaction_id/value 채워짐 + Ads 전환 태그 fired).
6. Google Ads → Conversions → 해당 액션 status가 "Recording conversions"로 전환되는지 24–48h 내 확인.
7. (리드 §6-2 선택 시) 리드 액션 수행 → `generate_lead` 발사 확인.

---

## 회수해서 보드/에이전트에 전달할 값
- [ ] `NEXT_PUBLIC_GTM_ID` = GTM-________
- [ ] Google Ads Conversion ID = AW-________
- [ ] Purchase Conversion Label = ________
- [ ] (선택) Lead Conversion Label = ________
- [ ] 중복 집계 정책 결정(GTM 직접 vs GA4 import)
- [ ] 리드 전환 결정(§6)
