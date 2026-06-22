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

## 5. 보드 결정 필요 (인증 재제출이 여기서 갈림)
- **배송 현장 프린터가 써멀(ZPL)인가, 레이저/잉크젯인가?** → 이 답으로 A/B 확정.
- 결정 후: 해당 포맷으로 라벨 1장 생성 → FedEx case 27122658 메일에 회신·첨부 (7/10 전).
