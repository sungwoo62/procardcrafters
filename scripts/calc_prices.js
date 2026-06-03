const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scripts/swadpia_data.json', 'utf8'));
const jsonOBJ = typeof raw === 'string' ? JSON.parse(raw) : raw;

const KRW_TO_USD_RATE = 1400;
const USD_MARGIN = 1.5;
const CATEGORY_CODE = 'CNC2000';

const krwToUsd = (krw) => Math.ceil((krw / KRW_TO_USD_RATE) * USD_MARGIN * 100) / 100;

function jsonPath(obj, path) {
  // $.print_info1[?(@.unit_key=='X')][?(@.paper_code=='Y')]
  const m = path.match(/\$\.(\w+)\[\?\(@\.(\w+)==='([^']+)'\)\]\[\?\(@\.(\w+)==='([^']+)'\)\]/);
  if (m) {
    const [, arr, k1, v1, k2, v2] = m;
    const data = typeof obj[arr] === 'string' ? JSON.parse(obj[arr]) : obj[arr];
    return data.filter(item => String(item[k1]) === String(v1))
               .map(item => item[k2] !== undefined ? item : item['0'])
               .filter(item => item && String(item[k2]) === String(v2));
  }
  // $.paper_info.*
  const m2 = path.match(/\$\.(\w+)\.\*/);
  if (m2) {
    const data = typeof obj[m2[1]] === 'string' ? JSON.parse(obj[m2[1]]) : obj[m2[1]];
    return data;
  }
  return [];
}

function getPrintUnit(jsonOBJ, paper_code, print_color_type, paper_qty, size_type) {
  const side_color = print_color_type.substr(3, 1);
  
  let paper_qty_ratio = 1;
  if (paper_code === 'ARM230W00') paper_qty_ratio = 1.5;
  else if (['VNV320W00','RBE359W00','VVT359W00'].includes(paper_code)) paper_qty_ratio = 0.5;
  
  let unit_key = paper_qty / paper_qty_ratio;
  
  const print_info1 = typeof jsonOBJ.print_info1 === 'string' 
    ? JSON.parse(jsonOBJ.print_info1) 
    : jsonOBJ.print_info1;

  let print_price_unit = 0;

  if (unit_key > 800) {
    const unit_key_max = 800;
    const unit_key_over = 1000;
    
    const info_max = print_info1.find(i => String(i.unit_key) === String(unit_key_max));
    const info_over = print_info1.find(i => String(i.unit_key) === String(unit_key_over));
    
    if (!info_max || !info_over) return 0;
    
    const d_max = info_max['0'] || info_max;
    const d_over = info_over['0'] || info_over;
    
    // paper_code 필터
    const max_by_paper = print_info1.filter(i => String(i.unit_key) === String(unit_key_max) && (i['0']?.paper_code === paper_code));
    const over_by_paper = print_info1.filter(i => String(i.unit_key) === String(unit_key_over) && (i['0']?.paper_code === paper_code));
    
    if (!max_by_paper.length || !over_by_paper.length) return 0;
    
    const dm = max_by_paper[0]['0'];
    const do_ = over_by_paper[0]['0'];
    
    let pmax = (side_color === '1' || side_color === '2') ? parseInt(dm.print_unit1) : parseInt(dm.print_unit2);
    let pover = (side_color === '1' || side_color === '2') ? parseInt(do_.price_unit1) : parseInt(do_.price_unit2);
    
    const over_calc = Math.max((pover * ((unit_key - 800) / 200)), 0);
    print_price_unit = pmax + over_calc;
  } else {
    const info = print_info1.filter(i => String(i.unit_key) === String(unit_key) && i['0']?.paper_code === paper_code);
    if (!info.length) return 0;
    const d = info[0]['0'];
    print_price_unit = (side_color === '1' || side_color === '2') ? parseInt(d.print_unit1) : parseInt(d.print_unit2);
  }
  
  return print_price_unit;
}

function calcPrice(jsonOBJ, paper_code, print_color_type, paper_qty, size_type, paper_size) {
  const print_price_unit = getPrintUnit(jsonOBJ, paper_code, print_color_type, paper_qty, size_type);
  if (!print_price_unit) return null;
  
  // 명함 고정값: digit_number=1, area=1
  const this_print_digit_number_min = 1;
  const order_count = 1;
  
  let this_print_price = Math.ceil((this_print_digit_number_min * print_price_unit) / 100) * 100 * order_count;
  
  // 별색 추가금
  const side_color_right = print_color_type.substr(4, 1);
  let print_color_price = 0;
  if (parseInt(side_color_right) > 0 && !['CTN14','CTN15','CTN16','CTN44','CTN45','CTN46','CTN47','CTN48'].includes(print_color_type)) {
    const paper_qty_color_rate = paper_qty / 200;
    const print_digit_number_rate = Math.max(this_print_digit_number_min * 0.8, 1);
    const side_color = print_color_type.substr(3, 1);
    const spot_color_price = (side_color === '2' || side_color === '5') ? 1500 : 2000;
    print_color_price = Math.round((paper_qty_color_rate * print_digit_number_rate * spot_color_price * order_count) / 100) * 100;
  }
  
  this_print_price += print_color_price;
  return this_print_price;
}

// 전체 옵션 목록
const paper_info = typeof jsonOBJ.paper_info === 'string' ? JSON.parse(jsonOBJ.paper_info) : jsonOBJ.paper_info;
const paper_codes = paper_info.map(p => p.paper_code);
const print_color_types = ['CTN40','CTN10','CTN11','CTN41','CTN12','CTN42','CTN13','CTN43','CTN99'];
const size_types = ['SZT10','SZT20'];
const paper_sizes = ['N0100','N0500','N0600'];
const allQtys = [200,400,600,800,1000,1200,1400,1600,1800,2000,2500,3000,3500,4000,5000,6000,7000,8000,9000,10000];

const results = [];
let skip = 0;

for (const paper of paper_codes) {
  for (const color of print_color_types) {
    for (const sizeType of size_types) {
      for (const paperSize of paper_sizes) {
        for (const qty of allQtys) {
          const krw = calcPrice(jsonOBJ, paper, color, qty, sizeType, paperSize);
          if (krw === null || krw <= 0) { skip++; continue; }
          results.push({
            paper_code: paper,
            print_color_type: color,
            size_type: sizeType,
            paper_size: paperSize,
            quantity: qty,
            krw_price: krw,
            usd_price: krwToUsd(krw),
          });
        }
      }
    }
  }
}

const outPath = 'scripts/prices_final.json';
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`✅ 완료! ${results.length}개 / 스킵: ${skip}개`);
console.log(`💰 가격범위: $${Math.min(...results.map(x=>x.usd_price))} ~ $${Math.max(...results.map(x=>x.usd_price))}`);

// 샘플 출력
console.log('\n샘플:');
results.slice(0,3).forEach(r => console.log(JSON.stringify(r)));
