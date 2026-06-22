/**
 * OMO-2907 — ProCardCrafters 주간 광고문구 자동개선 루프 (LOOP B / WEEKLY)
 * ------------------------------------------------------------------
 * 적용처: Google Ads → Tools → Scripts → 별도 스크립트로 추가
 *         → Authorize → Schedule: Weekly (예: 매주 월 08:00).
 *
 * 무엇을 하나
 *  1) 대상 캠페인의 RSA(반응형 검색광고) 에셋 성과를 수집 (헤드라인/설명 + 노출/CTR)
 *  2) 성과 데이터를 Gemini에 보내 새 헤드라인/설명 변형을 영어로 생성 (US 시장, 글자수 준수)
 *  3) 결과를 이메일로 발송 — 사람이 검토/승인 후 Google Ads에 반영 (가짜·미승인 자동게시 금지)
 *
 * 정책 (절대 준수)
 *  - 고객 노출 카피는 영어. 한국어 직역 금지 (AGENTS.md §0).
 *  - 후기/대외 카피 자동 직접게시 금지 — 사람 승인 게이트 필수 (OMO-2760, OMO-1908).
 *    → 이 스크립트는 기본적으로 "제안만" 한다. AUTO_APPLY 기본 false.
 *  - 글자수: 헤드라인 ≤30자, 설명 ≤90자 (초과분은 스크립트가 자동 폐기).
 *
 * 사전준비: Gemini API 키를 아래 GEMINI_API_KEY 에 주입.
 *  (키 미주입 시 — 성과 리포트만 이메일로 발송하고 생성 단계는 건너뜀.)
 */

var CFG = {
  EMAIL: 'sungwoo62@gmail.com',
  CAMPAIGN_NAME_CONTAINS: 'ProCard',
  LOOKBACK: 'LAST_30_DAYS',

  GEMINI_API_KEY: '',                       // ← 여기에 Gemini API 키 주입
  GEMINI_MODEL: 'gemini-2.0-flash',         // 가성비 모델
  N_NEW_HEADLINES: 8,
  N_NEW_DESCRIPTIONS: 4,
  HEADLINE_MAX: 30,
  DESC_MAX: 90,

  AUTO_APPLY: false, // 절대 true로 켜지 말 것 — 승인 게이트 우회 (OMO-2760/1908)
};

