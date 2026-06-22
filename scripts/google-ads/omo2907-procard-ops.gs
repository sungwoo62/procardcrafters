/**
 * OMO-2907 — ProCardCrafters 구글광고 운영 통합 스크립트 (DAILY)
 * ------------------------------------------------------------------
 * 적용처: Google Ads → Tools → Bulk actions → Scripts → (+) → 코드 붙여넣기
 *         → Authorize → Schedule: Daily (예: 매일 07:00 계정 표준시).
 *
 * 시장/통화: US / USD. (한국 KRW 로직과 분리 — AGENTS.md §1, OMO-3752)
 * 평가지표: CTR + ROI 1차, 플랫폼 ROAS 보조 (OMO-3444).
 * 정책: 비가역 ON/OFF·예산증액은 가드레일 내에서만. 큰 변경은 알림→사람 승인 (OMO-2760/1908).
 *
 * 이 스크립트가 매일 하는 일
 *  1) 예산/스펜드 가드레일 — 일 예산 캡 초과·비정상 스파이크 감지 → 이메일 경보
 *  2) 검색어(n-gram) 하베스팅 — 고비용·무전환 검색어 → 네거티브 후보 / 전환 검색어 → 키워드 후보
 *  3) 저품질 키워드 가드 — 임프레션 충분 + CTR 임계 미달 키워드 플래그(자동 일시중지는 옵션)
 *  4) 입찰전략 단계 체크 — 전환 누적되면 "전환수 최대화" 전환 시점 알림
 *  5) 일일 요약 리포트 이메일 — CTR / 클릭 / 비용 / 전환 / CPA 한눈에
 *
 * 자동 일시중지(AUTO_PAUSE)는 기본 OFF. 켜기 전 최소 2주 데이터 + 보드 승인.
 */

// ===================== 설정 (CONFIG) =====================
var CONFIG = {
  // 알림 수신 (콤마 구분 가능)
  EMAIL: 'sungwoo62@gmail.com',

  // 캠페인 필터: 이름에 이 문자열을 포함한 캠페인만 대상 (대소문자 무시)
  // 빈 문자열이면 계정 전체 ENABLED 캠페인 대상.
  CAMPAIGN_NAME_CONTAINS: 'ProCard',

  // ---- 예산 가드레일 (USD) ----
  DAILY_SPEND_HARD_CAP: 30,      // 어제 총 비용이 이 값 초과 시 경보
  SPEND_SPIKE_MULTIPLE: 2.0,     // 어제 비용이 최근7일 평균의 N배 초과 시 경보

  // ---- 검색어 하베스팅 ----
  ST_LOOKBACK: 'LAST_30_DAYS',
  ST_NEGATIVE_MIN_CLICKS: 8,     // 클릭 이 이상 + 전환 0 → 네거티브 후보
  ST_NEGATIVE_MIN_COST: 6,       // 또는 비용 이 이상 + 전환 0 → 네거티브 후보 (USD)
  ST_KEYWORD_MIN_CONV: 1,        // 전환 이 이상 → 신규 키워드 후보

  // ---- 저품질 키워드 가드 ----
  KW_LOOKBACK: 'LAST_14_DAYS',
  KW_MIN_IMPRESSIONS: 300,       // 노출 충분 기준
  KW_MIN_CTR: 0.01,              // 1% 미만이면 플래그
  AUTO_PAUSE: false,             // true 면 플래그 키워드 자동 일시중지 (승인 후에만)

  // ---- 입찰전략 단계 체크 ----
  BIDDING_CONV_THRESHOLD: 30,    // 최근30일 전환 이 이상이면 "전환수 최대화" 전환 권고
};
// ========================================================

function main() {
  var lines = [];
  lines.push('ProCardCrafters — 구글광고 일일 운영 리포트 (OMO-2907)');
  lines.push('생성: ' + nowStr());
  lines.push('대상 캠페인 필터: "' + (CONFIG.CAMPAIGN_NAME_CONTAINS || '(전체)') + '"');
  lines.push('지표 우선순위: CTR + ROI (ROAS 보조) — 전사표준 OMO-3444');
  lines.push('');

  var alerts = [];

  lines.push(section('1) 예산/스펜드 가드레일'));
  budgetGuardrail(lines, alerts);

  lines.push(section('2) 일일 성과 요약'));
  performanceSummary(lines);

  lines.push(section('3) 검색어 하베스팅 (네거티브/키워드 후보)'));
  searchTermHarvest(lines, alerts);

  lines.push(section('4) 저품질 키워드 가드 (CTR)'));
  lowCtrGuard(lines, alerts);

  lines.push(section('5) 입찰전략 단계 체크'));
  biddingStageCheck(lines, alerts);

  // ===== 이메일 발송 =====
  var subjectFlag = alerts.length ? '[조치필요 ' + alerts.length + '] ' : '[정상] ';
  var body = lines.join('\n');
  if (alerts.length) {
    body = '!! 조치 필요 항목 !!\n - ' + alerts.join('\n - ') + '\n\n' + body;
  }
  MailApp.sendEmail(CONFIG.EMAIL, subjectFlag + 'ProCard 구글광고 일일리포트 ' + dateOnly(), body);
  Logger.log(body);
}

