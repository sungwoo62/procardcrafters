#!/usr/bin/env node
/**
 * cvr-join.mjs — OMO-2593 [북극성 축2→3] 고객만족 KPI: CVR(전환율) 계측 토대
 *
 * 목적: 대시보드 북극성 고객만족 조인에서 '데이터 부족'으로 비어 있던 CVR을
 *       정량화 가능한 조인 경로로 구축한다.
 *
 *   CVR(전환율) = 주문수(print_orders) ÷ 세션수(GA4)
 *
 * 데이터 소스(2개):
 *   ① 분모(주문수): Supabase `print_orders` — service_role로 직접 집계(가용).
 *      옵션) attribution 컬럼(utm_source/gclid 등, OMO-2587 PR#8)이 머지되면
 *            채널별 CVR도 산출 가능. 현재 브랜치엔 미존재 → total CVR만.
 *   ② 분자(세션수): GA4 Data API runReport(sessions by date).
 *      클라이언트측 측정은 G- 측정ID로 수집 중이나, 서버에서 세션을 끌어오려면
 *      GA4 Data API 자격증명(속성ID + 서비스계정 읽기권한)이 필요하다.
 *      미연동 시 sessions=null + note로 '데이터 부족'을 정직하게 표기(추측 금지).
 *
 * 산출물: stdout 일자별 표 + JSON 스냅샷(scripts/test-artifacts/cvr-snapshot-<to>.json).
 *         Analytics가 이 스냅샷(또는 본 모듈의 computeCvr)을 북극성 대시보드 조인에 사용.
 *
 * 자격증명(.env.local 또는 process.env):
 *   - Supabase: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (필수)
 *   - GA4 Data API(선택, 있으면 CVR 완성):
 *       GA4_PROPERTY_ID                 예) 123456789 (숫자 속성ID, 측정ID와 다름)
 *       GOOGLE_APPLICATION_CREDENTIALS  서비스계정 JSON 파일 경로
 *         (해당 서비스계정 이메일을 GA4 속성에 '뷰어'로 추가해야 함 — 보드/오너 액션)
 *
 * 사용법: node scripts/analytics/cvr-join.mjs [--days 30] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// --- args ---------------------------------------------------------------
const args = process.argv.slice(2);
const daysArg = args.indexOf('--days');
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 30;
const JSON_ONLY = args.includes('--json');

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
const env = (name) => process.env[name] || local[name];

const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[cvr] 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// --- 날짜 유틸 (Date.now 없이 인자 기반) ---------------------------------
// 분석 종료일은 print_orders 최신 주문 일자 또는 GA4 최신 데이터로 정한다.
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(ymdStr, delta) {
  const d = new Date(`${ymdStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return ymd(d);
}

// ─────────────────────────────────────────────────────────────────────
// ① 분모: print_orders 주문수(일자별)
// ─────────────────────────────────────────────────────────────────────
async function fetchOrdersByDay() {
  const url = `${SUPABASE_URL}/rest/v1/print_orders?select=created_at,status&order=created_at.asc`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`print_orders ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('print_orders 응답이 배열이 아님');
  // 결제 완료 이상만 '전환'으로 카운트(pending 제외 — 미결제는 전환 아님).
  const CONVERTED = new Set(['paid', 'processing', 'shipped', 'delivered', 'completed']);
  const byDay = new Map();
  let converted = 0;
  for (const o of rows) {
    const day = String(o.created_at).slice(0, 10);
    if (!CONVERTED.has(o.status)) continue;
    converted += 1;
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  return { byDay, total: rows.length, converted };
}

// ─────────────────────────────────────────────────────────────────────
// ② 분자: GA4 Data API sessions(일자별) — 자격증명 있을 때만
// ─────────────────────────────────────────────────────────────────────
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function ga4AccessToken(sa) {
  // 서비스계정 JWT(RS256) → OAuth2 access_token (Date.now 대신 process.hrtime 불가 →
  // GA4 토큰 iat/exp는 실시간이 필요하므로 Math 없이 epoch를 직접 계산).
  const nowSec = Math.floor(Date.parse(new Date().toUTCString()) / 1000); // 실행시각(초)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = base64url(signer.sign(sa.private_key));
  const assertion = `${header}.${claim}.${sig}`;
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`GA4 token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}
async function fetchSessionsByDay(propertyId, sa, startDate, endDate) {
  const token = await ga4AccessToken(sa);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
      }),
    },
  );
  if (!res.ok) throw new Error(`GA4 runReport ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const byDay = new Map();
  for (const row of data.rows || []) {
    const raw = row.dimensionValues?.[0]?.value || ''; // YYYYMMDD
    const day = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    byDay.set(day, Number(row.metricValues?.[0]?.value || 0));
  }
  return byDay;
}

// ─────────────────────────────────────────────────────────────────────
// 조인 + CVR 계산
// ─────────────────────────────────────────────────────────────────────
export async function computeCvr({ days = 30 } = {}) {
  const orders = await fetchOrdersByDay();

  // 분석 윈도우: 최신 주문일 기준 days. 주문이 0이면 빈 윈도우 반환.
  const orderDays = [...orders.byDay.keys()].sort();
  const endDate = orderDays[orderDays.length - 1] || ymd(new Date());
  const startDate = addDays(endDate, -(days - 1));

  // GA4 자격증명 확인
  const propertyId = env('GA4_PROPERTY_ID');
  const saPath = env('GOOGLE_APPLICATION_CREDENTIALS');
  let sessionsByDay = null;
  let sessionsNote = null;
  if (propertyId && saPath && fs.existsSync(saPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      sessionsByDay = await fetchSessionsByDay(propertyId, sa, startDate, endDate);
    } catch (e) {
      sessionsNote = `GA4 Data API 호출 실패: ${e.message}`;
    }
  } else {
    sessionsNote =
      '데이터 부족 — GA4 Data API 미연동(GA4_PROPERTY_ID + GOOGLE_APPLICATION_CREDENTIALS 필요). ' +
      '클라이언트측 G- 측정ID로 세션 수집은 되나, 서버 조인용 속성ID/서비스계정 읽기권한 부여(보드/오너 액션) 전까지 CVR 분자는 계측 불가.';
  }

  // 일자별 조인
  const rows = [];
  let totalOrders = 0;
  let totalSessions = sessionsByDay ? 0 : null;
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    const ord = orders.byDay.get(d) || 0;
    const ses = sessionsByDay ? sessionsByDay.get(d) || 0 : null;
    totalOrders += ord;
    if (sessionsByDay) totalSessions += ses;
    rows.push({
      date: d,
      orders: ord,
      sessions: ses,
      cvr: ses && ses > 0 ? Number(((ord / ses) * 100).toFixed(2)) : null,
    });
  }

  const overallCvr =
    totalSessions && totalSessions > 0
      ? Number(((totalOrders / totalSessions) * 100).toFixed(2))
      : null;

  return {
    kpi: 'CVR',
    window: { startDate, endDate, days },
    denominator: {
      source: 'print_orders',
      converted_orders: totalOrders,
      total_orders_alltime: orders.total,
      converted_alltime: orders.converted,
      note: 'CONVERTED = paid|processing|shipped|delivered|completed (pending 제외)',
    },
    numerator: {
      source: 'GA4 Data API (sessions)',
      total_sessions: totalSessions,
      note: sessionsNote,
    },
    overall_cvr_pct: overallCvr,
    status: overallCvr === null ? 'INSUFFICIENT_DATA' : 'OK',
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────
async function main() {
  const result = await computeCvr({ days: DAYS });
  const outDir = path.join(ROOT, 'scripts', 'test-artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `cvr-snapshot-${result.window.endDate}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  if (JSON_ONLY) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n📊 CVR(전환율) 계측 — 윈도우 ${result.window.startDate} ~ ${result.window.endDate} (${result.window.days}일)\n`);
  console.log(`분모(주문):  전환 주문 ${result.denominator.converted_orders}건 (전기간 전환 ${result.denominator.converted_alltime}/${result.denominator.total_orders_alltime})`);
  if (result.numerator.total_sessions === null) {
    console.log(`분자(세션):  ⚠️  ${result.numerator.note}`);
  } else {
    console.log(`분자(세션):  ${result.numerator.total_sessions} 세션`);
  }
  console.log(`\n▶ 전체 CVR: ${result.overall_cvr_pct === null ? '계측 불가(데이터 부족)' : result.overall_cvr_pct + '%'}  [${result.status}]`);
  console.log(`\n스냅샷 저장: ${path.relative(ROOT, outFile)}`);
  console.log('→ Analytics는 이 스냅샷 또는 computeCvr()을 북극성 고객만족 대시보드 조인에 사용.\n');
}

main().catch((e) => {
  console.error('[cvr] 실패:', e.message);
  process.exit(1);
});
