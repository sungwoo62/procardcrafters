#!/usr/bin/env node
/**
 * OMO-2561 — Google Search Console 브라우저 자동화
 *
 * 목적: GSC 속성 등록 + 소유권 인증(GA4 연동) + sitemap 제출 + 핵심 제품 색인요청을
 *       에이전트가 UI 조작으로 수행한다. 개발자 토큰/OAuth/Search Console API 불필요.
 *
 * 전제 (보드의 유일한 1회 작업 — Rule #1 상 사람만 가능한 부분):
 *   업무(올팩) Google 계정으로 한 번 로그인해 영속 프로필을 만든다. 기존 OMO-2557 로그인
 *   도우미를 그대로 재사용하면 된다 (세션 쿠키는 Google 전 서비스 공유 → GSC 도 인증됨):
 *       node scripts/omo-2557-ads-login.mjs
 *   ※ 같은 계정이 GA4(G-8WLFZ1GTTJ)/Ads 소유 → GSC GA4 연동 인증이 1클릭으로 가능.
 *   끝나면 이 이슈에 "로그인 완료" 댓글 → 에이전트가 이어서 자동 처리.
 *
 * 모드 (헤드리스 기본, 보정은 --headed --diagnose 로 스크린샷 확인):
 *   --diagnose        GSC 로드 + 로그인/속성 상태 스크린샷 (기본 안전모드)
 *   --register        URL-prefix 속성(https://procardcrafters.com) 추가 + GA4 인증 시도
 *   --submit-sitemap  sitemap.xml 제출
 *   --inspect         핵심 제품 URL 색인요청(URL 검사 → 색인 생성 요청)
 *   --headed          창 띄워 실행
 *
 * ⚠️ GSC UI 셀렉터는 변동이 잦고 다국어/실험군이 있어 첫 실전은 --headed --diagnose 로
 *    스크린샷을 떠 실제 DOM 에 맞춰 보정한 뒤 진행한다(OMO-2557 패턴과 동일).
 */

import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const SHOT_DIR = resolve(REPO, "scripts/screenshots");
// OMO-2557 과 동일 프로필 재사용 (같은 업무 Google 계정 세션)
const PROFILE_DIR = process.env.ADS_PROFILE_DIR
  || (process.env.AGENT_HOME ? resolve(process.env.AGENT_HOME, "secrets/ads-browser-profile") : resolve(REPO, ".secrets/ads-browser-profile"));

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://procardcrafters.com";
const SITEMAP_PATH = "sitemap.xml";

// 색인요청 우선순위 — 핵심 제품 5~10개 (sitemap 폴백 목록과 일치)
const PRIORITY_URLS = [
  `${SITE_URL}`,
  `${SITE_URL}/products`,
  `${SITE_URL}/products/business-cards`,
  `${SITE_URL}/products/stickers`,
  `${SITE_URL}/products/flyers`,
  `${SITE_URL}/products/postcards`,
  `${SITE_URL}/products/posters`,
  `${SITE_URL}/products/brochures`,
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const HEADED = has("--headed");
const MODE = has("--register") ? "register"
  : has("--submit-sitemap") ? "submit-sitemap"
  : has("--inspect") ? "inspect"
  : "diagnose";

if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });

let shotN = 0;
async function shot(page, label) {
  const f = resolve(SHOT_DIR, `omo-2561-${String(++shotN).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: f, fullPage: true }).catch(() => {});
  console.log(`  📸 ${f}`);
  return f;
}

function gscUrl(path = "") {
  // resource_id 는 URL-prefix 속성의 인코딩된 사이트 URL
  const rid = encodeURIComponent(SITE_URL + "/");
  return `https://search.google.com/search-console${path}?resource_id=${rid}`;
}

async function ensureLoggedIn(page) {
  await page.goto("https://search.google.com/search-console/welcome", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const url = page.url();
  if (url.includes("accounts.google.com") || url.includes("ServiceLogin") || /\/signin/.test(url)) {
    await shot(page, "not-logged-in");
    throw new Error(
      "GSC 세션 없음 — 보드가 `node scripts/omo-2557-ads-login.mjs` 로 업무 계정 1회 로그인 필요.\n" +
      `프로필 경로: ${PROFILE_DIR}`,
    );
  }
  return url;
}

async function run() {
  if (!existsSync(PROFILE_DIR)) {
    console.error(`프로필 없음: ${PROFILE_DIR}`);
    console.error("보드가 1회 로그인 필요: node scripts/omo-2557-ads-login.mjs");
    process.exit(2);
  }

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED,
    viewport: { width: 1380, height: 900 },
    channel: "chrome",
  }).catch(async () => chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED, viewport: { width: 1380, height: 900 },
  }));

  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    console.log(`=== OMO-2561 GSC 자동화 — 모드: ${MODE} ===`);
    console.log(`사이트: ${SITE_URL}\n프로필: ${PROFILE_DIR}\n`);
    await ensureLoggedIn(page);
    await shot(page, `${MODE}-loaded`);

    if (MODE === "diagnose") {
      // 속성 목록/대시보드 상태 확인
      await page.goto(gscUrl(), { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await shot(page, "diagnose-dashboard");
      console.log("진단 완료. 스크린샷을 vision 으로 확인해 셀렉터를 보정하세요.");
    }

    if (MODE === "register") {
      // URL-prefix 속성 추가 플로우. 실제 셀렉터는 첫 --headed --diagnose 로 보정.
      await page.goto("https://search.google.com/search-console/welcome", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await shot(page, "register-welcome");
      // URL 접두어 입력칸: placeholder/label 다국어 대응
      const urlInput = page.locator('input[type="text"], input[type="url"]').last();
      await urlInput.fill(SITE_URL).catch(() => {});
      await shot(page, "register-url-filled");
      console.log("URL-prefix 입력 완료. 계속/CONTINUE 클릭 → GA4 인증 탭 선택은 보정 후 자동화.");
      // 인증: '계속' 후 'Google 애널리틱스' 인증 방법 선택 → GA4(G-8WLFZ1GTTJ) 보유 시 1클릭.
      await shot(page, "register-verify-method");
    }

    if (MODE === "submit-sitemap") {
      await page.goto(gscUrl("/sitemaps"), { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await shot(page, "sitemap-page");
      const input = page.locator('input[type="text"]').first();
      await input.fill(SITEMAP_PATH).catch(() => {});
      await shot(page, "sitemap-filled");
      console.log(`sitemap '${SITEMAP_PATH}' 입력. 제출(SUBMIT) 버튼 클릭은 보정 후 활성화.`);
      await shot(page, "sitemap-submitted");
    }

    if (MODE === "inspect") {
      for (const u of PRIORITY_URLS) {
        console.log(`URL 검사: ${u}`);
        await page.goto(gscUrl("/inspect") + `&id=${encodeURIComponent(u)}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(4000);
        await shot(page, `inspect-${u.split("/").pop() || "home"}`);
        // '색인 생성 요청(REQUEST INDEXING)' 버튼은 보정 후 클릭 자동화.
      }
      console.log("색인요청 대상 스크린샷 완료. 버튼 셀렉터 보정 후 클릭 자동화.");
    }
  } finally {
    await ctx.close().catch(() => {});
  }
}

run().catch((e) => {
  console.error("실패:", e.message);
  process.exit(1);
});
