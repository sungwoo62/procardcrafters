const fs=require('fs');
const f=process.argv[2];
let s=fs.readFileSync(f,'utf8');
// Replace each top-level eval( from packer with a capture. Packer pattern: eval(function(p,a,c,k,e,d){...}(...))
// Strategy: globally replace "eval(" with "(__cap.push," won't parse. Instead define eval shim.
let out=[];
const sandbox={ __out:out };
// Override eval within a Function scope
let code = s.replace(/\beval\(/g, '__OUT__(');
const fn=new Function('__OUT__', code + '\n;');
try{ fn(function(x){ out.push(x); }); }catch(e){ /* nested */ }
let src=out.join('\n');
// recursively unpack if still packed
let guard=0;
while(/\beval\(function\(p,a,c,k,e,d\)/.test(src) && guard++<5){
  let inner=[];
  let c2=src.replace(/\beval\(/g,'__OUT__(');
  try{ new Function('__OUT__', c2+'\n;')(function(x){inner.push(x);}); src=inner.join('\n'); }catch(e){ break; }
}
// beautify
src=src.replace(/;/g,';\n').replace(/\{/g,'{\n').replace(/\}/g,'\n}\n');
fs.writeFileSync(f.replace('.js','.unpacked.js'), src);
console.log('unpacked '+f+' -> '+src.length+' chars');
