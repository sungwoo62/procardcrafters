# 종합인쇄(print-site) 견적/주문 회신메일 테스트 발송 산출물 — OMO-2840

부모: OMO-2835 / 구현 이슈: OMO-2840

## 기능 요약
어드민이 입력한 임의 이메일 주소로, **고객에게 실제로 나가는 회신메일과 100% 동일한** 내용을 테스트 발송한다.

- API: `POST /api/admin/test-quote-email` — body `{ orderId?, quoteId?, sampleType?, toEmail }`
  - 본문/제목은 실제 고객 회신메일 빌더(`buildOrderStatusEmail` → `buildEmailHtml`)를 그대로 재사용 → drift 불가.
  - `to`는 입력 `toEmail` 로만 강제. 실고객/CC/BCC 발송 없음.
  - 제목에 `[테스트]` 프리픽스만 추가.
  - `orderId` 있으면 `print_orders` 실데이터, 없으면 대표 샘플(`SAMPLE_ORDER_EMAIL_DATA`).
  - 어드민 인증(`requireAdmin`) + 인메모리 레이트리밋(어드민당 60초 5회).
- 어드민 UI: `/admin/test-email` — 이메일 input + 샘플 유형 선택 + 주문 ID(선택) + "테스트 발송" 버튼 + 결과 토스트 + 미리보기(iframe). 한국어.

## 산출물 이미지
- `email-sample.png` — 견적/주문 회신메일 HTML 렌더 (sampleType=`paid`, 대표 샘플 데이터). 제목의 `[테스트]` 프리픽스 포함.
  - 실제 빌더 `buildOrderStatusEmail('paid', SAMPLE_ORDER_EMAIL_DATA)` 출력을 그대로 렌더 (`scripts/omo2840-render-sample.mts`).
- `email-sample.html` — 위 PNG의 원본 HTML.

## 견적 PDF 첨부에 대한 참고 (아키텍처 차이)
이 print-site 레포(procardcrafters)는 **별도 견적(quote) 엔티티나 견적 PDF 생성 파이프라인이 없다.**
고객 회신메일은 주문상태 기반 HTML 이메일(`sendOrderStatusEmail`)이며 PDF 첨부가 없다.
따라서 "고객에게 나갈 것과 100% 동일"을 보장하기 위해 테스트 메일도 PDF를 첨부하지 않는다(첨부 시 오히려 실제 메일과 불일치).
- 견적 PDF 시스템이 추후 도입되면, 본 빌더 재사용 구조를 그대로 확장해 첨부를 추가하면 된다.

## 라이브 발송 검증 (필요 작업)
- 로컬/현재 작업환경에는 `RESEND_API_KEY` 가 없어 실제 발송이 비활성(미리보기만 생성)된다.
- 키가 설정된 배포 환경에서 `/admin/test-email` 로 본인 메일에 테스트 발송 → 수신 스크린샷을 첨부하면 검증 완료.
