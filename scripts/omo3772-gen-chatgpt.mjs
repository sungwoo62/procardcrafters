#!/usr/bin/env node
// OMO-3772: 프로카드 인스타 실사 제품사진 60장 생성
// 방식: Mac-Studio ChatGPT.app GUI 자동화(Nutri-Creative 방식, OMO-3348/3559 계승)
//  - 입력: AX set-value(클립보드 권한 다이얼로그 회피, OMO-3427서 동작 확인)
//  - 전송: key code 36 (Return)
//  - 저장: ChatGPT.app Kingfisher 캐시에서 신규 정사각 PNG 회수(우클릭 좌표저장보다 견고)
//  - 정규화: 1080x1080 (정사각, 흰 패딩 아닌 센터크롭)
// 재개 가능: 이미 .png 있는 id는 건너뜀. 레이트/중단 시 가능한 만큼 생성 후 종료.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/william/procardcrafters';
const PLAN = path.join(ROOT, 'src/data/omo3764-instagram-plan.json');
const OUTDIR = path.join(ROOT, 'public/instagram/omo3764');
const HID = '/tmp/omo3772_hid';
const CACHE = `${process.env.HOME}/Library/Caches/com.openai.chat/com.onevcat.Kingfisher.ImageCache/com.onevcat.Kingfisher.ImageCache.com.openai.chat`;
const LOG = '/tmp/omo3772_gen.log';
// 입력창 논리좌표 후보: 대화 내용이 있으면 하단 고정(960,952), 빈 새채팅이면 중앙(720,702)
// ChatGPT는 빈 채팅에서 입력창을 중앙배치 → 메시지가 쌓이면 하단으로 이동(레이아웃 시프트)
const INPUT_CANDIDATES = [[960, 952], [720, 702]];
const POLL_MS = 2000, POLL_MAX = 90;    // 최대 ~180s 대기
const GAP_MS = 4000;                    // 컷 간 간격

const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };
const sleep = (ms) => execSync(`sleep ${ms / 1000}`);

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }).trim(); }
function osa(script) { return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim(); }

// 캐시 내 PNG 파일 스냅샷(정사각 후보 식별용)
function cachePngs() {
  if (!fs.existsSync(CACHE)) return new Map();
  const out = new Map();
  for (const f of fs.readdirSync(CACHE)) {
    const fp = path.join(CACHE, f);
    let st; try { st = fs.statSync(fp); } catch { continue; }
    if (!st.isFile() || st.size < 200 * 1024) continue;
    out.set(f, { mtime: st.mtimeMs, size: st.size, fp });
  }
  return out;
}
function isPng(fp) { try { return execSync(`file -b "${fp}"`, { encoding: 'utf8' }).includes('PNG'); } catch { return false; } }
function dims(fp) {
  const o = sh(`sips -g pixelWidth -g pixelHeight "${fp}"`);
  const w = +(/pixelWidth: (\d+)/.exec(o)?.[1] || 0);
  const h = +(/pixelHeight: (\d+)/.exec(o)?.[1] || 0);
  return { w, h };
}

function focusInput() {
  // 견고화: 포커스 hiccup(-1728 등) 시 윈도우 복구 후 재시도, 예외로 죽지 않음
  for (let attempt = 0; attempt < 3; attempt++) {
    // 대화 내 이미지를 잘못 클릭하면 라이트박스가 열려 포커스를 가로챔 → Escape 2회로 선제 제거
    try { osa('tell application "System Events" to key code 53'); } catch {}
    try { osa('tell application "System Events" to key code 53'); } catch {}
    sleep(250);
    try { osa('tell application "ChatGPT" to activate'); } catch {}
    sleep(300);
    try { osa('tell application "System Events" to tell process "ChatGPT" to perform action "AXRaise" of window 1'); } catch {}
    for (const [x, y] of INPUT_CANDIDATES) {
      try {
        execFileSync(HID, ['click', String(x), String(y)]);
        sleep(450);
        const r = osa('tell application "System Events" to tell process "ChatGPT" to return role of (value of attribute "AXFocusedUIElement")');
        if (r.includes('AXTextArea')) return true;
      } catch (e) {
        log(`focus attempt ${attempt} @${x},${y}: ${String(e.message || e).slice(0, 80)}`);
      }
    }
    try { ensureWindow(); } catch {}
    sleep(800);
  }
  return false;
}

function sendPrompt(text) {
  fs.writeFileSync('/tmp/omo3772_cur.txt', text);
  osa('set t to (read (POSIX file "/tmp/omo3772_cur.txt") as «class utf8»)\n'
    + 'tell application "System Events" to tell process "ChatGPT" to set value of (value of attribute "AXFocusedUIElement") to t');
  sleep(400);
  osa('tell application "System Events" to key code 36'); // Return
}

