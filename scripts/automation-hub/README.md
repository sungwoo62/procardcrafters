# 공장 자동발주 무인 결선 (OMO-2716)

결제완료 → 공장(성원애드피아) 발주가 사람 손 없이 끝나는 파이프.

## 흐름

```
[Vercel] 결제 웹훅
   → queueFactoryOrdersForPrintOrder()
       ├─ print_factory_orders  INSERT (pending)              ← 발주 명세
       └─ ops_automation_jobs    INSERT (factory.swadpia.send) ← 무인 작업 신호
                                       │
[Mac-Studio] automation-worker.py (allpack-ops, launchd 24/7)
   → ops_automation_claim_job (원자적 클레임)
   → POST http://127.0.0.1:18790/agent/swadpia-runner/message { printOrderId }
                                       │
[Mac-Studio] factory-runner.ts (이 디렉터리, launchd 24/7, :18790)
   → processPendingFactoryOrders(printOrderId)
       → placeSwadpiaOrder()  (Playwright → 성원 로그인·옵션·업로드·결제)
       → print_factory_orders = placed, print_orders = processing
       → 고객 이메일 + 이벤트 로그
   실패 → 재시도(record attempt_count, worker 백오프) → 최종 실패 시
          관리자 이메일 + 사장님 텔레그램 알림
```

핵심 발주 로직은 `src/lib/factory-order-processor.ts` 한 곳에 있고,
배치 폴백(`scripts/place-factory-orders.ts`)과 이 게이트웨이가 공유한다.

## 재시도 계약 (워커 ↔ 게이트웨이)

- `2xx` : 모든 발주 종결(placed/failed/dryRun/skip) → 워커 `job=done`.
- `5xx` : 인프라 오류 또는 transient 재시도 필요(record 여전히 pending)
          → 워커가 지수 백오프 후 동일 job 재시도 = 무인 재시도.

## 설치 (맥스튜디오)

```bash
# procardcrafters 체크아웃에 node_modules + Playwright + .env.local 준비 후
bash scripts/automation-hub/setup-factory-runner.sh
```

필요 env (`.env.local`):
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SWADPIA_USERNAME`, `SWADPIA_PASSWORD`,
`RESEND_API_KEY`+`ADMIN_NOTIFICATION_EMAIL`(선택),
`TELEGRAM_BOT_TOKEN`+`TELEGRAM_OWNER_CHAT_ID`(사장님 알림, 선택).

## 무인 검증 (DRY RUN — 실주문·결제 없이)

`SWADPIA_DRY_RUN=1` 이면 결제서(order_pay) 페이지까지만 무인 도달하고
`paySubmit()` 직전에 멈춰 스크린샷을 남긴다(미결제). 큐→워커→게이트웨이→Playwright
전 구간을 돈 안 쓰고 검증할 수 있다.

```bash
# 1) 게이트웨이를 dry-run 으로 띄우기
SWADPIA_DRY_RUN=1 node --env-file=.env.local --import tsx scripts/automation-hub/factory-runner.ts &

# 2) 테스트 job enqueue (paid 상태의 테스트 주문 id 사용)
#    ops_automation_jobs 에 {service:'factory', action:'factory.swadpia.send',
#    payload:{printOrderId:'<test>'}} INSERT → 워커가 드레인 → 게이트웨이 호출
```

## 관련

- 인프라(큐·워커·launchd): allpack-ops `scripts/automation-hub/` (OMO-2715)
- 배치 폴백/청소부: `scripts/place-factory-orders.ts`
- Vercel cron(적체 알림 폴백): `src/app/api/cron/factory-orders/route.ts`
