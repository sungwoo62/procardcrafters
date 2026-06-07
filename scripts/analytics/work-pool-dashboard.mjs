#!/usr/bin/env node
/**
 * work-pool-dashboard.mjs — OMO-2592 [북극성 축2: 성과측정 및 평가]
 *
 * 전기간 MTTR / 재작업률 / 재오픈율을 공유DB `ops_workpool_transitions`에서 계산한다.
 *
 * 왜 activity가 아니라 테이블인가: activity API는 offset/before 무시 + 최근 ~500건(≈수시간)만
 *   반환해 전기간 상태전이 지표를 산출할 수 없다(원장 t011). 그래서 OMO-2592가 전이를 영속화했고,
 *   ingest-workpool-transitions.mjs 가 주기적으로 스냅샷을 누적한다. 본 대시보드는 그 누적분을 읽는다.
 *
 * 지표 정의:
 *   - 상태 랭크: todo=0 → in_progress=1 → in_review=2 → done=3 (blocked는 사이드 상태, 랭크 제외)
 *   - Blocker MTTR: blocked 진입(to=blocked)부터 다음 비-blocked 전이(to≠blocked)까지 구간의 평균/중앙값.
 *                   세션 종료 시점까지 미해소면 '미해소 blocker'로 별도 집계.
 *   - 재작업률: 도달했던 최고 랭크보다 낮은 활성 상태로 되돌아간 이슈 비율(역행 = 재작업).
 *   - 재오픈율: done 도달 이슈 중, 이후 활성 상태(todo/in_progress/in_review)로 돌아간 이슈 비율.
 *
 * ⚠️ 데이터 함정(OMO-2592 실측): activity 피드의 from_status(_previous.status)는 누락·stale가 잦다
 *   (예: blocked→done인데 from이 in_progress로 기록). 따라서 모든 지표는 from_status가 아니라
 *   권위 있는 to_status 시퀀스로 계산한다. from_status는 적재만 하고 산출 로직에 신뢰하지 않는다.
 *
 * 한계: 테이블은 적재 시작 이후 누적분만 보유한다. 첫 풀 백필 전까지 윈도우가 짧으면 본 리포트가
 *       명시적으로 '데이터 부족'을 표기한다(추측으로 채우지 않음).
 *
 * 사용법:  node scripts/analytics/work-pool-dashboard.mjs [--json] [--days N]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const daysArg = args.indexOf('--days');
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : null; // null = 전기간

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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[dashboard] SUPABASE_URL / SERVICE_ROLE_KEY 누락');
  process.exit(1);
}

const RANK = { todo: 0, in_progress: 1, in_review: 2, done: 3 };

async function fetchAll() {
  const rows = [];
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/ops_workpool_transitions`);
    url.searchParams.set('select', 'issue_id,identifier,from_status,to_status,at');
    url.searchParams.set('order', 'issue_id.asc,at.asc');
    if (DAYS != null) {
      // Date.now 의존 없이 DB 기준 필터는 곤란 → 클라이언트 컷오프 대신 전체 적재 후 JS 필터.
    }
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${offset}-${offset + PAGE - 1}`,
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`select ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

function computeMetrics(rows) {
  // 기간 필터 (옵션). 컷오프는 데이터 최대 시각 기준 상대 N일.
  let filtered = rows;
  let windowStart = null;
  let windowEnd = null;
  if (rows.length) {
    const times = rows.map((r) => new Date(r.at).getTime());
    windowEnd = Math.max(...times);
    windowStart = Math.min(...times);
    if (DAYS != null) {
      const cutoff = windowEnd - DAYS * 86400_000;
      filtered = rows.filter((r) => new Date(r.at).getTime() >= cutoff);
      windowStart = cutoff;
    }
  }

  // 이슈별 시간순 그룹.
  const byIssue = new Map();
  for (const r of filtered) {
    if (!byIssue.has(r.issue_id)) byIssue.set(r.issue_id, []);
    byIssue.get(r.issue_id).push(r);
  }

  const blockerDurations = []; // ms
  let openBlockers = 0;
  const openBlockerList = [];
  let reworkIssues = 0;
  let everDoneIssues = 0;
  let reopenedIssues = 0;
  const reopenedList = [];

  for (const [, trs] of byIssue) {
    trs.sort((a, b) => new Date(a.at) - new Date(b.at));
    let blockedSince = null;
    let hadRework = false;
    let everDone = false;
    let reopened = false;
    let maxRank = -1; // 도달했던 최고 활성 랭크

    // 전이의 to_status(권위 상태)만으로 판정 — from_status는 stale할 수 있어 신뢰하지 않음.
    for (const t of trs) {
      const tr = RANK[t.to_status];

      // --- blocked 구간: 진입(to=blocked) → 다음 비-blocked 전이에서 해소 ---
      if (t.to_status === 'blocked') {
        if (blockedSince == null) blockedSince = new Date(t.at).getTime();
      } else if (blockedSince != null) {
        blockerDurations.push(new Date(t.at).getTime() - blockedSince);
        blockedSince = null;
      }

      // --- 재작업(역행): 최고 도달 랭크보다 낮은 활성 상태로 회귀 ---
      if (tr != null) {
        if (maxRank >= 0 && tr < maxRank) hadRework = true;
        if (tr > maxRank) maxRank = tr;
      }

      // --- done 도달 / 재오픈(done 이후 활성 상태 복귀) ---
      if (t.to_status === 'done') everDone = true;
      else if (everDone && tr != null) reopened = true; // done 이후 todo/in_progress/in_review
    }

    if (blockedSince != null) {
      openBlockers++;
      openBlockerList.push({ identifier: trs[0].identifier, since: new Date(blockedSince).toISOString() });
    }
    if (hadRework) reworkIssues++;
    if (everDone) everDoneIssues++;
    if (reopened) reopenedIssues++, reopenedList.push(trs[0].identifier);
  }

  const totalIssues = byIssue.size;
  const sum = blockerDurations.reduce((a, b) => a + b, 0);
  const sorted = [...blockerDurations].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;

  return {
    window: {
      start: windowStart ? new Date(windowStart).toISOString() : null,
      end: windowEnd ? new Date(windowEnd).toISOString() : null,
      transitions: filtered.length,
      issues: totalIssues,
    },
    mttr: {
      resolvedBlockers: blockerDurations.length,
      meanHours: blockerDurations.length ? +(sum / blockerDurations.length / 3600_000).toFixed(2) : null,
      medianHours: median != null ? +(median / 3600_000).toFixed(2) : null,
      openBlockers,
      openBlockerList,
    },
    rework: {
      reworkIssues,
      totalIssues,
      ratePct: totalIssues ? +((reworkIssues / totalIssues) * 100).toFixed(1) : null,
    },
    reopen: {
      reopenedIssues,
      everDoneIssues,
      ratePct: everDoneIssues ? +((reopenedIssues / everDoneIssues) * 100).toFixed(1) : null,
      reopenedList,
    },
  };
}

function fmtHours(h) {
  if (h == null) return 'N/A';
  if (h < 1) return `${Math.round(h * 60)}분`;
  return `${h}시간`;
}

function printReport(m) {
  const w = m.window;
  const short = w.transitions < 50 || (w.start && w.end && (new Date(w.end) - new Date(w.start)) < 7 * 86400_000);
  console.log('\n══════════════════════════════════════════════════════');
  console.log(' WORK-POOL 상태전이 대시보드 (OMO-2592 / 북극성 축2)');
  console.log('══════════════════════════════════════════════════════');
  console.log(`데이터 윈도우: ${w.start ?? 'N/A'} ~ ${w.end ?? 'N/A'}`);
  console.log(`전이 ${w.transitions}건 · 이슈 ${w.issues}건${DAYS != null ? ` · 최근 ${DAYS}일` : ' · 전기간(적재분)'}`);
  if (short) {
    console.log('\n⚠️  데이터 부족: 적재 윈도우가 짧다(<7일 또는 <50전이). 아래 지표는 참고용이며,');
    console.log('    주간 스냅샷이 누적될수록 전기간 정확도가 올라간다. 추측 보정 없음.');
  }

  console.log('\n── 핵심 지표 ──────────────────────────────────────────');
  console.log(`Blocker MTTR(평균): ${fmtHours(m.mttr.meanHours)}  | 중앙값: ${fmtHours(m.mttr.medianHours)}  | 해소 ${m.mttr.resolvedBlockers}건`);
  console.log(`미해소 blocker: ${m.mttr.openBlockers}건`);
  for (const b of m.mttr.openBlockerList) console.log(`   · ${b.identifier ?? '(id없음)'} — ${b.since}부터 blocked`);
  console.log(`재작업률: ${m.rework.ratePct ?? 'N/A'}%  (${m.rework.reworkIssues}/${m.rework.totalIssues} 이슈)`);
  console.log(`재오픈율: ${m.reopen.ratePct ?? 'N/A'}%  (${m.reopen.reopenedIssues}/${m.reopen.everDoneIssues} done도달 이슈)`);
  if (m.reopen.reopenedList.length) console.log(`   · 재오픈: ${m.reopen.reopenedList.filter(Boolean).join(', ')}`);
  console.log('══════════════════════════════════════════════════════\n');
}

async function main() {
  const rows = await fetchAll();
  const m = computeMetrics(rows);
  if (AS_JSON) {
    console.log(JSON.stringify(m, null, 2));
  } else {
    printReport(m);
  }
}

main().catch((err) => {
  console.error('[dashboard] 실패:', err.message);
  process.exit(1);
});
