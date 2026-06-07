#!/bin/bash
# 공장 발주 worker — 5분마다 pending 발주를 처리하고 파이프라인 헬스(드리프트/self-heal)를 점검한다.
# Vercel Hobby 플랜은 크론을 하루 1회로 제한하므로, 빈번한 드리프트 감지·재할당은
# 여기(워커 루프)에서 헬스 엔드포인트를 호출해 수행한다(서버리스 로직 100% 재사용).

INTERVAL=${POLL_INTERVAL_SECONDS:-300}
SITE_URL=${NEXT_PUBLIC_SITE_URL:-https://procardcrafters.com}

echo "[worker] 공장 발주 worker 시작 (폴링 간격: ${INTERVAL}초)"

while true; do
  echo "[worker] $(date -u +%Y-%m-%dT%H:%M:%SZ) 발주 처리 실행"
  node --experimental-strip-types scripts/place-factory-orders.ts \
    || echo "[worker] 스크립트 오류 (exit non-zero), ${INTERVAL}초 후 재실행"

  # 파이프라인 헬스 점검 (stalled placing 자동 재할당 + 드리프트 감지/알림).
  # CRON_SECRET 미설정 시 건너뛴다.
  if [ -n "$CRON_SECRET" ]; then
    echo "[worker] $(date -u +%Y-%m-%dT%H:%M:%SZ) 파이프라인 헬스 점검"
    curl -fsS -m 35 -H "Authorization: Bearer ${CRON_SECRET}" \
      "${SITE_URL}/api/cron/factory-pipeline-health" \
      || echo "[worker] 헬스 점검 호출 실패 (무시하고 계속)"
    echo ""
  fi

  echo "[worker] $(date -u +%Y-%m-%dT%H:%M:%SZ) 대기 중 (${INTERVAL}초)"
  sleep "$INTERVAL"
done
