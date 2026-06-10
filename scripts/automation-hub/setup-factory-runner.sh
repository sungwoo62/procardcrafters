#!/usr/bin/env bash
# 공장 발주 러너 게이트웨이 — 맥스튜디오 설치/등록 (OMO-2716)
#
# 전제: 이 스크립트가 있는 procardcrafters 체크아웃에 node_modules + Playwright +
#       .env.local(SUPABASE/SWADPIA/RESEND/TELEGRAM 키) 가 준비되어 있어야 한다.
#
# 사용법:
#   bash scripts/automation-hub/setup-factory-runner.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_SRC="$REPO_DIR/scripts/automation-hub/com.procardcrafters.factory-runner.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.procardcrafters.factory-runner.plist"
LABEL="com.procardcrafters.factory-runner"

echo "[setup] 체크아웃: $REPO_DIR"

if [ ! -f "$REPO_DIR/.env.local" ]; then
  echo "[setup] 경고: $REPO_DIR/.env.local 없음 — SWADPIA/SUPABASE 키 필요." >&2
fi

# WorkingDirectory 를 실제 체크아웃 경로로 치환하여 설치
mkdir -p "$HOME/Library/LaunchAgents"
sed "s#<string>/Users/william/procardcrafters</string>#<string>$REPO_DIR</string>#" \
  "$PLIST_SRC" > "$PLIST_DST"

echo "[setup] plist 설치: $PLIST_DST"

# 재등록
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

sleep 2
echo "[setup] 헬스 체크:"
curl -s http://127.0.0.1:18790/health || echo "  (아직 미응답 — /tmp/factory-runner.error.log 확인)"
echo
echo "[setup] 완료. 로그: /tmp/factory-runner.log"
