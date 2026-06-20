# OMO-3512 — 성원 후가공 잔여 RE (넘버링 실단가 / 박 멀티레이어 / 보유동판 면제 / 카테고리 확장)

부모: [OMO-3511](/OMO/issues/OMO-3511) (명함 CNC1000 8종 공식 RE). 본 문서는 명함 폼 한계로 미측정이던 4개 잔여 항목을 **결정론적 소스 RE**로 확정한다.

## 방법론 (라이브 READ-ONLY, 실주문 0)

성원 후가공 단가는 화면이 아니라 **카테고리별 클라이언트 JS 클래스**가 계산해 hidden `*_amt` 필드에 채운다. 그 JS를 직독하면 화면 OCR/LLM 추론 없이, 실주문 없이 단가 함수를 **수식 그대로** 얻는다 (printcity JSON 직독과 동치, OMO-3411). 박은 `total_price`에 안 잡히는 별색 surcharge라 이 경로가 유일 권위다.

- 소스: `https://www.swadpia.co.kr/modules/estimate/js/{postpress|product|print}_class_{CATEGORY}.min.js`
- 파일은 Dean-Edwards packer(`eval(function(p,a,c,k,e,d){…})`)로 난독화 → `raw-unpacked/unpack.js`로 복원.
- RAW 복원본: `raw-unpacked/postpress_class_*.unpacked.js`, `product_CNC1000.unpacked.js`.
- 인증 불필요(공개 GET 200). 결제·발주 호출 없음.

> **카테고리별 JS가 존재한다는 것 자체가 본 RE의 핵심 발견.** 후가공 단가는 카테고리마다 다른 함수다. 단일 ratePerMm2로 전 카테고리 parity는 **성립하지 않는다**.

---

## ① 넘버링 실단가 — 모델이 카테고리별로 2종

부모가 명함 GNC1001에서 `numbering_amt=0`을 본 것은 **용지 게이트**(스노우지 무광/300g) 때문이지 넘버링 미지원이 아니다. 비게이트 용지에선 산정된다.

### (A) 명함류 NBT/NBN 모델 — `postpress_class_CNC1000` `calcuNumberingPrice`/`calcuNumberingPriceUnit`

우리 `swadpia-finishing-fields.ts`가 매핑한 모델이 **이것**(NBT10/NBT20 × NBN11~14).

```
numbering_price_unit = calcuNumberingPriceUnit()              // 아래 (A-unit)
TYPE_PRICE_RATE = (numbering_type=='NBT10' ? 38000 : 70000)   // NBT10 일반 / NBT20 난수
KIND_RATE       = (kind ∈ {NBN11,NBN13,NBN21,NBN23} ? 1 : 1.2) // 6자리 1개=1 / 2개=1.2
numbering_price = ceil( max(KIND_RATE*unit, TYPE_PRICE_RATE) / 1000 ) * 1000 * order_count
```

**바닥값(floor):** NBT10 일반 = 38,000 × order_count, NBT20 난수 = 70,000 × order_count. (order_count = 동일 주문 내 종(件) 수, 단건이면 1)

(A-unit) `calcuNumberingPriceUnit` (면적·매수 의존):
```
SIZE_RATE          = NBT20 ? (category==CNC4000 ? 5 : 15) : 20
PAPER_QTY_MIN_RATE = NBT20 ? 60000 : 40000
PAPER_QTY_MAX_RATE = NBT20 ? 100000 : 80000
size_rate   = (cutX + cutY) / SIZE_RATE
q1          = min(paper_qty, 20000)
rate1       = max(1 - q1/PAPER_QTY_MIN_RATE, 0.65)
part1       = size_rate * q1 * 1.5 * rate1
q2          = max(paper_qty - 20000, 0)
rate2       = max(1 - q2/PAPER_QTY_MAX_RATE, 0.65)
part2       = size_rate * q2 * 0.4 * rate2
unit        = part1 + part2 + numbering_add_price   // add_price: SZT20 명함/CVS류 + NBT10 + cut 91~199mm → +5,000 등
```

**용지 게이트(넘버링 불가, amt=0):** `SNW250W00`(무광코팅 시), `SNW300W00`, `DNT250GP0`(다이니티골드펄250), `UPP250FB0`(유포지FEB250). → 부모 GNC1001 0 관측 원인.

### (B) 양식/NCR 모델 — `postpress_class_CNR1000` (상지/중지/하지)

NCR(먹지) 폼은 NBT/NBN이 아니라 **장(sheet) 위치**(상지/중지/하지) 기반. binding_unit_type(2/3/4매)에 따라 NCE20~47 옵션 동적 생성, 위치당 unit 합산.
```
type_unit = Σ 위치 unit (상지/중지/하지 각 1, 통합매=2/3/4)
size_rate = max(cutX,cutY) * 0.035
paper_rate= max(1 - paper_price_1/20, 0.7) * 1.11
extra     = (자리수 1개 ? 1 : 1.2)
price = ( size_rate*(bundle_qty*binding_qty*type_unit) + type_unit*15000 ) * paper_rate * extra
price = max( ceil(price/1000)*1000 , 47000 )       // 바닥 47,000
```

---

## ② 박 멀티레이어 합산 — 공식은 존재. 부모 "22,300 고정"은 레이어 미생성

`product_class_CNC1000` `setPPBakAmtSum` (RAW 308행):
```js
$('bak_amt').value = parseInt($('bak_amt_1').value)
                   + parseInt($('bak_amt_2').value)
                   + parseInt($('bak_amt_3').value);   // 없으면 0
```
→ **3레이어 합산은 구현돼 있다.** 부모가 22,300 고정을 본 이유는 `bak_amt_2/3`가 0이었기 때문 — 즉 레이어 2/3가 **폼에 생성/계산되지 않은** 것. 합산 누락이 아니라 **레이어 인스턴스화 누락**(라이브 하니스 한계)이다.

