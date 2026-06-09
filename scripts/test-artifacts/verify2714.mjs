import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib';
import { readFileSync } from 'node:fs';
const f = 'scripts/test-artifacts/omo2714-proof-foil-m100.ai';
const bytes = readFileSync(f);
const doc = await PDFDocument.load(bytes);
const page = doc.getPage(0);
const MM = 2.834645669;
const box = (k) => { const a = page.node.get(PDFName.of(k)); return a ? a.asArray().map(n=>+(n.asNumber()/MM).toFixed(2)) : null; };
console.log('MediaBox mm', box('MediaBox'));
console.log('BleedBox mm', box('BleedBox'));
console.log('TrimBox  mm', box('TrimBox'));
// OCProperties / OCG name
const cat = doc.catalog;
const ocp = cat.lookup(PDFName.of('OCProperties'));
const ocgs = ocp.lookup(PDFName.of('OCGs')).asArray();
console.log('OCG count', ocgs.length);
const ocg = ocgs[0].lookup ? ocgs[0].lookup() : doc.context.lookup(ocgs[0]);
const nm = (doc.context.lookup(ocgs[0])).get(PDFName.of('Name'));
// decode hex string
const raw = nm.toString();
console.log('OCG Name raw', raw);
try { console.log('OCG Name decoded', nm.decodeText ? nm.decodeText() : '(n/a)'); } catch(e){}
// raw content stream search
const txt = bytes.toString('latin1');
console.log('has /OC /OC0 BDC :', txt.includes('/OC /OC0 BDC') || /\/OC\s*\/OC0\s*BDC/.test(txt));
console.log('has EMC          :', txt.includes('EMC'));
// DeviceCMYK 0 1 0 0 fill operator (pdf-lib emits as "0 1 0 0 k")
console.log('has CMYK k op    :', /0 1 0 0 k/.test(txt) || /0(\.0+)? 1(\.0+)? 0(\.0+)? 0(\.0+)? k/.test(txt));
console.log('Properties /OC0  :', txt.includes('/OC0'));