function main() {
  var out = [];
  out.push('ProCardCrafters — 주간 광고문구 개선 루프 (OMO-2907 / Loop B)');
  out.push('생성: ' + Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd HH:mm zzz'));
  out.push('정책: 영어 카피 / 글자수 준수 / 사람 승인 게이트 (자동게시 금지)');
  out.push('');

  // 1) 성과 수집
  var perf = collectRsaPerformance();
  out.push('──── 현재 RSA 에셋 성과 (' + CFG.LOOKBACK + ') ────');
  if (!perf.assets.length) {
    out.push('수집된 RSA 에셋 없음 — 캠페인/광고가 아직 없을 수 있음.');
  } else {
    out.push('헤드라인 ' + perf.headlines.length + '종 / 설명 ' + perf.descriptions.length + '종');
    perf.assets.slice(0, 30).forEach(function (a) {
      out.push('  [' + a.kind + '] "' + a.text + '" — 성과등급: ' + a.perf);
    });
  }
  out.push('');

  // 2) Gemini 생성
  if (!CFG.GEMINI_API_KEY) {
    out.push('──── 생성 단계 SKIP ────');
    out.push('GEMINI_API_KEY 미주입. 키 주입 후 새 변형이 자동 생성됩니다.');
  } else {
    var suggestions = generateCopy(perf);
    out.push('──── Gemini 제안 (검토 후 수동 반영) ────');
    out.push('# 새 헤드라인 (≤' + CFG.HEADLINE_MAX + '자)');
    suggestions.headlines.forEach(function (h) { out.push('  + ' + h + '  [' + h.length + ']'); });
    out.push('');
    out.push('# 새 설명 (≤' + CFG.DESC_MAX + '자)');
    suggestions.descriptions.forEach(function (d) { out.push('  + ' + d + '  [' + d.length + ']'); });
    out.push('');
    out.push('반영 방법: Google Ads → 해당 RSA 편집 → 위 항목 중 선택 추가 → 저장.');
    out.push('(저성과 등급 LOW 에셋은 새 항목으로 교체 권장. AUTO_APPLY=' + CFG.AUTO_APPLY + ')');
  }

  MailApp.sendEmail(CFG.EMAIL,
    '[검토요청] ProCard 주간 광고문구 제안 ' +
    Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd'),
    out.join('\n'));
  Logger.log(out.join('\n'));
}

// ---- RSA 성과 수집 ----
function collectRsaPerformance() {
  var headlines = {}, descriptions = {}, assets = [];
  var sel = AdsApp.campaigns().withCondition("Status = ENABLED");
  if (CFG.CAMPAIGN_NAME_CONTAINS) {
    sel = sel.withCondition('CampaignName CONTAINS_IGNORE_CASE "' + CFG.CAMPAIGN_NAME_CONTAINS + '"');
  }
  var camps = sel.get();
  while (camps.hasNext()) {
    var camp = camps.next();
    var ads = camp.ads().withCondition("Type = RESPONSIVE_SEARCH_AD").withCondition("Status = ENABLED").get();
    while (ads.hasNext()) {
      var ad = ads.next();
      var rsa = ad.asType().responsiveSearchAd();
      collectAssetGroup(rsa.getHeadlines(), 'HEADLINE', headlines, assets);
      collectAssetGroup(rsa.getDescriptions(), 'DESCRIPTION', descriptions, assets);
    }
  }
  return {
    headlines: Object.keys(headlines),
    descriptions: Object.keys(descriptions),
    assets: assets,
  };
}
function collectAssetGroup(arr, kind, bag, assets) {
  if (!arr) return;
  for (var i = 0; i < arr.length; i++) {
    var txt = arr[i].text || arr[i].asset && arr[i].asset.text;
    if (!txt || bag[txt]) continue;
    bag[txt] = true;
    var perf = (arr[i].performanceLabel || arr[i].pinnedField && 'PINNED' || 'UNKNOWN');
    assets.push({ kind: kind, text: txt, perf: perf });
  }
}

// ---- Gemini 호출 ----
function generateCopy(perf) {
  var goodHeads = perf.assets.filter(function (a) { return a.kind === 'HEADLINE'; }).map(function (a) { return a.text; });
  var goodDescs = perf.assets.filter(function (a) { return a.kind === 'DESCRIPTION'; }).map(function (a) { return a.text; });

  var prompt =
    'You are a senior US performance-marketing copywriter for ProCardCrafters, an online ' +
    'custom business-card printing service (print-on-demand) for US professionals and small businesses ' +
    '(real estate agents, contractors, salons, food trucks, etc.).\n\n' +
    'Existing Google Ads RSA assets:\nHEADLINES:\n- ' + goodHeads.join('\n- ') +
    '\nDESCRIPTIONS:\n- ' + goodDescs.join('\n- ') + '\n\n' +
    'Write NEW, distinct, high-CTR variations in US English. Rules:\n' +
    '- ' + CFG.N_NEW_HEADLINES + ' headlines, each STRICTLY <= ' + CFG.HEADLINE_MAX + ' characters.\n' +
    '- ' + CFG.N_NEW_DESCRIPTIONS + ' descriptions, each STRICTLY <= ' + CFG.DESC_MAX + ' characters.\n' +
    '- No fake reviews, no fake stats, no internal thresholds (e.g. min quantities).\n' +
    '- Benefit-led, concrete, varied angles (speed, price, quality, free proof, niche templates).\n' +
    '- FTC-compliant, no unverifiable claims.\n' +
    'Return ONLY JSON: {"headlines":["..."],"descriptions":["..."]}';

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    CFG.GEMINI_MODEL + ':generateContent?key=' + CFG.GEMINI_API_KEY;
  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
  };
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  var headlines = [], descriptions = [];
  try {
    var json = JSON.parse(resp.getContentText());
    var text = json.candidates[0].content.parts[0].text;
    var parsed = JSON.parse(text);
    headlines = (parsed.headlines || []).filter(function (h) { return h && h.length <= CFG.HEADLINE_MAX; });
    descriptions = (parsed.descriptions || []).filter(function (d) { return d && d.length <= CFG.DESC_MAX; });
  } catch (e) {
    headlines = ['(Gemini 파싱 실패: ' + e + ')'];
  }
  return { headlines: headlines, descriptions: descriptions };
}
