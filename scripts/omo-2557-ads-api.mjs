#!/usr/bin/env node
/**
 * OMO-2557 — Google Ads API 자동화
 * 전환 액션 3개(Purchase / Lead email_signup / Lead chat_quote)를 생성하고
 * Conversion ID(AW 숫자) + Label 3개를 회수한 뒤, fill 스크립트로 GTM import 파일까지 생성한다.
 *
 * 의존성 없음(Node 18+ 내장 fetch + Google Ads REST API 사용).
 *
 * 자격증명: 아래 키를 env 또는 env 파일에서 읽는다.
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REFRESH_TOKEN
 *   GOOGLE_ADS_CUSTOMER_ID         (10자리, 하이픈 제거)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID   (선택: MCC 하위 계정일 때 MCC ID)
 *
 * 사용:
 *   node scripts/omo-2557-ads-api.mjs                 # 기본: $AGENT_HOME/secrets/google-ads.env 읽음
 *   node scripts/omo-2557-ads-api.mjs --env <path>    # 다른 env 파일
 *   node scripts/omo-2557-ads-api.mjs --dry-run       # API 호출 없이 설정/자격증명만 점검
 *   node scripts/omo-2557-ads-api.mjs --no-fill       # fill 스크립트 자동 실행 생략
 *
 * 멱등성: 동일 이름의 전환 액션이 이미 있으면 생성하지 않고 기존 것을 재사용(라벨만 회수).
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v18";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = has("--dry-run");
const NO_FILL = has("--no-fill");

// ─── 전환 액션 스펙 (런북 §3-3 기준) ───────────────────────────────
const ACTIONS = [
  { key: "purchase",     name: "PCCF - Purchase",            category: "PURCHASE",         counting: "ONE_PER_CLICK", useValue: true  },
  { key: "lead_email",   name: "PCCF - Lead (email_signup)", category: "SUBMIT_LEAD_FORM", counting: "ONE_PER_CLICK", useValue: false },
  { key: "lead_chat",    name: "PCCF - Lead (chat_quote)",   category: "SUBMIT_LEAD_FORM", counting: "ONE_PER_CLICK", useValue: true  },
];

// ─── env 로딩 ──────────────────────────────────────────────────────
function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function resolveConfig() {
  const envPath = argVal("--env")
    || process.env.GOOGLE_ADS_ENV
    || (process.env.AGENT_HOME ? resolve(process.env.AGENT_HOME, "secrets/google-ads.env") : null)
    || resolve(REPO, ".secrets/google-ads.env");
  const fileEnv = envPath ? loadEnvFile(envPath) : {};
  const g = (k) => process.env[k] || fileEnv[k] || "";
  const cfg = {
    devToken: g("GOOGLE_ADS_DEVELOPER_TOKEN"),
    clientId: g("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: g("GOOGLE_OAUTH_CLIENT_SECRET"),
    refreshToken: g("GOOGLE_OAUTH_REFRESH_TOKEN"),
    customerId: (g("GOOGLE_ADS_CUSTOMER_ID") || "").replace(/[^0-9]/g, ""),
    loginCustomerId: (g("GOOGLE_ADS_LOGIN_CUSTOMER_ID") || "").replace(/[^0-9]/g, ""),
    envPath,
  };
  return cfg;
}

function checkConfig(cfg) {
  const missing = [];
  for (const k of ["devToken", "clientId", "clientSecret", "refreshToken", "customerId"]) {
    if (!cfg[k]) missing.push(k);
  }
  return missing;
}

// ─── Google OAuth → access token ──────────────────────────────────
async function getAccessToken(cfg) {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`OAuth 토큰 발급 실패: ${r.status} ${JSON.stringify(j)}`);
  return j.access_token;
}

function adsHeaders(cfg, accessToken) {
  const h = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": cfg.devToken,
    "Content-Type": "application/json",
  };
  if (cfg.loginCustomerId) h["login-customer-id"] = cfg.loginCustomerId;
  return h;
}

async function adsPost(cfg, accessToken, path, payload) {
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${cfg.customerId}${path}`;
  const r = await fetch(url, { method: "POST", headers: adsHeaders(cfg, accessToken), body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Ads API ${path} 실패: ${r.status} ${JSON.stringify(j)}`);
  return j;
}

// 기존 동일 이름 액션 조회 (멱등)
async function findExisting(cfg, accessToken, name) {
  const q = `SELECT conversion_action.resource_name, conversion_action.name FROM conversion_action WHERE conversion_action.name = '${name.replace(/'/g, "\\'")}'`;
  const j = await adsPost(cfg, accessToken, "/googleAds:search", { query: q });
  const rows = j.results || [];
  return rows.length ? rows[0].conversionAction.resourceName : null;
}

async function createAction(cfg, accessToken, spec) {
  const create = {
    name: spec.name,
    type: "WEBPAGE",
    category: spec.category,
    status: "ENABLED",
    primaryForGoal: true,
    countingType: spec.counting,
    valueSettings: spec.useValue
      ? { defaultValue: 0, defaultCurrencyCode: "USD", alwaysUseDefaultValue: false }
      : { defaultValue: 0, defaultCurrencyCode: "USD", alwaysUseDefaultValue: true },
  };
  const j = await adsPost(cfg, accessToken, "/conversionActions:mutate", {
    operations: [{ create }],
    responseContentType: "MUTABLE_RESOURCE",
  });
  return j.results?.[0]?.resourceName;
}

// tag_snippets 에서 AW 전환 ID + label 추출
async function fetchTag(cfg, accessToken, resourceName) {
  const q = `SELECT conversion_action.id, conversion_action.name, conversion_action.tag_snippets FROM conversion_action WHERE conversion_action.resource_name = '${resourceName}'`;
  const j = await adsPost(cfg, accessToken, "/googleAds:search", { query: q });
  const ca = j.results?.[0]?.conversionAction;
  if (!ca) throw new Error(`tag_snippets 조회 실패: ${resourceName}`);
  const snippets = ca.tagSnippets || [];
  // event_snippet 안의 send_to: 'AW-XXXX/label' 패턴 파싱
  for (const s of snippets) {
    const blob = `${s.eventSnippet || ""}\n${s.globalSiteTag || ""}`;
    const m = blob.match(/AW-(\d+)\/([A-Za-z0-9_\-]+)/);
    if (m) return { conversionId: m[1], label: m[2] };
  }
  return { conversionId: null, label: null };
}

// ─── main ─────────────────────────────────────────────────────────
(async () => {
  const cfg = resolveConfig();
  console.log(`[OMO-2557] Ads API ${API_VERSION} | env: ${cfg.envPath || "(env only)"} | customer: ${cfg.customerId || "(미설정)"}${cfg.loginCustomerId ? ` | MCC: ${cfg.loginCustomerId}` : ""}`);

  const missing = checkConfig(cfg);
  if (missing.length) {
    console.error(`\n❌ 자격증명 누락: ${missing.join(", ")}`);
    console.error(`   → docs/OMO-2557-google-ads-api-setup.md 참고. env 파일 위치: ${cfg.envPath}`);
    process.exit(DRY ? 0 : 2);
  }
  console.log("✅ 자격증명 5종 확인됨.");
  if (DRY) { console.log("[--dry-run] API 호출 생략."); process.exit(0); }

  const token = await getAccessToken(cfg);
  console.log("✅ OAuth access token 발급 완료.");

  const result = {};
  for (const spec of ACTIONS) {
    let rn = await findExisting(cfg, token, spec.name);
    if (rn) console.log(`↺ 기존 재사용: ${spec.name}`);
    else { rn = await createAction(cfg, token, spec); console.log(`＋ 생성: ${spec.name}`); }
    const { conversionId, label } = await fetchTag(cfg, token, rn);
    result[spec.key] = { conversionId, label };
    console.log(`   ${spec.key}: AW-${conversionId} / ${label}`);
  }

  const cid = result.purchase.conversionId || result.lead_email.conversionId || result.lead_chat.conversionId;
  const purchaseLabel = result.purchase.label;
  const emailLabel = result.lead_email.label;
  const chatLabel = result.lead_chat.label;
  console.log("\n=== 회수 값 ===");
  console.log(JSON.stringify({ conversionId: cid, purchaseLabel, emailLabel, chatLabel }, null, 2));

  if (NO_FILL) { console.log("[--no-fill] fill 스크립트 생략."); return; }
  if (!cid || !purchaseLabel || !emailLabel || !chatLabel) {
    console.error("⚠️ 일부 값 회수 실패 — fill 생략. 위 값 확인 필요.");
    process.exit(3);
  }
  console.log("\n→ fill 스크립트 실행…");
  const fill = spawnSync("bash", [resolve(REPO, "scripts/omo-2557-fill-ads-tags.sh"), cid, purchaseLabel, emailLabel, chatLabel], { stdio: "inherit" });
  process.exit(fill.status ?? 0);
})().catch((e) => { console.error("\n❌ 실패:", e.message); process.exit(1); });
