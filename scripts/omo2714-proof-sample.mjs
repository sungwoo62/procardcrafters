// OMO-2714 [Part C] 성원 발주용 프루프 샘플 — 단일 합본 AI (디자인판 + M100 명명 별색 레이어)
//
// OMO-2709 템플릿 컨벤션과 1:1 동일 (OMO-2704 결정문 정합):
//  - M100 별색 = process DeviceCMYK(0,1,0,0) + 명명된 OCG 레이어(`M100_별색_박`)
//  - 단일 합본(업로드 슬롯 1개), 레지마크 없음
//  - 치수: 재단(TrimBox) 85×55mm, 블리드(BleedBox=MediaBox) 91×61mm (블리드 3mm)
//  - drawText는 ASCII 한정(표준폰트 Helvetica=WinAnsi는 한글 인코딩 불가 — OMO-2709 한글 크래시 수정과 동일 정책)
//  - 한글 의미(레이어명 `별색`/`박`)는 OCG Name(UTF-16BE)과 PDF 메타데이터에 보존
//  - 출력: Illustrator 9+ `.ai` = PDF 컨테이너(`%PDF-`) → 일러스트레이터가 그대로 오픈
//
// 실행:  node scripts/omo2714-proof-sample.mjs [outPath]
// 의존:  pdf-lib (이미 설치됨)

import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, PDFArray, cmyk, rgb, StandardFonts, PDFOperator } from 'pdf-lib';
import { writeFileSync } from 'node:fs';

// ---- 입력 파라미터 (재현 가능) ----
const PARAMS = {
  product: 'business_cards',
  finishing: 'foil_stamp',        // 박 1도 (권장 후가공 1종)
  spotLayerName: 'M100_별색_박',   // 명명 별색 레이어 (한글 보존)
  spotLayerAsciiId: 'M100_SPOT_FOIL',
  trim:  { w: 85, h: 55 },         // mm — 재단
  bleed: 3,                        // mm — 블리드(사방)
  m100:  { c: 0, m: 1, y: 0, k: 0 },// DeviceCMYK(0,1,0,0)
};

const MM = 2.834645669; // 1mm in PDF points
const mm = (v) => v * MM;

const bleedW = PARAMS.trim.w + PARAMS.bleed * 2; // 91
const bleedH = PARAMS.trim.h + PARAMS.bleed * 2; // 61

const doc = await PDFDocument.create();
doc.setTitle('성원 프루프 샘플 — 명함 박 1도 (M100 별색판)');
doc.setSubject('OMO-2714 / OMO-2712 board proof — design + M100 named spot layer');
doc.setCreator('procardcrafters OMO-2714 proof exporter');
doc.setProducer('pdf-lib (OMO-2709 convention)');
doc.setKeywords([PARAMS.spotLayerName, 'DeviceCMYK(0,1,0,0)', '재단85x55', '블리드3mm']);

const page = doc.addPage([mm(bleedW), mm(bleedH)]);

// ---- Box 설정: MediaBox=BleedBox=블리드, TrimBox=재단 ----
const setBox = (key, x, y, w, h) => {
  const arr = doc.context.obj([mm(x), mm(y), mm(x + w), mm(y + h)]);
  page.node.set(PDFName.of(key), arr);
};
// MediaBox already = bleed size from addPage; set explicitly + Trim/Bleed
setBox('MediaBox', 0, 0, bleedW, bleedH);
setBox('BleedBox', 0, 0, bleedW, bleedH);
setBox('TrimBox', PARAMS.bleed, PARAMS.bleed, PARAMS.trim.w, PARAMS.trim.h); // 3,3 .. 88,58

const helv = await doc.embedFont(StandardFonts.Helvetica);
const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
const ascii = (s) => s.replace(/[^\x20-\x7E]/g, '?'); // WinAnsi 안전

// 좌표 헬퍼: 디자인 원점 = 재단 좌하단(블리드 오프셋)
const ox = PARAMS.bleed, oy = PARAMS.bleed;

// --spot-only: M100 별색판만 렌더(분판 미리보기용). 디자인판 생략.
const spotOnly = process.argv.includes('--spot-only');

