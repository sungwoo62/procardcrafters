# OMO-3736 — FedEx 라벨 인증 거부 대응 (Case 27122658)

## 1. 메일이 무슨 뜻인가 (요약)

FedEx Ship API 를 실서비스에 쓰려면 **라벨 인증(label certification)** 을 통과해야 한다.
이번 거부 사유는 한 줄로:

> 제출한 라벨이 **ZPL 버퍼를 제3자 프로그램으로 이미지(PNG/PDF)로 변환한 것** 이다.
> 써멀 프린터용 ZPL 은 이미지로 바꾸지 말고 **FedEx 가 돌려준 ZPL 버퍼를 그대로 출력** 하라.

이유: ZPL 버퍼 안에는 바코드를 써멀 프린터 펌웨어가 최상 품질로 찍는 명령 스크립트가 들어있다.
이걸 PNG/PDF 이미지로 변환하면 써멀 프린터 해상도에 맞게 스케일이 안 맞아 바코드 품질이 떨어진다.
→ 흔한 케이스: ZPL 을 **Labelary** 같은 온라인 뷰어로 그림으로 떠서 제출한 경우.

마감: **2026-07-10 까지 회신** (15 영업일 보류). 이메일에 회신 + 수정 라벨 첨부.

## 2. 중요한 사실 — 우리 코드는 ZPL 을 이미지로 변환하지 않는다

전체 코드베이스를 확인한 결과 (`src/lib/fedex-api.ts`, create-label route, 테스트 스크립트 전부):

- 우리 시스템은 FedEx 에 **`imageType: 'PDF'`, `labelStockType: 'PAPER_4X6'`** 로 요청한다.
- 받은 PDF 를 그대로 Supabase 에 저장하고 그대로 다운로드시킨다.
- **ZPL 요청도, Labelary 도, 이미지 변환 코드도 어디에도 없다.**

즉 **이번에 FedEx 에 제출된 "ZPL→이미지" 라벨은 우리 자동 코드 경로에서 나온 게 아니다.**
누군가 수동으로 (또는 외부 도구로) ZPL 을 떠서 이미지로 만들어 제출한 것으로 보인다.

## 3. 그래서 어떻게 해야 하나 — 두 갈래, 프린터에 달려있다

인증 재제출 경로는 **배송 현장에서 어떤 프린터로 라벨을 뽑느냐** 로 갈린다.

### 옵션 A) 써멀 프린터(Zebra 등 ZPL 프린터)를 쓴다  → 메일 지시 그대로
- FedEx 에 **ZPLII** 로 요청 → 돌려받은 **raw ZPL 버퍼(`^XA…^XZ`)를 프린터에 그대로 전송** (이미지 변환 절대 금지).
- 인증 재제출: 실제 써멀 프린터로 뽑은 라벨(또는 FedEx 가 말한 대로 raw `.zpl` 파일)을 메일에 첨부.
- **코드는 준비 완료** (아래 4번). env 한 줄(`FEDEX_LABEL_IMAGE_TYPE=ZPLII`)로 활성화.
- 전제: **회사가 써멀 프린터 보유 必**. 없으면 이 경로 불가.

### 옵션 B) 일반 레이저/잉크젯 프린터 + 4x6 라벨지를 쓴다  → 더 간단
- 지금 코드가 이미 하는 방식: FedEx 에 **PDF** 로 요청 → PDF 그대로 출력.
- PDF 라벨은 ZPL 인증 트랙과 무관 → 이미지 변환 문제 자체가 없음.
- 인증 재제출: **우리 API 가 직접 만든 PDF 라벨**(Labelary 안 거친)을 메일에 첨부.
- 추가 개발 불필요. 별도 써멀 하드웨어 불필요.

> 권고: 써멀 프린터가 이미 있으면 A(가장 깔끔, FedEx 권장). 없으면 B(즉시 가능, 추가 비용 0).

## 4. 이번 heartbeat 에 한 일 (코드 — 기본 동작 불변)

옵션 A 를 즉시 켤 수 있도록 **env 게이트** 로 ZPL 경로를 구현. **기본값은 PDF 라 현행 동작 100% 동일**(dormant).

