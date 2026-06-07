#!/usr/bin/env node
/**
 * OMO-2557 — Google Ads API 자격증명 1회 설정 도우미 (대화형)
 *
 * 옵션 B(에이전트 자동화)를 위한 사람 측 작업을 최소화한다.
 * OAuth Playground 없이, 로컬 루프백 리디렉트로 동의 1번 → refresh token 자동 수신 →
 * 나머지 값 입력 → secrets 파일 자동 작성까지 한 번에 처리.
 *
 * 사전 준비(웹 콘솔에서만 가능, 1회):
 *   1) Google Cloud Console → 프로젝트 생성 → "Google Ads API" Enable
 *   2) OAuth consent screen(External, 본인 test user 추가)
 *   3) Credentials → Create OAuth client ID → Application type "Desktop app" → Client ID/Secret 확보
 *   4) Google Ads MCC → API Center → Developer token (프로덕션은 Basic access 이상)
 *   5) Google Ads 계정 Customer ID(10자리)
 *
 * 실행:
 *   node scripts/omo-2557-ads-setup.mjs
 *   node scripts/omo-2557-ads-setup.mjs --out <path>   # 기본: $AGENT_HOME/secrets/google-ads.env
 */

import { createServer } from "node:http";
import { writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SCOPE = "https://www.googleapis.com/auth/adwords";
const args = process.argv.slice(2);
const argVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

const OUT = argVal("--out")
  || (process.env.AGENT_HOME ? resolve(process.env.AGENT_HOME, "secrets/google-ads.env") : resolve(process.cwd(), ".secrets/google-ads.env"));

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q) => (await rl.question(q)).trim();

function openInBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try { spawn(cmd, [url], { stdio: "ignore", detached: true }).unref(); } catch { /* 무시 */ }
}

async function exchangeCode(clientId, clientSecret, code, redirectUri) {
  const body = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret, code,
    grant_type: "authorization_code", redirect_uri: redirectUri,
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`토큰 교환 실패: ${r.status} ${JSON.stringify(j)}`);
  if (!j.refresh_token) throw new Error("refresh_token 미수신. OAuth 클라이언트가 'Desktop app'인지, prompt=consent 인지 확인.");
  return j.refresh_token;
}

(async () => {
  console.log("=== OMO-2557 Google Ads API 1회 설정 도우미 ===");
  console.log("사전 준비(웹 콘솔 1회)는 스크립트 상단 주석/ docs/OMO-2557-google-ads-api-setup.md 참고.\n");

  const clientId = await ask("1) OAuth Client ID: ");
  const clientSecret = await ask("2) OAuth Client Secret: ");
  if (!clientId || !clientSecret) { console.error("Client ID/Secret 필수."); process.exit(1); }

  // 루프백 서버 + 코드 수신 (redirectUri 캡처를 위해 직접 구성)
  const codePromise = new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, "http://127.0.0.1");
      if (!u.searchParams.has("code") && !u.searchParams.has("error")) { res.writeHead(404); res.end("waiting…"); return; }
      const code = u.searchParams.get("code"); const err = u.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<html><body style="font-family:sans-serif"><h2>${err ? "❌ " + err : "✅ 인증 완료"}</h2><p>터미널로 돌아가세요.</p></body></html>`);
      server.close();
      err ? reject(new Error("OAuth 실패: " + err)) : resolvePromise({ code, redirectUri: server._redirectUri });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server._redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: clientId, redirect_uri: server._redirectUri, response_type: "code",
        scope: SCOPE, access_type: "offline", prompt: "consent",
      });
      console.log("\n브라우저에서 동의하세요(자동으로 열어봅니다). 안 열리면 아래 URL 직접 열기:\n" + authUrl + "\n");
      openInBrowser(authUrl);
    });
    server.on("error", reject);
  });

  console.log("동의 대기 중…");
  const { code, redirectUri } = await codePromise;
  const refreshToken = await exchangeCode(clientId, clientSecret, code, redirectUri);
  console.log("✅ refresh token 수신 완료.\n");

  const devToken = await ask("3) Developer token (MCC API Center): ");
  const customerId = (await ask("4) Customer ID (10자리, 하이픈 무시): ")).replace(/[^0-9]/g, "");
  const loginCustomerId = (await ask("5) (선택) MCC login-customer-id, 없으면 Enter: ")).replace(/[^0-9]/g, "");
  rl.close();

  if (!devToken || !customerId) { console.error("Developer token / Customer ID 필수."); process.exit(1); }

  const lines = [
    "# OMO-2557 Google Ads API 자격증명 (자동 생성)",
    `GOOGLE_ADS_DEVELOPER_TOKEN=${devToken}`,
    `GOOGLE_OAUTH_CLIENT_ID=${clientId}`,
    `GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`,
    `GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`,
    `GOOGLE_ADS_CUSTOMER_ID=${customerId}`,
    `GOOGLE_ADS_LOGIN_CUSTOMER_ID=${loginCustomerId}`,
    "",
  ].join("\n");

  if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines, { mode: 0o600 });
  try { chmodSync(OUT, 0o600); } catch { /* 무시 */ }

  console.log(`\n✅ 저장 완료: ${OUT} (권한 600)`);
  console.log("다음: 이 이슈에 \"secrets 저장 완료\" 댓글 → 에이전트가 자동으로 전환 액션 생성/검증.");
  console.log("직접 확인하려면: node scripts/omo-2557-ads-api.mjs --dry-run");
})().catch((e) => { console.error("\n❌ 실패:", e.message); try { rl.close(); } catch {} process.exit(1); });
