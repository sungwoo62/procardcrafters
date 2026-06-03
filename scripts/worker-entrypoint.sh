#!/bin/bash
# 공장 발주 worker — 5분마다 pending 발주를 처리한다

INTERVAL=${POLL_INTERVAL_SECONDS:-300}

echo "[worker] 공장 발주 worker 시작 (폴링 간격: ${INTERVAL}초)"

while true; do
  echo "[worker] $(date -u +%Y-%m-%dT%H:%M:%SZ) 발주 처리 실행"
  node --experimental-strip-types scripts/place-factory-orders.ts \
    || echo "[worker] 스크립트 오류 (exit non-zero), ${INTERVAL}초 후 재실행"
  echo "[worker] $(date -u +%Y-%m-%dT%H:%M:%SZ) 대기 중 (${INTERVAL}초)"
  sleep "$INTERVAL"
done