// ---------- 1) 예산 가드레일 ----------
function budgetGuardrail(lines, alerts) {
  var y = costForRange(yesterdayRange());
  var avg7 = costForRange('LAST_7_DAYS') / 7.0;
  lines.push('어제 총비용: $' + fx(y));
  lines.push('최근7일 일평균: $' + fx(avg7));

  if (y > CONFIG.DAILY_SPEND_HARD_CAP) {
    var m = '예산 캡 초과: 어제 $' + fx(y) + ' > 캡 $' + fx(CONFIG.DAILY_SPEND_HARD_CAP);
    lines.push('  ⚠ ' + m);
    alerts.push(m);
  }
  if (avg7 > 0 && y > avg7 * CONFIG.SPEND_SPIKE_MULTIPLE) {
    var s = '비용 스파이크: 어제 $' + fx(y) + ' = 평균의 ' + (y / avg7).toFixed(1) + '배';
    lines.push('  ⚠ ' + s);
    alerts.push(s);
  }
  lines.push('');
}

// ---------- 2) 성과 요약 ----------
function performanceSummary(lines) {
  var it = filteredCampaigns();
  var T = { imp: 0, clk: 0, cost: 0, conv: 0, val: 0 };
  while (it.hasNext()) {
    var c = it.next();
    var s = c.getStatsFor('LAST_7_DAYS');
    T.imp += s.getImpressions(); T.clk += s.getClicks();
    T.cost += s.getCost(); T.conv += s.getConversions();
    T.val += (s.getConversionValue ? s.getConversionValue() : 0);
  }
  var ctr = T.imp ? (T.clk / T.imp) : 0;
  var cpa = T.conv ? (T.cost / T.conv) : 0;
  var roas = T.cost ? (T.val / T.cost) : 0;
  lines.push('최근7일 합계');
  lines.push('  노출 ' + T.imp + ' / 클릭 ' + T.clk + ' / CTR ' + pct(ctr));
  lines.push('  비용 $' + fx(T.cost) + ' / 전환 ' + T.conv.toFixed(1) + ' / CPA ' + (T.conv ? '$' + fx(cpa) : 'n/a'));
  lines.push('  전환가치 $' + fx(T.val) + ' / ROAS ' + (T.cost ? roas.toFixed(2) + 'x' : 'n/a') + '  (CTR+ROI 우선, ROAS 보조)');
  lines.push('');
}

// ---------- 3) 검색어 하베스팅 ----------
function searchTermHarvest(lines, alerts) {
  var ids = campaignIds();
  if (!ids.length) { lines.push('대상 캠페인 없음.'); lines.push(''); return; }
  var idList = ids.join(',');
  var q =
    "SELECT search_term_view.search_term, metrics.clicks, metrics.cost_micros, metrics.conversions " +
    "FROM search_term_view " +
    "WHERE segments.date DURING " + CONFIG.ST_LOOKBACK + " " +
    "AND campaign.id IN (" + idList + ")";
  var rows;
  try { rows = AdsApp.search(q); }
  catch (e) { lines.push('검색어 조회 실패: ' + e); lines.push(''); return; }

  var negatives = [], kwCandidates = [];
  while (rows.hasNext()) {
    var r = rows.next();
    var term = r.searchTermView.searchTerm;
    var clicks = Number(r.metrics.clicks || 0);
    var cost = Number(r.metrics.costMicros || 0) / 1e6;
    var conv = Number(r.metrics.conversions || 0);
    if (conv === 0 && (clicks >= CONFIG.ST_NEGATIVE_MIN_CLICKS || cost >= CONFIG.ST_NEGATIVE_MIN_COST)) {
      negatives.push({ t: term, clk: clicks, cost: cost });
    } else if (conv >= CONFIG.ST_KEYWORD_MIN_CONV) {
      kwCandidates.push({ t: term, conv: conv, cost: cost });
    }
  }
  negatives.sort(function (a, b) { return b.cost - a.cost; });
  kwCandidates.sort(function (a, b) { return b.conv - a.conv; });

  lines.push('네거티브 후보 (무전환 고비용/고클릭) — 검토 후 네거티브 등록:');
  if (!negatives.length) lines.push('  없음');
  negatives.slice(0, 20).forEach(function (n) {
    lines.push('  - "' + n.t + '"  클릭 ' + n.clk + ' / 비용 $' + fx(n.cost));
  });
  lines.push('');
  lines.push('신규 키워드 후보 (전환 발생 검색어) — 검토 후 정확검색 추가:');
  if (!kwCandidates.length) lines.push('  없음');
  kwCandidates.slice(0, 20).forEach(function (k) {
    lines.push('  + "' + k.t + '"  전환 ' + k.conv.toFixed(1) + ' / 비용 $' + fx(k.cost));
  });
  if (negatives.length >= 5) alerts.push('네거티브 후보 ' + negatives.length + '건 검토 권고');
  lines.push('');
}

