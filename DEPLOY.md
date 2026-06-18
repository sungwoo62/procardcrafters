# 배포 가이드 — procardcrafters.com (필수 준수)

> ⚠️ **라이브 전멸 위험 방지 문서.** `vercel --prod` 전 반드시 이 문서를 읽고 가드를 통과시킬 것.
> 근거: [OMO-2911](/OMO/issues/OMO-2911) Dev-Print 발견 위험 → [OMO-2913](/OMO/issues/OMO-2913) CEO 승인 안전 가드.

## 1. 라이브 배포 소스 (단일 진실원천)

| 항목 | 값 |
|------|-----|
| **라이브 배포 브랜치** | **`omo-2716-factory-autopilot`** ← 풀 이커머스, procardcrafters.com 소스 |
| Vercel 프로젝트 | `procardcrafters` (`prj_CDp6tmjJSFiXoBtWBjVSVEvUiTkn`) |
| 라이브 도메인 | procardcrafters.com / www.procardcrafters.com |
| 배포 방식 | CLI 직접 배포 (`vercel --prod`) — Git 자동배포 미연결 |

### ❌ 배포 금지 브랜치 (라이브 아님)
- `feature/OMO-2774-support-ai-inbox` — **빌드 실패하는 별개 미니앱** (에이전트 기본 체크아웃). AI support inbox / `/quote` 보유. **절대 prod 배포 금지.**
- `main` — 구 미니앱 계열. 라이브 아님.
- 기타 `feature/*`, `fix/*`, `omo-*` 작업 브랜치 — PR/리뷰용.

> 에이전트 기본 체크아웃 `/Users/william/projects/procardcrafters`는 위험 브랜치(`feature/OMO-2774`)에 있을 수 있다.
> **라이브 배포는 반드시 `omo-2716-factory-autopilot` 브랜치 워크트리에서 수행한다.**

## 2. 배포 절차 (R3 가드)

### 2-1. 라이브 워크트리 준비 (1회)
```bash
cd /Users/william/projects/procardcrafters
git worktree add /Users/william/projects/pccf-live omo-2716-factory-autopilot
```
이후 배포는 항상 `/Users/william/projects/pccf-live`에서 수행한다.

### 2-2. 배포 전 사전 점검 (필수)
```bash
cd /Users/william/projects/pccf-live
git fetch gh
bash scripts/predeploy-guard.sh   # ① 브랜치 ② 클린 ③ 원격 동기화 검증
```
가드가 **PASS**가 아니면 배포하지 않는다.

### 2-3. 배포 실행
```bash
vercel --prod    # /Users/william/projects/pccf-live 에서
```

### 2-4. 배포 후 기록 (필수)
배포한 **커밋 SHA**를 배포 이슈 코멘트에 남긴다:
```bash
git rev-parse --short HEAD   # 이 SHA를 이슈 코멘트에 기록
```
형식 예: `배포 완료: <deployment-url> ← 커밋 <SHA> (브랜치 omo-2716-factory-autopilot)`

## 3. 미배포 커밋 확인
배포 전, 원격 라이브 브랜치 HEAD가 prod에 반영됐는지 확인한다. CLI 직접 배포는 git 메타가 남지 않으므로 **배포 시 SHA를 이슈에 기록하는 것이 유일한 추적 수단**이다(2-4 참조).

```bash
git log --oneline gh/omo-2716-factory-autopilot -5   # 원격 라이브 HEAD 확인
```

## 4. 롤백
```bash
vercel ls procardcrafters --prod          # 직전 Ready 배포 URL 확인
vercel promote <직전-deployment-url>       # 또는 vercel rollback
```

---
_관리: Dev-Print. 변경 시 OMO-2913 또는 후속 이슈에 근거 기록._
