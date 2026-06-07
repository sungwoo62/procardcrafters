#!/usr/bin/env node
/**
 * customer-satisfaction-dashboard.mjs — OMO-2593 [북극성 축2→3] 고객만족 KPI 조인
 *
 * 북극성: **조직의 성장 + 고객 만족도 향상**. 부모 OMO-2586(성과측정·평가).
 *
 * 역할(Analytics): Marketing이 구축한 계측 토대(docs/analytics/customer-satisfaction-kpi-foundation.md
 *   §4 조인 컨트랙트)를 **하나의 대시보드 스냅샷으로 조인**한다. 4개 고객만족 proxy KPI를
 *   각각의 권위 소스에서 끌어와, 산출 가능하면 값을, 불가하면 `데이터 부족` + **정확한
 *   unblock 액션(담당 child 이슈)** 을 정직하게 표기한다. 추측으로 채우지 않는다(OMO-2587 패턴).
 *
 * 조인 대상 4개 KPI:
 *   1) CVR(전환율)      ← computeCvr() (scripts/analytics/cvr-join.mjs)  [Marketing 토대]
 *   2) CS 응답시간       ← print_cs_* (미신설)                          → OMO-2600 (WebOps-Print)
 *   3) 배송리드타임      ← print_orders.delivered_at − created_at        → OMO-2601 (첫 배송완료)
 *   4) 리뷰요청율/리뷰수 ← print_review_request_log / print_reviews      → OMO-2601 (배송완료 후 cron)
 *
 * 설계 원칙: 각 KPI는 값이 null/0이어도 인프라가 깔려 있으면 '계측됨, 데이터 공백'으로,
 *   인프라 자체가 없으면 '미계측'으로 구분 표기한다. 자격증명/데이터가 들어오면 코드 변경
 *   없이 자동으로 값이 채워진다.
 *
 * 자격증명(.env.local 또는 process.env):
 *   - Supabase: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (필수)
 *   - GA4 Data API(선택, CVR 분자 완성용): GA4_PROPERTY_ID + GOOGLE_APPLICATION_CREDENTIALS
 *
 * 사용법: node scripts/analytics/customer-satisfaction-dashboard.mjs [--days 30] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCvr } from './cvr-join.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const AS_JSON = args.includes('--json');
const daysArg = args.indexOf('--days');
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 30;

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
  console.error('[csat] 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

// count=exact 로 행 수만 빠르게 — content-range: "*/<count>".
async function tableCount(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${query ? '&' + query : ''}`;
  const res = await fetch(url, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (res.status === 404) return { exists: false, count: null };
  if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
  const cr = res.headers.get('content-range') || '';
  const count = Number(cr.split('/')[1]);
  return { exists: true, count: Number.isFinite(count) ? count : null };
}

// ─────────────────────────────────────────────────────────────────────
// KPI 1: CVR — Marketing 토대(computeCvr) 재사용
// ─────────────────────────────────────────────────────────────────────
async function kpiCvr() {
  const cvr = await computeCvr({ days: DAYS });
  const ok = cvr.status === 'OK' && cvr.overall_cvr_pct !== null;
  return {
    key: 'cvr',
    label: 'CVR(전환율)',
    instrumented: true, // 분모 인프라는 가동, 분자(GA4 Data API)만 미연동
    value: ok ? cvr.overall_cvr_pct : null,
    unit: '%',
    status: ok ? 'OK' : 'INSUFFICIENT_DATA',
    detail: {
      converted_orders: cvr.denominator.converted_orders,
      sessions: cvr.numerator.total_sessions,
    },
    unblock: ok
      ? null
      : 'GA4 Data API 자격증명 주입(GA4_PROPERTY_ID + 서비스계정 뷰어권한) → OMO-2602. 주입 시 코드 변경 없이 자동 산출.',
  };
}

// ─────────────────────────────────────────────────────────────────────
// KPI 2: CS 응답시간 — print_cs_* 테이블(미신설)
// ─────────────────────────────────────────────────────────────────────
async function kpiCsResponse() {
  // 가능한 후보 테이블을 탐지(신설되면 자동 인식). 현재 브랜치엔 부재 예상.
  let table = null;
  for (const t of ['print_cs_threads', 'print_cs_tickets', 'print_cs_inquiries']) {
    const probe = await tableCount(t);
    if (probe.exists) { table = { name: t, count: probe.count }; break; }
  }
  if (!table) {
    return {
      key: 'cs_response_time',
      label: 'CS 응답시간',
      instrumented: false, // 인프라(테이블) 자체가 없음 = 미계측
      value: null,
      unit: 'h',
      status: 'NOT_INSTRUMENTED',
      detail: { table: null },
      unblock: 'print_cs_* 테이블 신설(문의→첫응답 타임스탬프) → OMO-2600 (WebOps-Print).',
    };
  }
  // 테이블이 생겼다면 first_response_at − opened_at 평균을 계산.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table.name}?select=opened_at,first_response_at`,
    { headers: H },
  );
  const rows = res.ok ? await res.json() : [];
  const durs = [];
  for (const r of rows) {
    if (r.opened_at && r.first_response_at) {
      durs.push((new Date(r.first_response_at) - new Date(r.opened_at)) / 3600_000);
    }
  }
  const mean = durs.length ? +(durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(2) : null;
  return {
    key: 'cs_response_time',
    label: 'CS 응답시간',
    instrumented: true,
    value: mean,
    unit: 'h',
    status: mean === null ? 'INSUFFICIENT_DATA' : 'OK',
    detail: { table: table.name, threads: table.count, measured: durs.length },
    unblock: mean === null ? `${table.name} 적재되었으나 first_response_at 채워진 문의 0건.` : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// KPI 3: 배송리드타임 — print_orders.delivered_at − created_at
// ─────────────────────────────────────────────────────────────────────
async function kpiDeliveryLead() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/print_orders?select=created_at,delivered_at,status`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`print_orders ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  const leads = [];
  let delivered = 0;
  for (const o of rows) {
    if (o.delivered_at) {
      delivered += 1;
      leads.push((new Date(o.delivered_at) - new Date(o.created_at)) / 86400_000);
    }
  }
  const mean = leads.length ? +(leads.reduce((a, b) => a + b, 0) / leads.length).toFixed(2) : null;
  return {
    key: 'delivery_lead_time',
    label: '배송리드타임',
    instrumented: true, // delivered_at 트리거(OMO-2410) 가동 중 — 배송완료 주문만 0
    value: mean,
    unit: 'day',
    status: mean === null ? 'INSUFFICIENT_DATA' : 'OK',
    detail: { total_orders: rows.length, delivered_orders: delivered },
    unblock: mean === null
      ? '배송완료(delivered) 주문 0건 → 첫 실배송 발생 시 트리거가 delivered_at 기록(가동 점검 OMO-2601).'
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// KPI 4: 리뷰요청율 / 리뷰수 — print_review_request_log / print_reviews
// ─────────────────────────────────────────────────────────────────────
async function kpiReview() {
  const [reqLog, reviews, deliveredCnt] = await Promise.all([
    tableCount('print_review_request_log'),
    tableCount('print_reviews'),
    tableCount('print_orders', 'delivered_at=not.is.null'),
  ]);
  const deliveredBase = deliveredCnt.count || 0;
  // 리뷰요청율 = 요청발송 ÷ 배송완료. 배송완료 0이면 분모 0 → 데이터 부족.
  const rate =
    deliveredBase > 0 && reqLog.count != null
      ? +(((reqLog.count || 0) / deliveredBase) * 100).toFixed(1)
      : null;
  return {
    key: 'review_request',
    label: '리뷰요청율/리뷰수',
    instrumented: reqLog.exists, // print_review_request_log + cron 가동 중
    value: rate,
    unit: '%',
    status: rate === null ? 'INSUFFICIENT_DATA' : 'OK',
    detail: {
      requests_sent: reqLog.count,
      reviews: reviews.count,
      delivered_base: deliveredBase,
    },
    unblock: rate === null
      ? '배송완료(분모) 0건 → 첫 배송완료 후 /api/cron/review-requests 가 D+7/D+14 요청 발송(가동 점검 OMO-2601).'
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 조인 + 스냅샷
// ─────────────────────────────────────────────────────────────────────
export async function buildSnapshot({ days = 30 } = {}) {
  const [cvr, cs, delivery, review] = await Promise.all([
    kpiCvr(),
    kpiCsResponse(),
    kpiDeliveryLead(),
    kpiReview(),
  ]);
  const kpis = [cvr, cs, delivery, review];
  const okCount = kpis.filter((k) => k.status === 'OK').length;
  return {
    north_star: '조직의 성장 + 고객 만족도 향상',
    axis: '고객만족(축2→3)',
    issue: 'OMO-2593',
    window_days: days,
    summary: {
      total_kpis: kpis.length,
      ok: okCount,
      insufficient_data: kpis.filter((k) => k.status === 'INSUFFICIENT_DATA').length,
      not_instrumented: kpis.filter((k) => k.status === 'NOT_INSTRUMENTED').length,
    },
    kpis,
  };
}

function statusBadge(s) {
  return s === 'OK' ? '✅ OK'
    : s === 'INSUFFICIENT_DATA' ? '⚠️  데이터 부족'
    : '⛔ 미계측';
}

function printReport(snap) {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' 북극성 고객만족 KPI 대시보드 (OMO-2593 / 축2→3)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(` 북극성: ${snap.north_star}`);
  console.log(` 윈도우: 최근 ${snap.window_days}일 · KPI ${snap.summary.total_kpis}개`);
  console.log(`   ✅ 산출 ${snap.summary.ok} · ⚠️ 데이터부족 ${snap.summary.insufficient_data} · ⛔ 미계측 ${snap.summary.not_instrumented}`);
  console.log('──────────────────────────────────────────────────────────────');
  for (const k of snap.kpis) {
    const val = k.value === null ? '—' : `${k.value}${k.unit === '%' ? '%' : ' ' + k.unit}`;
    console.log(`\n● ${k.label}  ${statusBadge(k.status)}`);
    console.log(`    값: ${val}    ${JSON.stringify(k.detail)}`);
    if (k.unblock) console.log(`    ↳ unblock: ${k.unblock}`);
  }
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' 추측 없음 — 미가용 지표는 데이터/자격증명 주입 시 코드 변경 없이 자동 산출.');
  console.log('══════════════════════════════════════════════════════════════\n');
}

async function main() {
  const snap = await buildSnapshot({ days: DAYS });
  const outDir = path.join(ROOT, 'scripts', 'test-artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'customer-satisfaction-snapshot.json');
  fs.writeFileSync(outFile, JSON.stringify(snap, null, 2));
  if (AS_JSON) {
    console.log(JSON.stringify(snap, null, 2));
  } else {
    printReport(snap);
    console.log(`스냅샷 저장: ${path.relative(ROOT, outFile)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('[csat] 실패:', e.message);
    process.exit(1);
  });
}
