const { chromium } = require('playwright');

// ============================================
// 설정
// ============================================
const TARGET_URL = 'https://www.swadpia.co.kr/goods/goods_view/CNC2000/GNC2001';
const KRW_TO_USD_RATE = 1400; // 환율 (나중에 조정)
const USD_MARGIN = 1.5;       // 마진 배수
const DELAY_MIN = 50;
const DELAY_MAX = 150;

// 수집할 수량 포인트 (역산용)
const QTY_SAMPLE = ['200', '1000', '3000', '5000'];

// ============================================
// 헬퍼
// ============================================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => sleep(DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN));

function krwToUsd(krw) {
  return Math.ceil((krw / KRW_TO_USD_RATE) * USD_MARGIN * 100) / 100;
}

// 선형 보간으로 중간 수량 가격 계산
function interpolatePrice(qty, samples) {
  const points = Object.keys(samples).map(Number).sort((a,b) => a-b);
  
  if (qty <= points[0]) return samples[points[0]];
  if (qty >= points[points.length-1]) {
    // 마지막 구간 기울기로 외삽
    const last = points[points.length-1];
    const secondLast = points[points.length-2];
    const slope = (samples[last] - samples[secondLast]) / (last - secondLast);
    return Math.round(samples[last] + slope * (qty - last));
  }
  
  for (let i = 0; i < points.length - 1; i++) {
    if (qty >= points[i] && qty <= points[i+1]) {
      const ratio = (qty - points[i]) / (points[i+1] - points[i]);
      return Math.round(samples[points[i]] + ratio * (samples[points[i+1]] - samples[points[i]]));
    }
  }
}

// ============================================
// 메인 스크래퍼
// ============================================
async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  console.log('🚀 성원애드피아 스크래퍼 시작');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await sleep(2000);

  // 1. 옵션 목록 수집
  const options = await page.evaluate(() => {
    const getOpts = (name) => Array.from(document.querySelector(`select[name=${name}]`)?.options || []).map(o => o.value).filter(v => v);
    return {
      paper_code: getOpts('paper_code'),
      print_color_type: getOpts('print_color_type'),
      size_type: getOpts('size_type'),
      paper_size: getOpts('paper_size'),
    };
  });

  console.log(`📋 옵션 수집:`, JSON.stringify({
    paper: options.paper_code.length,
    color: options.print_color_type.length,
    size_type: options.size_type.length,
    paper_size: options.paper_size.length,
  }));

  const totalCombos = options.paper_code.length * options.print_color_type.length * 
                      options.size_type.length * options.paper_size.length;
  console.log(`🔢 총 조합: ${totalCombos}개 × ${QTY_SAMPLE.length}수량 = ${totalCombos * QTY_SAMPLE.length}회 요청`);

  const results = [];
  let count = 0;

  for (const paper of options.paper_code) {
    for (const color of options.print_color_type) {
      for (const sizeType of options.size_type) {
        for (const paperSize of options.paper_size) {
          // 수량 샘플 포인트별 가격 수집
          const qtySamples = {};
          let valid = true;

          for (const qty of QTY_SAMPLE) {
            try {
              const price = await page.evaluate(({ paper, color, sizeType, paperSize, qty }) => {
                const setVal = (name, val) => {
                  const el = document.querySelector(`select[name=${name}]`);
                  if (!el) return;
                  el.value = val;
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                };
                setVal('paper_code', paper);
                setVal('print_color_type', color);
                setVal('size_type', sizeType);
                setVal('paper_size', paperSize);
                setVal('paper_qty', qty);
                return window.this_print_price;
              }, { paper, color, sizeType, paperSize, qty });

              await sleep(50); // 짧은 딜레이로 JS 계산 대기
              
              // 가격 재확인
              const confirmedPrice = await page.evaluate(() => window.this_print_price);
              qtySamples[qty] = confirmedPrice || price;

              if (!qtySamples[qty] || qtySamples[qty] <= 0) {
                valid = false;
                break;
              }
            } catch (e) {
              valid = false;
              break;
            }
          }

          if (!valid) {
            console.log(`⚠️ 스킵: ${paper}/${color}/${sizeType}/${paperSize}`);
            continue;
          }

          // 전체 수량 보간 계산
          const allQtys = [200,400,600,800,1000,1200,1400,1600,1800,2000,
                           2500,3000,3500,4000,5000,6000,7000,8000,9000,10000];
          
          for (const qty of allQtys) {
            const krwPrice = interpolatePrice(qty, qtySamples);
            const usdPrice = krwToUsd(krwPrice);
            results.push({
              source_url: TARGET_URL,
              paper_code: paper,
              print_color_type: color,
              size_type: sizeType,
              paper_size: paperSize,
              quantity: qty,
              krw_price: krwPrice,
              usd_price: usdPrice,
            });
          }

          count++;
          if (count % 10 === 0) {
            console.log(`✅ 진행: ${count}/${totalCombos} 조합 완료`);
          }

          await sleep(50);
        }
      }
    }
  }

  await browser.close();

  // JSON 저장
  const fs = require('fs');
  const outPath = `scripts/scraped_${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n🎉 완료! ${results.length}개 가격 데이터 저장: ${outPath}`);
  return outPath;
}

scrape().catch(console.error);
