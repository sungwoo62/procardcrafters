#!/usr/bin/env node
/**
 * ingest-workpool-transitions.mjs — OMO-2592 [북극성 축2]
 *
 * Paperclip activity 피드 스냅샷을 공유DB `ops_workpool_transitions`에 적재한다.
 *
 * 왜: activity API(`/companies/{id}/activity`)는 offset/before가 무시되고 최근 ~500건
 *     (≈수시간)만 반환한다(원장 t011). 따라서 전기간 MTTR/재작업률/재오픈율을 산출하려면
 *     상태전이를 주기적으로 스냅샷해 영속화해야 한다. 본 스크립트를 주 1회(또는 heartbeat)
 *     실행하면 윈도우가 겹쳐도 activity_id 유니크 dedup으로 중복 없이 누적된다.
 *
 * 적재 대상(상태전이만):
 *   - issue.updated  : details.status 존재 시 → from=details._previous.status, to=details.status
 *   - issue.created  : details.status 존재 시 → from=null, to=details.status (최초 진입)
 *
 * 자격증명:
 *   - Paperclip: env PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, PAPERCLIP_API_KEY
 *   - Supabase : .env.local 의 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service_role: RLS 우회)
 *
 * 사용법:  node scripts/analytics/ingest-workpool-transitions.mjs [--limit 500] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// --- args ---------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : 500; // activity API 사실상 상한

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

// --- main ---------------------------------------------------------------
async function main() {
  const feed = await fetchActivity();
  const rows = feed.map(toTransition).filter(Boolean);
  // 같은 배치 내 activity_id 중복 제거(이론상 없지만 방어).
  const seen = new Set();
  const unique = rows.filter((r) => (seen.has(r.activity_id) ? false : seen.add(r.activity_id)));

  console.log(`[ingest] activity ${feed.length}건 중 상태전이 ${unique.length}건 추출`);
  if (unique.length === 0) {
    console.log('[ingest] 적재할 전이 없음 — 종료');
    return;
  }
  if (DRY_RUN) {
    console.log('[ingest] --dry-run: 적재 생략. 샘플 3건:');
    for (const r of unique.slice(0, 3)) console.log('  ', JSON.stringify(r));
    return;
  }

  // PostgREST 배치 한도 회피용 청크 적재.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const inserted = await upsert(chunk);
    written += Array.isArray(inserted) ? inserted.length : 0;
  }
  console.log(`[ingest] 완료 — 신규 적재(중복 제외) ${written}건`);
}

main().catch((err) => {
  console.error('[ingest] 실패:', err.message);
  process.exit(1);
});
