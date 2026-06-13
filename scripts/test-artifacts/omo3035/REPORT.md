# OMO-3035 — 책자 PUR무선(BDT6) 호환 표지/페이지 매트릭스 라이브 probe

조사일 2026-06-13 · WebOps-Print · 라이브 READ-ONLY (주문/결제 없음)
대상: `https://www.swadpia.co.kr/goods/goods_view/CPR4000/1` (PUR무선 가능 책자 상품)
증거: `scripts/test-artifacts/omo3035/{bdt6-matrix,verify-white}.json`
스크립트: `scripts/omo3035-{bdt6-matrix,verify-white}.mts`

## 핵심 결론

OMO-3030 probe2 의 "BDT6 탈락"은 **잘못된 표지(PKD20 고급지 ARE160W00)** 때문이었다.
PKD30(특수지) 표지를 3단 cascade(kind→type→code)로 **정확히** 설정하면 BDT6 가 유지되며,
내지 페이지수가 **32p 이상**일 때 binding_type 에 BDT6 가 노출된다.

### 1. BDT6 노출 표지 코드 (PKD30 특수지, 27개 중 11개)

| cover_paper_type | code | label | BDT6 |
|---|---|---|---|
| CFT | CFT30000N | 뉴크라프트보드 300g | ✅ |
| FLP | FLP195YL0 / FLP235YL0 | 195g / 235g | ✅ |
| **MGM (매직매칭)** | **MGM200W01** | **백색 200g** | ✅ |
| MGM | MGM250W01 | 백색 250g | ✅ |
| MGM | MGM200OW0 | 연미색 200g | ✅ |
| MGT | MGT180OB1/OG1/OR1, MGT200OW1, MGT200W01 | 색지 180~200g | ✅ |

(PKD10 일반지·PKD20 고급지·PKD40 펄지 표지는 모든 code 에서 BDT6 미노출 — OMO-3030 bdt6.json 과 일치.)

### 2. BDT6 노출 in_page_qty(내지 페이지수) 범위

확정 표지(CFT30000N, FLP195YL0, MGM200W01, MGM250W01, MGM200OW0 모두 동일):
- in_page_qty **0,4,8,...,28 → BDT6 없음** (PUR무선 최소 페이지 미달)
- in_page_qty **32 ~ 640 (4p 단위, 153개 옵션) → BDT6 노출 ✅**
- **PUR무선 최소 내지 페이지수 = 32p**

page=32, 표지 MGM200W01 시점 binding_type 라이브 옵션:
`[BDT2 중철, BDT6 pur무선, BDT4 스프링]` (default=BDT2 중철 — BDT6 는 명시 선택 필요).

### 3. 권고 시드값 (Dev-Print 회신)

PUR무선 자동발주가 검증을 통과하려면 시드 기본 표지를 BDT6 호환 특수지로 교체 + 내지 기본 페이지수 ≥32:

| 필드 | 현재 시드(비호환) | 권고 시드(BDT6 호환) |
|---|---|---|
| cover_paper_kind | PKD20 (고급지) | **PKD30 (특수지)** |
| cover_paper_type | (ARE) | **MGM (매직매칭)** |
| cover_paper_code | ARE160W00 (고급지 백색 160g) | **MGM200W01 (백색 200g)** |
| in_page_qty(내지 기본) | — | **≥32 (PUR무선 최소). 실무 기본값 64p 권장** |

- **1순위 권고: MGM200W01 (백색 200g)** — 현재 ARE160W00(백색)과 색감 가장 근접한 백색 특수지, 11개 후보 중 최저 평량.
- 대안: MGM250W01 (백색 250g) — PUR무선 표지로 두께 더 적합하나 평량↑ → 단가↑.
- 백색 외 컬러 표지(MGT 색지, FLP, CFT 크라프트)는 디자인 의도 변경이라 기본 시드 부적합.

### ⚠️ 보드 가격결정 게이트 필수
표지 평량 변경(고급지 160g → 특수지 200g)은 **단가 상승**을 수반. 기본 표지 변경 = 가격 변동이므로
Dev-Print 의 `print_product_options` 시드 교정(catalogs 90001d30 / perfect-bound-booklet f1c5541b)
적용 전 **보드 가격결정 승인** 필요.