// 신규 정사각(0.8~1.25) PNG가 베이스라인 이후 등장할 때까지 폴링
function waitForNewImage(baseline) {
  for (let i = 0; i < POLL_MAX; i++) {
    sleep(POLL_MS);
    const now = cachePngs();
    const cand = [];
    for (const [f, meta] of now) {
      if (baseline.has(f)) continue;
      try {
        if (!isPng(meta.fp)) continue;
        const { w, h } = dims(meta.fp);
        if (!w || !h) continue;
        const ar = w / h;
        if (ar >= 0.8 && ar <= 1.25) cand.push({ ...meta, w, h });
      } catch { /* 캐시 파일 기록중 — 다음 폴링에서 재시도 */ }
    }
    if (cand.length) { cand.sort((a, b) => b.mtime - a.mtime); return cand[0]; }
  }
  return null;
}

function normalizeSquare(srcFp, outFp) {
  const { w, h } = dims(srcFp);
  const min = Math.min(w, h);
  const scale = 1080 / min;
  const nw = Math.round(w * scale), nh = Math.round(h * scale);
  const tmp = '/tmp/omo3772_norm.png';
  sh(`sips -z ${nh} ${nw} "${srcFp}" --out "${tmp}"`);
  sh(`sips -c 1080 1080 "${tmp}" --out "${outFp}"`); // 센터 크롭
}

function ensureWindow() {
  // 디스플레이/윈도우 깨우기
  try { execSync('caffeinate -u -t 6 &'); } catch {}
  execFileSync(HID, ['move', '960', '540']); sleep(300);
  execFileSync(HID, ['move', '950', '520']); sleep(300);
  execSync('open -a ChatGPT'); sleep(1500);
  let n = +osa('tell application "System Events" to tell process "ChatGPT" to return count of windows');
  if (n === 0) {
    osa('tell application "System Events" to key code 49 using {option down}'); // Option+Space
    sleep(1500);
    n = +osa('tell application "System Events" to tell process "ChatGPT" to return count of windows');
  }
  osa('tell application "ChatGPT" to activate'); sleep(600);
  try { osa('tell application "System Events" to tell process "ChatGPT" to perform action "AXRaise" of window 1'); } catch {}
  sleep(600);
  return n;
}

function main() {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  const posts = plan.posts;
  fs.mkdirSync(OUTDIR, { recursive: true });
  log(`=== OMO-3772 start: ${posts.length} posts ===`);
  const wins = ensureWindow();
  log(`ChatGPT windows=${wins}`);
  if (!focusInput()) { log('FATAL: input not focusable; abort'); process.exit(3); }

  let done = 0, made = 0, failed = 0, skipped = 0, consecFail = 0;
  for (const post of posts) {
    const outFp = path.join(OUTDIR, `${post.id}.png`);
    if (fs.existsSync(outFp)) { skipped++; log(`skip ${post.id} (exists)`); continue; }
    const msg = `Please generate ONE image and output only the image. Photorealistic, square 1:1 (1024x1024) professional product photography. Absolutely no text, no logo, no watermark anywhere in the image. Prompt: ${post.photoPrompt}`;
    try {
      const baseline = cachePngs();
      if (!focusInput()) { log(`WARN ${post.id}: refocus failed, recover window`); ensureWindow(); if (!focusInput()) throw new Error('input not focusable'); }
      log(`gen ${post.id} (${post.product}) ...`);
      sendPrompt(msg);
      let img = waitForNewImage(baseline);
      if (!img) { // 재시도 1회(스트리밍 중단 대비)
        log(`retry ${post.id} (no image yet)`);
        if (!focusInput()) { ensureWindow(); focusInput(); }
        const b2 = cachePngs();
        sendPrompt(msg);
        img = waitForNewImage(b2);
      }
      if (!img) { failed++; consecFail++; log(`FAIL ${post.id}: no image after timeout (rate limit?)`); if (consecFail >= 3) { log('3 consecutive no-image — stopping for resume (likely rate limit)'); break; } continue; }
      fs.copyFileSync(img.fp, path.join('/tmp', `${post.id}_orig.png`));
      normalizeSquare(img.fp, outFp);
      const d = dims(outFp);
      made++; done++; consecFail = 0;
      log(`OK ${post.id} -> ${outFp} (${d.w}x${d.h}, src ${img.w}x${img.h})`);
      sleep(GAP_MS);
    } catch (e) {
      failed++; consecFail++;
      log(`ERROR ${post.id}: ${String(e.message || e).slice(0, 160)}`);
      try { ensureWindow(); } catch {}
      if (consecFail >= 3) { log('3 consecutive errors — stopping for resume'); break; }
      sleep(GAP_MS);
    }
  }
  log(`=== DONE: made=${made} skipped=${skipped} failed=${failed} ===`);
  const pngs = fs.readdirSync(OUTDIR).filter(f => f.endsWith('.png')).length;
  log(`total .png in outdir: ${pngs}/60`);
}
main();