// ---------- 4) 저CTR 가드 ----------
function lowCtrGuard(lines, alerts) {
  var it = filteredCampaigns();
  var flagged = [];
  while (it.hasNext()) {
    var c = it.next();
    var kws = c.keywords().withCondition("Status = ENABLED").get();
    while (kws.hasNext()) {
      var kw = kws.next();
      var s = kw.getStatsFor(CONFIG.KW_LOOKBACK);
      var imp = s.getImpressions();
      if (imp < CONFIG.KW_MIN_IMPRESSIONS) continue;
      var ctr = imp ? s.getClicks() / imp : 0;
      if (ctr < CONFIG.KW_MIN_CTR) {
        flagged.push({ kw: kw, txt: kw.getText(), imp: imp, ctr: ctr, camp: c.getName() });
      }
    }
  }
  flagged.sort(function (a, b) { return b.imp - a.imp; });
  if (!flagged.length) { lines.push('플래그 키워드 없음 (CTR ≥ ' + pct(CONFIG.KW_MIN_CTR) + ').'); lines.push(''); return; }

  lines.push('CTR ' + pct(CONFIG.KW_MIN_CTR) + ' 미달 (노출 ≥ ' + CONFIG.KW_MIN_IMPRESSIONS + '):');
  flagged.slice(0, 25).forEach(function (f) {
    var act = '';
    if (CONFIG.AUTO_PAUSE) { f.kw.pause(); act = ' → 자동 일시중지됨'; }
    lines.push('  - [' + f.camp + '] "' + f.txt + '"  노출 ' + f.imp + ' / CTR ' + pct(f.ctr) + act);
  });
  if (!CONFIG.AUTO_PAUSE) {
    lines.push('  (AUTO_PAUSE=false — 자동중지 비활성. 켜려면 2주데이터+보드승인 후 CONFIG.AUTO_PAUSE=true)');
  }
  alerts.push('저CTR 키워드 ' + flagged.length + '건' + (CONFIG.AUTO_PAUSE ? ' 자동중지' : ' 검토 권고'));
  lines.push('');
}

// ---------- 5) 입찰전략 단계 ----------
function biddingStageCheck(lines, alerts) {
  var conv30 = 0;
  var it = filteredCampaigns();
  while (it.hasNext()) { conv30 += it.next().getStatsFor('LAST_30_DAYS').getConversions(); }
  lines.push('최근30일 전환 합계: ' + conv30.toFixed(1));
  if (conv30 >= CONFIG.BIDDING_CONV_THRESHOLD) {
    var m = '전환 ' + conv30.toFixed(0) + '건 누적 → "클릭수 최대화"에서 "전환수 최대화/tROAS"로 전환 검토 시점';
    lines.push('  ✅ ' + m);
    alerts.push(m);
  } else {
    lines.push('  아직 학습 데이터 부족 — 클릭수 최대화 유지 권고 (임계 ' + CONFIG.BIDDING_CONV_THRESHOLD + ').');
  }
  lines.push('');
}

// ===================== 유틸 =====================
function filteredCampaigns() {
  var sel = AdsApp.campaigns().withCondition("Status = ENABLED");
  if (CONFIG.CAMPAIGN_NAME_CONTAINS) {
    sel = sel.withCondition('CampaignName CONTAINS_IGNORE_CASE "' + CONFIG.CAMPAIGN_NAME_CONTAINS + '"');
  }
  return sel.get();
}
function campaignIds() {
  var ids = [], it = filteredCampaigns();
  while (it.hasNext()) { ids.push(it.next().getId()); }
  return ids;
}
function costForRange(range) {
  var it = filteredCampaigns(), c = 0;
  while (it.hasNext()) { c += it.next().getStatsFor(range).getCost(); }
  return c;
}
function yesterdayRange() {
  var d = new Date(); d.setDate(d.getDate() - 1);
  var s = Utilities.formatDate(d, AdsApp.currentAccount().getTimeZone(), 'yyyyMMdd');
  return s + ',' + s; // getStatsFor 가 받는 'yyyyMMdd,yyyyMMdd' 형식
}

function section(t) { return '──────── ' + t + ' ────────'; }
function fx(n) { return (Math.round(n * 100) / 100).toFixed(2); }
function pct(n) { return (n * 100).toFixed(2) + '%'; }
function nowStr() { return Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd HH:mm zzz'); }
function dateOnly() { return Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd'); }
