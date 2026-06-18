#!/usr/bin/env bash
# predeploy-guard.sh — procardcrafters.com 라이브 배포 안전 가드 (OMO-2913 R3)
#
# vercel --prod 직전에 실행한다. 하나라도 실패하면 비정상 종료(exit 1)하여 배포를 막는다.
#   ① 현재 브랜치 == 라이브 배포 브랜치(omo-2716-factory-autopilot)
#   ② 워킹트리 클린 (미커밋/미추적 변경 없음)
#   ③ 로컬 HEAD == 원격(gh) 라이브 HEAD (미배포/미푸시 불일치 방지)
#
# 사용:  bash scripts/predeploy-guard.sh   (PASS 시 배포 SHA 출력)
set -euo pipefail

LIVE_BRANCH="omo-2716-factory-autopilot"
REMOTE="gh"
fail=0

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$1"; }

echo "=== procardcrafters 배포 전 가드 (OMO-2913) ==="

# ① 브랜치 검증
cur_branch="$(git branch --show-current)"
if [ "$cur_branch" = "$LIVE_BRANCH" ]; then
  green "① 브랜치 OK: $cur_branch"
else
  red "① 브랜치 위반: 현재 '$cur_branch' ≠ 라이브 '$LIVE_BRANCH'"
  red "   → 라이브 워크트리(/Users/william/projects/pccf-live)에서 배포하세요. DEPLOY.md 참조."
  fail=1
fi

# ② 클린 검증
if [ -z "$(git status --porcelain)" ]; then
  green "② 워킹트리 클린 OK"
else
  red "② 워킹트리 더티: 미커밋/미추적 변경 있음. 커밋 또는 stash 후 배포."
  git status --short | sed 's/^/     /'
  fail=1
fi

# ③ 원격 동기화 검증
git fetch "$REMOTE" "$LIVE_BRANCH" --quiet 2>/dev/null || yellow "   (원격 fetch 실패 — 네트워크 확인)"
local_sha="$(git rev-parse HEAD)"
if remote_sha="$(git rev-parse "$REMOTE/$LIVE_BRANCH" 2>/dev/null)"; then
  if [ "$local_sha" = "$remote_sha" ]; then
    green "③ 원격 동기화 OK: $(git rev-parse --short HEAD)"
  else
    ahead="$(git rev-list --count "$REMOTE/$LIVE_BRANCH"..HEAD 2>/dev/null || echo '?')"
    behind="$(git rev-list --count HEAD.."$REMOTE/$LIVE_BRANCH" 2>/dev/null || echo '?')"
    red "③ 원격 불일치: 로컬 ${ahead} 앞 / ${behind} 뒤 (원격 $REMOTE/$LIVE_BRANCH)"
    red "   → push 또는 pull로 동기화 후 배포. 미배포 커밋 추적은 DEPLOY.md §3 참조."
    fail=1
  fi
else
  yellow "③ 원격 $REMOTE/$LIVE_BRANCH 조회 불가 — 수동 확인 필요"
fi

echo "================================================"
if [ "$fail" -ne 0 ]; then
  red "❌ 가드 FAIL — 배포 중단. 위 항목을 해결하세요."
  exit 1
fi

green "✅ 가드 PASS — 배포 가능"
echo "   배포 SHA: $(git rev-parse --short HEAD)  (브랜치 $LIVE_BRANCH)"
echo "   배포 후: 'vercel --prod' 실행하고 위 SHA를 배포 이슈 코멘트에 기록할 것 (DEPLOY.md §2-4)."
