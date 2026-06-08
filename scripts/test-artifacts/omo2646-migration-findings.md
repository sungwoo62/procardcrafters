# OMO-2646 — 성원/adpiamall 마이그레이션 진단 (2026-06-08, Dev-Print)

## TL;DR — 이슈 전제 정정
이슈는 "성원이 견적/가격 플랫폼을 adpiamall.com 으로 마이그레이션"으로 봤으나,
라이브 검증 결과 **부분적으로 다름**:

- **소형인쇄(명함·스티커·전단) 카탈로그는 adpiamall로 이전되지 않았다.** swadpia.co.kr
  홈페이지가 지금도 명함/스티커/전단을 자기 `/goods/goods_view/CNC1000/GNC1001`
  경로로 링크한다. adpiamall로 빠지는 건 **실사출력·배너·명함케이스 등 대형 제품뿐**.
- 진짜 변경점은: 성원이 swadpia.co.kr 을 개편하면서 **우리가 의존하던 비인증 공개
  엔드포인트(견적 JSON·goods_view·member/login)를 전면 폐지하고 세션 인증 뒤로 옮김.**
- adpiamall.com 은 별개의 **대형포맷 Angular SPA**(실사출력 브랜드)로, 자체 인증 데이터
  API(`data.adpiamall.com`)와 숫자 카탈로그(`goods2019/{id}`)를 쓴다. 우리 소형인쇄
  카탈로그와 무관.

→ **"adpiamall로 재지정"은 올바른 방향이 아니다.** 올바른 문제는 "swadpia 공개
엔드포인트 폐지 → 인증 필요 구조 변경 대응".

## 라이브 증거 (2026-06-08)
| 경로 | 결과 | 의미 |
|---|---|---|
| `https://www.swadpia.co.kr/` | 200 | 소형인쇄 본사 사이트 정상 가동(200KB, jQuery 1.3.2) |
| `POST /estimate/estimate_goods/json_data` | 404 | 라이브 가격 소스(swadpia.ts) 폐지 |
| `GET /goods/goods_view/CNC1000/1` | 404 | 자동발주 네비(swadpia-order.ts) 폐지 |
| `GET /goods/goods_view/CNC1000/GNC1001` (실 goodsCode) | 404 | 실값으로도 **비로그인 404 = 로그인 게이트** |
| `GET /member/login` | 404 | 로그인은 홈 모달, 필드 `mem_login_id`(기존 `member_id` 아님) |
| 홈페이지 명함 링크 `/goods/goods_view/CNC1000/GNC1001` | (게이트) | 소형인쇄는 swadpia에 잔존, 인증 뒤 |
| 홈페이지 대형 링크 `adpiamall.com/shop/main/RP903B`, `adpiamall.com/estimate/goods2019/758` | 200(SPA셸) | 대형포맷만 adpiamall로 |
| `adpiamall.com` 모든 경로 | 200, 5987B 동일 셸 | Angular SPA — `/estimate/goods2019/{id}` 는 **API가 아니라 클라이언트 라우트** |
| `data.adpiamall.com/*` (추정) | 404(Apache) | 실제 데이터 API, 경로/인증 미상 |

### adpiamall 아키텍처 메모(재연동 시 참고)
- Angular CLI 번들: `inline/polyfills/scripts/main.*.bundle.js`.
- 데이터 베이스: 운영 `https://data.adpiamall.com`, 개발 `https://dev-data.adpiamall.com`
  (main.js 환경 분기). webhard/images 호스트 별도.
- 카탈로그 ID는 숫자(`goods2019/{numericId}`) + 신규 카테고리코드(`RP8300`/`RP903B` 형식).
  기존 CNC1000…CCD2000 코드와 매핑 테이블 전무 → 재작성 필요.

## 프로덕션 영향 — **무중단, 우아한 열화 (검증 완료)**
- **PDP 가격**: `fetchSwadpiaCategoryData` 가 fetchSuccess:false 반환 → `ProductConfigurator`
  의 `useSwadpia = printEntries.length>0` 가드가 false → **DB `base_price_krw`+마진 폴백**.
  크래시 없음. 단 "real-time wholesale pricing" 은 사실상 전 품목 OFF.
- **가격 크론**(`api/cron/update-prices`): `if (priceChanged && swData.fetchSuccess)` 일 때만
  DB 갱신 → 전부 실패인 현재 **DB 가격 보존**. 다만 매 실행마다 36건 404 왕복 +
  `print_price_history` 실패행 누적(무해하나 낭비).
- **자동발주**(OMO-2635, swadpia-order.ts): goods_view/login 게이트로 **차단**.

## 적용한 안전 가드 (이 커밋)
`src/lib/swadpia.ts`: `SWADPIA_PUBLIC_ENDPOINT_LIVE = false` 가드 추가.
- 죽은 404 호출을 네트워크 전에 건너뛰고 명시적 폴백 사유 반환.
- 헤더 docstring 을 현실(엔드포인트 폐지·인증 게이트)로 정정.
- 동작 변화 없음(소비자는 이미 fetchSuccess:false 폴백) + 낭비성 404/실패행 제거.
- 재연동 시 플래그 true + fetch 로직 교체.

## 미해결 — 보드 결정 필요 (재연동 방향)
공개 엔드포인트가 사라지고 모든 견적/발주가 **세션 인증**을 요구하므로 옛 무인증
스크랩 방식은 더 이상 불가. 방향은 사업 결정에 의존:
1. **swadpia B2B 계정으로 인증 연동** — 성원 거래처 계정 자격증명 확보 후 모달 로그인
   (`mem_login_id`) 세션 → 신규 견적/goods_view 엔드포인트 재발견·재연동. (ToS/계정 확인 필요)
2. **DB 관리 가격으로 전환** — 라이브 도매가 스크랩 포기, `print_products.base_price_krw`
   를 운영자가 관리(주기적 수동/반자동 갱신). 가장 견고, 스크랩 취약성 제거.
3. **하이브리드** — 가격은 DB 관리(2안), 자동발주만 인증 세션(1안)으로 복구.

## 진단 도구
- `scripts/omo2635-probe-finishing-prices.mjs` (기존)
- 본 진단의 라이브 curl 검증은 재현 가능(위 표).
