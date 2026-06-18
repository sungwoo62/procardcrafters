# OMO-3487 — 성원 전용·미매핑 후가공 13종 라이브 재조사 결과

조사일 2026-06-18 · 방법 **정적 HTML READ-ONLY**(로그인/주문 없음) · 부모 OMO-3483

## 핵심 발견 — 로그인 없이 폼 구조 추출 가능
성원 `goods_view/<CODE>/1` 페이지는 **비로그인으로도 전체 폼 마크업**(모든 `chk_is_*` 후가공 블록 +
`select[name]`/`option`)을 그대로 반환한다(예: CDP3000 651KB). 카테고리별 *가시성*만 런타임 JS 가
제어할 뿐, **필드 구조 자체는 정적 결정론 추출이 가능**하다. 따라서 13종의 필드명/옵션값을
SWADPIA 로그인 없이 추출 완료했다. 옵션이 비어 있고 사이즈/용지 선택 후 JS 로 채워지는
`runtime` 필드만 로그인 크롤이 남는다.

> 결정론 원칙 준수: 가격(total_price)·발주는 일절 호출하지 않음. 폼 마크업만 GET.

## 토큰별 추출 결과 (전체: `finishing-fields-static.json`)

| 토큰 | 명칭 | 핵심 필드 | 정적 옵션 추출 | 상태 |
|---|---|---|---|---|
| coating | 코팅 | `coating_type` | ✅ COT10~60 (단/양면 × 유광/무광/UV) | 카탈로그 有, 필드매핑 기록 |
| binding | 제본 | `binding_type`(runtime), `binding_add_set` | 🟡 BDS10~40(철방향), 제본종류 runtime | 카탈로그 有, 필드매핑 기록 |
| window | 창문 | `window_size` | ✅ 고정규격(85*40~) | 카탈로그 有(window_patch) |
| cutting | 재단 | `cutting_type` | ✅ CTT10~50(규격/내용 동일·상이) | **신규 필요** |
| add_cutting | 추가재단 | `chk_is_add_cutting`(불리언) | ✅ select 없음(체크박스 add-on) | **신규 필요** |
| partial_coating | 부분코팅 | `chk_is_partial_coating` | 🟡 전용 select 미발견(카테고리 JS) | **신규 필요**, runtime 크롤 |
| bonding | 합지/접착 | `bonding_type` | ✅ BOT10~80(손/기계 접착, 양면테잎) | **신규 필요** |
| folding | 접지 | `folding_type`, `folding_direction`(runtime) | ✅ FDT01~17(반/N/병풍/대문/십자…) | **신규 필요** |
| laminex | 라미넥스(무광 라미네이팅) | `laminex_num`(runtime) | 🟡 runtime | **신규 필요**, runtime 크롤 |
| stitching | 중철제본 | `stitching_type`(runtime), `stitching_direction` | 🟡 SHD10/20(좌철/상철), type runtime | **신규 필요** |
| tape | 양면테이프 | `tape_type` | ✅ TAP*(봉투=폭/배너=길이, **카테고리별 의미 상이**) | **신규 필요** |
| dbak | **디지털박** | `dbak_section/side/type`(×3), `dbak_exist_dongpan`(runtime) | ✅ BKS30=디지털, BKD/BKT | 의미확정, 디지털제품 전용 |
| depoxy | **디지털에폭시** | `depoxy_type`(runtime), `depoxy_kind`(×2) | ✅ EPK91=에폭시 | 의미확정, 디지털엽서 전용 |

## dbak / depoxy 의미 확정 (3번 과제)
기존 추정("양면박/양면에폭시")은 **오류**. 폼 증거로 확정:
- **dbak = 디지털박**: `dbak_section_*` 의 유일 옵션이 `BKS30=디지털`(일반 `bak_section`=BKS10 신규/BKS20 보유동판).
  접두 `d` = **디지털**(NOT 양면). JS `addDBak`/`chgDBakExistDongpanPrice` 가 일반 박과 분리. 디지털인쇄 제품
  (디지털명함 CNC*, 디지털엽서 CDP3000)에서만 노출. 면/종류는 일반 박과 동일(BKD/BKT), 최대 3세트.
- **depoxy = 디지털에폭시**: `depoxy_kind=EPK91 에폭시`, dbak 와 동일 명명규칙(d=디지털). CDP3000 전용, 최대 2세트.
→ 우리 카탈로그에 디지털박/디지털에폭시 카드·자동발주·surcharge **미생성 = 역방향 누락 유지**(별색박과 유사하게 디지털 라인 전용).

## 양방향 커버리지 영향
- **needs_audit 3종**(coating/binding/window): 필드매핑 데이터 기록 완료. `coating_type`·`window_size`·`binding_add_set`
  은 정적 확정, `binding_type` 등 일부 카테고리 runtime 잔존. **mapped(자동발주) 전환은 surcharge 적재(OMO-3485)
  + 카테고리별 runtime 옵션 확정 후** — 현 단계는 비활성(DEFAULT_FINISHING_FIELD_VALUES 미추가)으로 0-surcharge
  손해 차단.
- **성원전용 8종**: 필드구조 추출 완료. 카탈로그 카드·자동발주 wiring·surcharge 는 후속(아래).
- **불확실 2종**: 의미 확정 → 매트릭스에서 `investigate` 제거.

## 남은 작업(후속 위임)
1. **runtime 필드 옵션 확정** — SWADPIA 로그인 크롤(`scripts/omo3487-finishing-probe.mts`, 작성완료·실행대기):
   `folding_direction`, `binding_type`(책자), `laminex_num`, `stitching_type`, `partial_coating` 세부,
   `dbak_exist_dongpan`, `depoxy_type`. **블로커: SWADPIA_USERNAME/PASSWORD 미보유**(2026-06-17 env→printcity 전환).
2. **카탈로그 카드 8종 신규** + **자동발주 wiring(DEFAULT)** + **surcharge 적재** — 라이브 고객가 영향 → **OMO-3485
   + 보드 가격 게이트와 협의**. 본 이슈에서는 가격 영향 없는 필드매핑 기록까지만 수행(거버넌스 준수).

## 산출물
- `scripts/test-artifacts/omo3487/finishing-fields-static.json` — 13종 필드/옵션 권위 추출본
- `scripts/omo3487-finishing-probe.mts` — runtime 필드 로그인 크롤(실행대기)
- `src/config/swadpia-finishing-matrix.ts` — dbak/depoxy 의미 확정 반영
- `src/config/swadpia-finishing-fields.ts` — coating/binding/window 필드매핑 기록(비활성, 손해차단)
