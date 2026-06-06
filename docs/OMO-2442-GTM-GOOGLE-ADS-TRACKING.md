# OMO-2442 GTM + Google Ads 전환 추적 고도화 — Procardcrafters

## 이번 heartbeat에서 반영한 것

- GTM 우선 로드 구조로 정리
  - `NEXT_PUBLIC_GTM_ID` 또는 기존 `NEXT_PUBLIC_GTM_CONTAINER_ID`가 있으면 GTM을 primary로 사용
  - GTM이 있으면 direct `gtag` 로더는 비활성화해서 GA4/Google Ads 이중 발사 위험 차단
  - GTM이 없을 때만 기존 GA4/Google Ads `gtag` fallback 유지
- `dataLayer` 표준 이벤트 push 추가
  - `page_view`
  - `view_item`
  - `add_to_cart`
  - `begin_checkout`
  - `purchase`
  - `generate_lead`
  - 프로모션 퍼널: `promo_impression`, `promo_click`, `promo_code_view`, `promo_add_to_cart`, `promo_checkout_start`, `promo_code_redeem`
- 주문 완료 페이지에 실제 `PurchaseTracker` 연결
  - 기존에는 컴포넌트가 있었지만 성공 페이지에 mount되지 않아 `purchase` 이벤트 누락 가능성이 있었음
- Google Ads enhanced conversions 준비
  - 체크아웃에서 구매자 email / phone / address 일부를 sessionStorage로 넘김
  - 주문 완료 시 `gtag('set', 'user_data', ...)` 후 `purchase` 발사
  - email 우선, phone은 E.164 형태일 때만 전송, address는 이름+우편번호+국가가 있을 때만 전송

## GTM에서 바로 매핑할 이벤트

### Data Layer Custom Event Trigger

- `page_view`
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `purchase`
- `generate_lead`

### 권장 태그 연결

- GA4 Google tag / Config
  - 모든 페이지
- GA4 Event tags
  - 위 custom event 각각 동일 이름으로 매핑
- Google Ads Conversion tag
  - primary purchase conversion: `purchase`
  - 필요 시 micro conversion:
    - `begin_checkout`
    - `generate_lead`
- Google Ads Enhanced Conversions
  - Google Ads에서 enhanced conversions for web 활성화
  - 데이터 소스는 `Google tag` 또는 GTM user-provided data flow 중 하나로 통일

## 현재 코드상 동작 포인트

- 상품 상세: `view_item`
- 주문 폼 진입 후 체크아웃 시작: `begin_checkout`
- 결제 성공 페이지: `purchase`
- 프로모션 UI/API 연동: 프로모 퍼널 6종

## 아직 남은 외부 입력

- GTM container id
  - env: `NEXT_PUBLIC_GTM_ID` 권장
  - 기존 키 `NEXT_PUBLIC_GTM_CONTAINER_ID`도 계속 인식
- Google Ads account 내 conversion action / label 구성
  - purchase를 Google Ads에서 직접 받을지
  - GA4 purchase import로 받을지
  - 둘 다 쓸 경우 중복 집계 방지 규칙 필요
- Enhanced conversions 약관 동의 및 diagnostics 확인
- GTM Preview / Tag Assistant 실계정 검증

## 운영 메모

- Google 공식 문서 기준, enhanced conversions는 GA import 전환에는 적용되지 않음. Google Ads 자체 conversion action 또는 GTM/Google tag 경로로 설정해야 함.
- Google 공식 문서 기준, `gtag('set', 'user_data', {...})`에는 해시되지 않은 값을 넣고 Google이 처리한다.