// ===== 디자인판(프로세스 CMYK) — OCG 밖 =====
// 배경(백색 유지) + 카드 본문 텍스트/룰. 박으로 갈 요소는 여기 그리지 않음.
if (!spotOnly) {
page.drawText(ascii('ALLPACK STUDIO'), {
  x: mm(ox + 8), y: mm(oy + PARAMS.trim.h - 16), size: 13, font: helvB,
  color: cmyk(0.85, 0.55, 0, 0.1),
});
page.drawText(ascii('Premium Print & Finishing'), {
  x: mm(ox + 8), y: mm(oy + PARAMS.trim.h - 22), size: 7, font: helv,
  color: cmyk(0, 0, 0, 0.55),
});
const lines = [
  'Hong Gil-dong  /  Art Director',
  'T  +82 2 0000 0000',
  'E  hello@allpack.example',
  'omoongmoo.com',
];
lines.forEach((t, i) => {
  page.drawText(ascii(t), {
    x: mm(ox + 8), y: mm(oy + 16 - i * 4.2), size: 6.2, font: helv,
    color: cmyk(0, 0, 0, 0.8),
  });
});
// 디자인 룰(가는 선) — 프로세스
page.drawLine({
  start: { x: mm(ox + 8), y: mm(oy + PARAMS.trim.h - 25) },
  end:   { x: mm(ox + 40), y: mm(oy + PARAMS.trim.h - 25) },
  thickness: 0.6, color: cmyk(0, 0, 0, 0.25),
});
} // end !spotOnly

// ===== M100 별색(박) 레이어 — 명명 OCG =====
// 1) OCG 딕셔너리 (Name = UTF-16BE 로 한글 보존)
const ocgDict = doc.context.obj({
  Type: 'OCG',
  Name: PDFHexString.fromText(PARAMS.spotLayerName), // UTF-16BE → '별색/박' 보존
});
const ocgRef = doc.context.register(ocgDict);

// 2) Catalog /OCProperties
const ocgArray = doc.context.obj([ocgRef]);
const ocProps = doc.context.obj({
  OCGs: ocgArray,
  D: doc.context.obj({ Order: doc.context.obj([ocgRef]), ON: doc.context.obj([ocgRef]) }),
});
doc.catalog.set(PDFName.of('OCProperties'), ocProps);

// 3) Page Resources /Properties << /OC0 ocgRef >>
const resources = page.node.Resources();
let props = resources.lookup(PDFName.of('Properties'));
if (!props) { props = doc.context.obj({}); resources.set(PDFName.of('Properties'), props); }
props.set(PDFName.of('OC0'), ocgRef);

// 4) 별색 콘텐츠를 /OC /OC0 BDC ... EMC 로 감싸기
page.pushOperators(PDFOperator.of('BDC', [PDFName.of('OC'), PDFName.of('OC0')]));

// 박 요소: 로고 배지(원형) + 박 라인 + 상호 보조표시 — 전부 DeviceCMYK(0,1,0,0)
const M = cmyk(PARAMS.m100.c, PARAMS.m100.m, PARAMS.m100.y, PARAMS.m100.k);
page.drawCircle({ x: mm(ox + PARAMS.trim.w - 16), y: mm(oy + PARAMS.trim.h - 16), size: mm(7), color: M });
page.drawText(ascii('A'), { x: mm(ox + PARAMS.trim.w - 18.4), y: mm(oy + PARAMS.trim.h - 19), size: 16, font: helvB, color: cmyk(0,0,0,0) });
// 박 강조선 (재단 하단 근처)
page.drawRectangle({ x: mm(ox + 8), y: mm(oy + 22), width: mm(28), height: mm(1.2), color: M });
// 박 후가공 표식 라벨(ASCII)
page.drawText(ascii('FOIL / M100 SPOT'), { x: mm(ox + 8), y: mm(oy + 24), size: 4.5, font: helv, color: M });

page.pushOperators(PDFOperator.of('EMC', []));

// ===== 블리드 폐기구간 식별 라벨(레지마크 아님) =====
if (!spotOnly) {
page.drawText(ascii(`M100 SPOT PLATE = ${PARAMS.spotLayerAsciiId}  |  DeviceCMYK(0,1,0,0)  |  TRIM 85x55 BLEED 3mm  |  NO REG MARKS`), {
  x: mm(2), y: mm(1.0), size: 3.0, font: helv, color: cmyk(0, 0, 0, 0.6),
});
}

const argOut = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const out = argOut || (spotOnly
  ? 'scripts/test-artifacts/omo2714-proof-foil-m100-SPOTONLY.ai'
  : 'scripts/test-artifacts/omo2714-proof-foil-m100.ai');
const bytes = await doc.save();
writeFileSync(out, bytes);

// ---- 콘솔 요약 ----
console.log(JSON.stringify({
  out,
  bytes: bytes.length,
  magic: Buffer.from(bytes.slice(0, 5)).toString('latin1'),
  params: PARAMS,
  boxes_mm: { MediaBox: [bleedW, bleedH], BleedBox: [bleedW, bleedH], TrimBox: [PARAMS.trim.w, PARAMS.trim.h] },
}, null, 2));