레이어 N(>1)을 비0으로 만들려면 순서:
1. `product.ppBak(N)` 호출 → `settingExistBakDongpan(N)` 로 레이어 행 생성
2. `bak_x_size_N`/`bak_y_size_N` > 0, `bak_section_N`, `bak_type_N`, `bak_side_N` 세팅
3. 해당 seq에서 `calcuBakPrice()` → `setBakPrice` 가 `bak_amt_N` 채움
4. `setPPBakAmtSum()` → `bak_amt = Σ`
   - 레이어 N>1 & order_count>1 & `bak_compare_N==BAC11`(내용틀림)이면 동판 추가비 경로 존재(`getBakDongpanPrice` 내 분기, CNC는 현재 가산 0).

`ap`(형압)·`dbak`(뒷박)도 동일 패턴: `ap_amt_1/2/3`, `dbak_amt_1/2/3` 각 합산(`setPPAPAmtSum`/dbak sum).

---

## ③ 박/형압 보유동판(BKS20/APS20) setup 면제 — **전 카테고리에서 면제 확정**

부모는 BKS20(보유동판)이 BKS10(신규)과 동일가로 측정됐다고 봤으나, **소스는 모든 카테고리에서 보유동판→동판비 0**으로 분기한다. 부모 관측은 폼에서 section이 실제로 BKS20으로 전환되지 않았던 **라이브 입력 경로 문제**(runtimeOnly `bak_exist_dongpan` 미트리거)다.

| 카테고리 | 동판비(신규 BKS10) | 보유동판(BKS20) |
|---|---|---|
| CNC1000 명함 | `max(max(bakX,30)*max(bakY,30)*1.6+1100, 3000)` → ceil/100 | **0** (`if(bak_section=="BKS10") … else 0`, RAW 1517) |
| CST1000 스티커 | `max((bakX+5)*(bakY+5)*1.6, 3500) + 3000*floor(qty/1000-1)` → ceil/1000 | **0** (`if(bak_section=="BKS20") dongpan=0`) |
| CPR1000 포스터 | `getDongpanPrice()` | **0** (`if(bak_section=='BKS20') dongpan=0`) |

→ 재주문(보유동판) 시 동판 setup비가 정확히 빠진다. 보유동판 id 입력 경로 = `bak_section_N=BKS20` (+ runtime `bak_exist_dongpan_N`). total_price만 믿던 기존 추정은 보유동판 주문에서 동판비를 과다 청구할 수 있었음.

---

## ④ 카테고리 확장 parity — 박 단가 공식이 카테고리별로 상이

명함 기준 `finishing-surcharge.ts`(박/형압 = 22,300/1,500㎟ 선형, foil_stamp ratePerMm2)는 **명함 외 카테고리에 그대로 적용 불가**. 박 단가 구조:

| 카테고리 | 박 단가 핵심식 | 수량 의존 | 비고 |
|---|---|---|---|
| CNC1000 명함 | `unit*order_count*1.35*(BKD30?2)*extra4*extra` → ceil/100, `max(+extra3, extra_min)`; cut≥100 → max(.,18500); `+dongpan` | order_count | unit=`getBakPriceUnit`(ppBakJsonOBJ material_unit2/extra_rate/필름) |
| CST1000 스티커 | `unit_price` 기반 + 동판(qty 구간 가산) | paper_qty | 동판비에 `3000*floor(qty/1000-1)` 수량 가산 |
| CPR1000 포스터 | `ceil(basic*saleRate/1000)*1000 + dongpan + 20000` | bundle_qty | saleRate=`max(1-bundle/30000, 0.64)`, 고정 +20,000 |
| CLF2000 전단 | (CNC계열 식 보유, `raw-unpacked/postpress_CLF2000`) | order_count | 명함식과 유사군 |

**공통 진실 3가지:**
1. 박은 **정액이 아니라 수량(매수/종수) 의존** 함수다 → 현 `finishing-surcharge.ts` 정액/면적선형 모델은 명함 1점 측정의 1차 근사일 뿐.
2. 보유동판(BKS20/APS20) → 동판 setup 면제(전 카테고리).
3. 박 단가는 카테고리별 함수 → parity는 카테고리별로 별도 산정해야 한다.

---

## 산출물

- `raw-unpacked/` — 복원된 카테고리별 후가공/제품 JS (CNC/CST/CPR/CLF/CNR) + `unpack.js`.
- `src/lib/swadpia-finishing-formula.ts` — 위 공식의 **결정론 TS 구현(dormant 레퍼런스, 라이브 고객가 미연결)** + 단위테스트.

## 게이트 (부모 동일)

- 적재·고객가 반영(`print_swadpia_price_matrix` / `finishing-surcharge` 값 교체)은 **보드 가격 승인 게이트**. 본 RE는 *정밀 RE + dormant 구현*까지.
- 라이브는 공개 GET 직독만, 실발주/결제 0.
- 부모와 동일하게 [OMO-3503] 보드 보고 경로.

## 후속(보드 승인 후)

1. ppBakJsonOBJ / getDongpanPrice 런타임 JSON을 카테고리별로 표집(estimate_goods/json_data) → 박 unit 수치 완전 해석.
2. 멀티레이어 2/3 비0 dry-run 1회로 `setPPBakAmtSum` Σ 실측 확인(결제 직전 중단).
3. `finishing-surcharge.ts`를 **카테고리별 함수 매트릭스**로 승격(보드 승인 시).
