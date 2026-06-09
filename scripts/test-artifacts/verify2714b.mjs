import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const bytes = readFileSync('scripts/test-artifacts/omo2714-proof-foil-m100.ai');
const doc = await PDFDocument.load(bytes);
const page = doc.getPage(0);
const contents = page.node.Contents();
const streams = contents.constructor.name === 'PDFArray' ? contents.asArray().map(r=>doc.context.lookup(r)) : [contents];
let decoded = '';
for (const s of streams) {
  const raw = s.getContents();
  let buf = Buffer.from(raw);
  const filt = s.dict.get(PDFName.of('Filter'));
  if (filt && filt.toString().includes('FlateDecode')) { try { buf = inflateSync(buf); } catch(e){ console.log('inflate fail', e.message);} }
  decoded += buf.toString('latin1');
}
console.log('--- content stream (operators) ---');
console.log(decoded);
console.log('--- checks ---');
console.log('OC marked-content BDC :', /\/OC\s+\/OC0\s+BDC/.test(decoded));
console.log('EMC close            :', /\bEMC\b/.test(decoded));
console.log('DeviceCMYK 0 1 0 0 k :', /\b0 1 0 0 k\b/.test(decoded));
// also page resources Properties /OC0
const res = page.node.Resources();
const props = res.lookup(PDFName.of('Properties'));
console.log('Resources Properties /OC0 present :', !!(props && props.get(PDFName.of('OC0'))));
