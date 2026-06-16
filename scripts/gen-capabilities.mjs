#!/usr/bin/env node
// 전사 고도화 개발문서 생성기 (OMO-3352 / OMO-3361, PARITY_SCHEMA_VERSION=1)
// capabilities.config.json(SoT) + git 메타 → CAPABILITIES.md(자동생성, 직접수정 금지)
// 각 리포 scripts/gen-capabilities.mjs 로 복제. pre-push hook 에서 실행.
//
// 모드:
//   (기본)   config → CAPABILITIES.md 생성/덮어쓰기 (npm run cap:gen)
//   --check  생성하지 않고, 현재 CAPABILITIES.md 의 capability 상태가 config 와 일치하는지만 검증.
//            일치=exit0 / 불일치·문서없음=exit1. (pre-push 게이트용)
//            ※ lastCommit 등 휘발성 git 스탬프는 커밋마다 이동하므로 비교에서 제외한다.
//              표준 reference/pre-push 의 `git diff CAPABILITIES.md` 하드비교는 스탬프 이동만으로도
//              항상 차단→amend 무한루프를 유발하므로, 본 레퍼런스 구현에서 --check 로 대체(OMO-3361).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CONFIG = process.env.PARITY_CONFIG_PATH || 'capabilities.config.json';
const DOC = process.env.PARITY_DOC_PATH || 'CAPABILITIES.md';
const CHECK = process.argv.includes('--check');
const KEYS = ['quote_pdf','consent_signature','phone_removal_cta','ai_chatbot','reviews','reorder','payment_pg','jeju_shipping','north_star_env','supabase_rls','seo','admin_backend'];
const LABELS = {quote_pdf:'견적PDF',consent_signature:'동의+자필서명',phone_removal_cta:'전화제거+콜백',ai_chatbot:'AI챗봇',reviews:'후기/리뷰',reorder:'재주문',payment_pg:'결제/PG',jeju_shipping:'제주배송',north_star_env:'NorthStar env',supabase_rls:'prefix+RLS',seo:'SEO',admin_backend:'어드민백엔드'};
const ICON = {present:'✅',partial:'⚠️',absent:'❌',na:'N/A'};

function fail(m){ console.error('[gen-capabilities] '+m); process.exit(1); }
if(!existsSync(CONFIG)) fail(`${CONFIG} 없음 — 표준 위반. CAPABILITIES_STANDARD.md 참고.`);
const cfg = JSON.parse(readFileSync(CONFIG,'utf8'));
if(cfg.schemaVersion!==1) fail('schemaVersion 1 아님');
for(const k of KEYS){ const c=cfg.capabilities?.[k]; if(!c||!ICON[c.status]) fail(`capability ${k} 누락/잘못된 status`); }

// config 파생 — capability 상태 라인(문서 YAML 의 비휘발성 본질). --check 비교 기준.
const statusLines = KEYS.map(k=>`  ${k}: ${cfg.capabilities[k].status}`);

if(CHECK){
  if(!existsSync(DOC)) fail(`${DOC} 없음 — cap:gen 으로 생성 후 커밋하세요.`);
  const doc = readFileSync(DOC,'utf8');
  const missing = statusLines.filter(line => !doc.includes(line));
  if(missing.length){
    console.error(`[gen-capabilities --check] ${DOC} 의 capability 상태가 ${CONFIG} 와 불일치(미재생성):`);
    missing.forEach(l=>console.error('  기대:'+l.trim()));
    console.error(`해결: npm run cap:gen && git add ${DOC} && git commit --amend --no-edit`);
    process.exit(1);
  }
  console.log(`[gen-capabilities --check] ${DOC} ↔ ${CONFIG} 일치 (휘발성 git 스탬프 제외).`);
  process.exit(0);
}

const git=(c)=>{ try{return execSync(c,{encoding:'utf8'}).trim();}catch{return '';} };
const commit=git('git rev-parse --short HEAD');
const date=git('git log -1 --format=%cI');
const changed=git('git diff --name-only HEAD~1 HEAD').split('\n').filter(Boolean).slice(0,10);

const applic=KEYS.filter(k=>cfg.capabilities[k].status!=='na');
const score=Math.round(100*applic.reduce((s,k)=>s+({present:1,partial:0.5,absent:0}[cfg.capabilities[k].status]),0)/applic.length);

const yaml=['---',`schemaVersion: 1`,`service: ${cfg.service}`,`serviceType: ${cfg.serviceType}`,`score: ${score}`,`lastCommit: ${commit}`,`lastCommitDate: ${date}`,'capabilities:',
  ...statusLines,'---'].join('\n');

const rows=KEYS.map(k=>{const c=cfg.capabilities[k];return `| ${LABELS[k]} | ${ICON[c.status]} | ${c.evidence||'-'} | ${c.note||''} |`;}).join('\n');
const md=`${yaml}\n\n# ${cfg.service} 고도화 현황 (자동생성 · 직접수정 금지)\n\n**serviceType:** ${cfg.serviceType} · **고도화 점수:** ${score}% · **기준 커밋:** ${commit} (${date})\n\n| 항목 | 상태 | 근거 | 비고 |\n|---|:--:|---|---|\n${rows}\n\n> 갱신: 기능 출시 시 \`${CONFIG}\` 수정 → 커밋/푸시하면 본 문서 자동 재생성(pre-push hook).\n> 최근 변경 파일(HEAD~1..HEAD): ${changed.join(', ')||'-'}\n`;
writeFileSync(DOC,md);
console.log(`[gen-capabilities] ${DOC} 생성 (score ${score}%, commit ${commit})`);
