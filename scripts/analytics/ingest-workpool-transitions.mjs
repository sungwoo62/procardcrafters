#!/usr/bin/env node
/**
 * ingest-workpool-transitions.mjs — OMO-2592 [북극성 축2]
 *
 * Paperclip activity 피드 스냅샷을 공유DB `ops_workpool_transitions`에 적재한다.
 *
 * 왜: activity API(`/companies/{id}/activity`)는 offset/before가 무시되고 최근 ~500건
 *     (≈4.2시간)만 반환한다(원장 t011). 따라서 전기간 MTTR/재작업률/재오픈율을 산출하려면
 *     상태전이를 주기적으로 스냅샷해 영속화해야 한다. 본 스크립트를 매 2시간(Paperclip 루틴
 *     "OMO-2592 work-pool 상태전이 스냅샷 적재", cron `0 0/2 * * *` = 짝수시 정각) 실행하면
 *     윈도우가 50% 겹쳐 누락 없이, activity_id 유니크 dedup으로 중복 없이 누적된다.
 *     (주의: JSDoc 블록 주석 안에서는 cron 표기에 `*` + `/` 연속을 쓰지 말 것 — 주석이 조기 종료됨.)
 *
 * 적재 대상(상태전이만):
 *   - issue.updated  : details.status 존재 시 → from=details._previous.status, to=details.status
 *   - issue.created  : details.status 존재 시 → from=null, to=details.status (최초 진입)
 *
 * 자격증명:
 *   - Paperclip: env PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, PAPERCLIP_API_KEY
 *   - Supabase : .env.local 의 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service_role: RLS 우회)
 *
 * 실행 이슈 자기-숨김(OMO-2802):
 *   - 본 루틴은 2시간마다 routine_execution 이슈를 새로 생성해 이슈리스트를 도배한다(보드 OMO-2797).
 *   - 메트릭 적재는 그대로 유지하되, 적재 성공 후 자기 run 이슈에 hiddenAt 을 설정해 리스트에서 숨긴다.
 *   - 가드: env PAPERCLIP_TASK_ID 의 이슈가 originKind==='routine_execution' && originId===ROUTINE_ID 일 때만 숨김.
 *     → 수동/할당 이슈에서 스크립트를 직접 돌려도 그 이슈를 절대 숨기지 않는다(오작동 방지).
 *   - best-effort: 숨김 실패는 ingest 성공을 무효화하지 않는다(메트릭 연속성 우선). 경고만 남기고 계속.
 *   - --dry-run 또는 --no-hide 시 숨김 생략. PATCH /api/issues/{id} body {status,hiddenAt}.
 *
 * 사용법:  node scripts/analytics/ingest-workpool-transitions.mjs [--limit 500] [--dry-run] [--no-hide]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// --- args ---------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NO_HIDE = args.includes('--no-hide');
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : 500; // activity API 사실상 상한

// OMO-2802: 자기-숨김 가드. 이 루틴(OMO-2592)의 routine_execution 이슈만 숨긴다.
const ROUTINE_ID = '67f95f1b-1aa3-46fa-a411-93b582d6748a';

// --- env ----------------------------------------------------------------
function readEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const local = readEnvLocal();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || local.SUPABASE_SERVICE_ROLE_KEY;
const PC_API = process.env.PAPERCLIP_API_URL || process.env.PAPERCLIP_RUNTIME_API_URL;
const PC_COMPANY = process.env.PAPERCLIP_COMPANY_ID;
const PC_KEY = process.env.PAPERCLIP_API_KEY;

function requireEnv(name, val) {
  if (!val) {
    console.error(`[ingest] 환경변수 누락: ${name}`);
    process.exit(1);
  }
}
requireEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
requireEnv('PAPERCLIP_API_URL', PC_API);
requireEnv('PAPERCLIP_COMPANY_ID', PC_COMPANY);
requireEnv('PAPERCLIP_API_KEY', PC_KEY);

// --- fetch activity feed ------------------------------------------------
async function fetchActivity() {
  const url = `${PC_API}/api/companies/${PC_COMPANY}/activity?limit=${LIMIT}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${PC_KEY}` } });
  if (!res.ok) throw new Error(`activity API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('activity 응답이 배열이 아님');
  return data;
}

// --- extract transitions ------------------------------------------------
function toTransition(ev) {
  const d = ev.details;
  if (!d || typeof d !== 'object') return null;
  let fromStatus = null;
  let toStatus = null;
  if (ev.action === 'issue.updated' && typeof d.status === 'string') {
    fromStatus = d._previous?.status ?? null;
    toStatus = d.status;
    if (fromStatus === toStatus) return null; // status가 변하지 않은 update는 전이 아님
  } else if (ev.action === 'issue.created' && typeof d.status === 'string') {
    fromStatus = null;
    toStatus = d.status;
  } else {
    return null;
  }
  return {
    activity_id: ev.id,
    issue_id: ev.entityId,
    identifier: d.identifier ?? null,
    from_status: fromStatus,
    to_status: toStatus,
    at: ev.createdAt,
    actor_agent_id: ev.agentId ?? (ev.actorType === 'agent' ? ev.actorId : null) ?? null,
    run_id: ev.runId ?? null,
  };
}

// --- upsert into Supabase (dedup on activity_id) ------------------------
async function upsert(rows) {
  const url = `${SUPABASE_URL}/rest/v1/ops_workpool_transitions?on_conflict=activity_id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      // merge-duplicates: 겹치는 윈도우 재적재 시 중복 없이 무시/갱신. count로 적재 수 확인.
      Prefer: 'resolution=merge-duplicates,return=representation,count=exact',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- 자기-숨김(OMO-2802) ------------------------------------------------
// 적재 성공 후, 이 실행이 루틴 실행 이슈라면 hiddenAt 을 설정해 이슈리스트에서 숨긴다.
// 절대 실패를 던지지 않는다(best-effort) — 메트릭 적재가 끝난 뒤 호출되며, 숨김 실패가
// ingest 성공을 무효화하면 안 된다. 다음 사이클에서 다시 시도된다.
async function hideOwnRunIssue() {
  if (NO_HIDE) {
    console.log('[hide] --no-hide: 자기-숨김 생략');
    return;
  }
  const issueId = process.env.PAPERCLIP_TASK_ID;
  if (!issueId) {
    console.log('[hide] PAPERCLIP_TASK_ID 없음 — 루틴 컨텍스트 아님, 숨김 생략');
    return;
  }
  if (!PC_API || !PC_KEY) {
    console.warn('[hide] Paperclip 자격증명 없음 — 숨김 생략');
    return;
  }
  try {
    // 1) 자기 이슈 조회: 루틴 실행 이슈인지 가드 + 현재 status 확보(단독 hiddenAt 회피).
    const getRes = await fetch(`${PC_API}/api/issues/${issueId}`, {
      headers: { Authorization: `Bearer ${PC_KEY}` },
    });
    if (!getRes.ok) {
      console.warn(`[hide] 이슈 조회 실패 ${getRes.status} — 숨김 생략`);
      return;
    }
    const issue = await getRes.json();

    // 가드: 우리 루틴의 routine_execution 이슈만 숨긴다. 수동/할당 이슈는 절대 건드리지 않음.
    if (issue.originKind !== 'routine_execution' || issue.originId !== ROUTINE_ID) {
      console.log(
        `[hide] 루틴 실행 이슈 아님(originKind=${issue.originKind}, originId=${issue.originId}) — 숨김 생략`,
      );
      return;
    }
    if (issue.hiddenAt) {
      console.log(`[hide] 이미 숨김 처리됨(${issue.hiddenAt}) — 생략`);
      return;
    }

    // 2) status 동반 PATCH(단독 hiddenAt 은 400). 현재 status 를 그대로 유지.
    const hiddenAt = new Date().toISOString();
    const patchRes = await fetch(`${PC_API}/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PC_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: issue.status, hiddenAt }),
    });
    if (!patchRes.ok) {
      console.warn(`[hide] hiddenAt PATCH 실패 ${patchRes.status}: ${await patchRes.text()}`);
      return;
    }
    console.log(`[hide] 완료 — ${issue.identifier ?? issueId} hiddenAt=${hiddenAt} (이슈리스트에서 숨김)`);
  } catch (err) {
    // best-effort: 어떤 오류도 ingest 성공을 무효화하지 않는다.
    console.warn(`[hide] 자기-숨김 중 오류(무시): ${err.message}`);
  }
}

// --- 형제 실행 이슈 스윕(OMO-2802) --------------------------------------
// 자기-숨김(hideOwnRunIssue)은 "스크립트가 실행된" 사이클만, 그것도 일시적 실패 없이 끝났을 때만
// 숨긴다. 이 스윕은 최근 24h(≈12 사이클) 실행 이슈 중 아직 보이는(hiddenAt 없는) 우리 루틴의
// 이슈를 다시 숨겨, 자기-숨김이 한 번 실패해도 다음 정상 사이클이 복구하게 한다(self-hide 재시도).
//   주의(한계): 인증 실패로 blocked 된 실행 이슈는 보드 에이전트(2bb373e7)로 재배정되며,
//   "Agent cannot mutate another agent's issue"(403)로 본 에이전트가 숨길 수 없다. 스크립트도
//   아예 돌지 못한다. → blocked 실행 이슈는 보드/플랫폼만 정리 가능(이슈의 근본 개선 제안 참조:
//   routine_execution 자동 숨김 / hiddenRuns 플래그). 개별 403은 아래에서 조용히 건너뛴다.
// best-effort: 어떤 실패도 ingest 성공을 무효화하지 않는다.
async function sweepVisibleRoutineIssues() {
  if (NO_HIDE) return;
  if (!PC_API || !PC_KEY) return;
  try {
    const runsRes = await fetch(`${PC_API}/api/routines/${ROUTINE_ID}/runs?limit=12`, {
      headers: { Authorization: `Bearer ${PC_KEY}` },
    });
    if (!runsRes.ok) {
      console.warn(`[sweep] 루틴 runs 조회 실패 ${runsRes.status} — 스윕 생략`);
      return;
    }
    const body = await runsRes.json();
    const runs = Array.isArray(body) ? body : body.runs ?? [];
    const issueIds = [
      ...new Set(runs.map((r) => r.linkedIssueId ?? r.linkedIssue?.id).filter(Boolean)),
    ];
    let hidden = 0;
    for (const id of issueIds) {
      try {
        const gr = await fetch(`${PC_API}/api/issues/${id}`, {
          headers: { Authorization: `Bearer ${PC_KEY}` },
        });
        if (!gr.ok) continue;
        const d = await gr.json();
        // 가드: 우리 루틴의 실행 이슈 + 아직 보이는 것만.
        if (d.originKind !== 'routine_execution' || d.originId !== ROUTINE_ID) continue;
        if (d.hiddenAt) continue;
        const pr = await fetch(`${PC_API}/api/issues/${id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${PC_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: d.status, hiddenAt: new Date().toISOString() }),
        });
        if (pr.ok) {
          hidden += 1;
          console.log(`[sweep] 숨김 — ${d.identifier ?? id} (status=${d.status})`);
        }
      } catch {
        // 개별 이슈 실패는 건너뛴다.
      }
    }
    console.log(`[sweep] 완료 — 최근 실행 이슈 ${issueIds.length}건 점검, 추가 숨김 ${hidden}건`);
  } catch (err) {
    console.warn(`[sweep] 스윕 중 오류(무시): ${err.message}`);
  }
}

// --- main ---------------------------------------------------------------
async function main() {
  const feed = await fetchActivity();
  const rows = feed.map(toTransition).filter(Boolean);
  // 같은 배치 내 activity_id 중복 제거(이론상 없지만 방어).
  const seen = new Set();
  const unique = rows.filter((r) => (seen.has(r.activity_id) ? false : seen.add(r.activity_id)));

  console.log(`[ingest] activity ${feed.length}건 중 상태전이 ${unique.length}건 추출`);

  if (DRY_RUN) {
    console.log('[ingest] --dry-run: 적재/숨김 생략. 샘플 3건:');
    for (const r of unique.slice(0, 3)) console.log('  ', JSON.stringify(r));
    return;
  }

  if (unique.length === 0) {
    console.log('[ingest] 적재할 전이 없음 — upsert 생략');
  } else {
    // PostgREST 배치 한도 회피용 청크 적재.
    const CHUNK = 500;
    let upserted = 0;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);
      const inserted = await upsert(chunk);
      upserted += Array.isArray(inserted) ? inserted.length : 0;
    }
    // 주의: return=representation 은 신규 insert + 기존 merge 행을 모두 돌려준다.
    // 따라서 upserted는 "이번 배치에서 처리한 전이 수"이지 "순증(net-new) 행 수"가 아니다.
    // 실제 중복 제거는 DB의 activity_id UNIQUE 제약이 보장한다(겹치는 윈도우 재적재해도 행 수 불변).
    console.log(`[ingest] 완료 — 전이 ${upserted}건 upsert (activity_id 유니크로 중복은 DB에서 자동 dedup, 순증 아님)`);
  }

  // OMO-2802: 적재 사이클 완료 후 자기 run 이슈를 숨긴다(전이 0건이어도 실행 이슈는 숨김).
  // best-effort — 내부에서 예외를 삼키므로 ingest 성공에 영향 없음.
  await hideOwnRunIssue();
  // 인증 실패로 blocked 됐던 과거 실행 이슈 등 아직 보이는 형제 실행 이슈도 함께 정리(자기-치유).
  await sweepVisibleRoutineIssues();
}

main().catch((err) => {
  console.error('[ingest] 실패:', err.message);
  process.exit(1);
});