- `src/lib/fedex-api.ts`
  - `FEDEX_LABEL_IMAGE_TYPE`(기본 `PDF`, `ZPLII` 지원), `FEDEX_LABEL_STOCK_TYPE`(기본 PDF=`PAPER_4X6`, ZPL=`STOCK_4X6`) env 추가.
  - `imageType` 를 env 로 결정. ZPLII 시 FedEx 가 준 base64 를 디코드한 **raw ZPL 버퍼를 그대로 반환** (재렌더 없음).
  - `FedexShipResult.labelFormat: 'pdf' | 'zpl'` 추가.
- `src/app/api/admin/orders/[id]/shipments/[shipmentId]/create-label/route.ts`
  - `labelFormat==='zpl'` 이면 `label.zpl` (`application/octet-stream`) 로 저장. 아니면 기존 `label.pdf`.

활성화 방법(옵션 A 채택 시): Vercel Production env 에
```
FEDEX_LABEL_IMAGE_TYPE=ZPLII
```
주입 후 재배포 → 라벨 생성하면 `.zpl` 파일이 떨어지고, 그 파일을 써멀 프린터에 그대로 보내면 됨.

## 5. 보드 결정 (확정됨 2026-06-22)
- 보드 회신: **매장에 써멀 Xprinter 보유, 9100 RAW 출력** → **옵션 A(ZPL) 확정**.
- 보드 추가 요청: "웹으로 구현해서 바로 뽑게(ZPL로)".

## 6. 웹 → Xprinter 직접 출력 구현 (OMO-3736, 2026-06-22)

### 왜 "브라우저에서 바로 9100" 이 안 되나
- 브라우저는 raw TCP(9100) 소켓을 못 연다(보안). 또 admin 앱이 Vercel(클라우드)에 떠 있으면
  서버도 매장 LAN 의 Xprinter(예: `192.168.0.50:9100`)에 도달 못 한다(NAT 뒤).
- 그래서 표준 패턴 = **매장 PC 에서 작은 로컬 브리지를 띄우고, 웹 버튼이 거기로 ZPL 을 보낸다.**

### 흐름
```
웹 admin "ZPL 바로 출력" 버튼
  → ZPL 원본을 서명URL에서 fetch (이미지 변환 없음)
  → POST http://localhost:9110/print  (로컬 브리지)
  → 브리지가 TCP 로 printer:9100 에 raw ZPL 전송
  → Xprinter 출력
```
(localhost 로의 http 요청은 Chrome/Firefox 가 mixed-content 로 막지 않음 — localhost 는 신뢰 출처)

### 구성요소 (모두 이번에 추가, 로컬 검증 완료)
- `scripts/zpl-print-bridge.mjs` — 매장 PC 로컬 브리지. 의존성 0(node 내장 net/http).
  실행: `PRINTER_HOST=192.168.0.50 node scripts/zpl-print-bridge.mjs`
- `scripts/fedex-zpl-print.mjs` — CLI 단발 출력(인증 테스트/폴백):
  `node scripts/fedex-zpl-print.mjs --host 192.168.0.50 label.zpl`
- `src/components/OrderShipments.tsx` — 라벨이 `.zpl` 이면 **"ZPL 바로 출력"** 버튼 표시(브리지 주소 1회 입력 후 localStorage 저장).
- `scripts/sample-4x6-label.zpl` — 하드웨어/브리지 점검용 샘플(바코드 포함).

### FedEx 인증 재제출 절차 (마감 7/10)
1. (먼저 하드웨어 점검) 매장 PC 에서 브리지 실행 →
   `node scripts/fedex-zpl-print.mjs --host <프린터IP> scripts/sample-4x6-label.zpl`
   → 샘플이 또렷하게 나오면 경로 정상.
2. Vercel Production env 에 `FEDEX_LABEL_IMAGE_TYPE=ZPLII` 주입 + 재배포(또는 샌드박스 먼저).
3. admin 에서 테스트 주문에 FedEx 라벨 생성 → `label.zpl` 저장됨.
4. "ZPL 바로 출력"(또는 CLI)로 Xprinter 출력 → **스캔**.
5. 스캔본을 FedEx case 27122658 메일에 **회신·첨부** (외부 발송은 사장님 계정 게이트, OMO-1908).
