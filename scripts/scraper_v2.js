const { chromium } = require('playwright');

const TARGET_URL = 'https://www.swadpia.co.kr/goods/goods_view/CNC2000/GNC2001';
const KRW_TO_USD_RATE = 1400;
const USD_MARGIN = 1.5;
const QTY_SAMPLE = ['200', '1000', '3000', '5000'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const krwToUsd = (krw) => Math.ceil((krw / KRW_TO_USD_RATE) * USD_MARGIN * 100) / 100;

function interpolatePrice(qty, samples) {
  const points = Object.keys(samples).map(Number).sort((a,b) => a-b);
  if (qty <= points[0]) return samples[points[0]];
  if (qty >= points[points.length-1]) return samples[points[points.length-1]];
  for (let i = 0; i < points.length - 1; i++) {
    if (qty >= points[i] && qty <= points[i+1]) {
      const ratio = (qty - points[i]) / (points[i+1] - points[i]);
      return Math.round(samples[points[i]] + ratio * (samples[points[i+1]] - samples[points[i]]));
    }
  }
}

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const page = await context.newPage();

  console.log('🚀 성원애드피아 스크래퍼 v2 시작');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await sleep(2000);

  const options = await page.evaluate(() => {
    const getOpts = (name) => Array.from(document.querySelector(`select[name=${name}]`)?.options || []).map(o => o.value).filter(v => v);
    return {
      paper_code: getOpts('paper_code'),
      print_color_type: getOpts('print_color_type'),
      size_type: getOpts('size_type'),
      paper_size: getOpts('paper_size'),
    };
  });

  const totalCombos = options.paper_code.length * options.print_color_type.length *
                      options.size_type.length * options.paper_size.length;
  console.log(`🔢 총 조합: ${totalCombos}개`);

  const results = [];
  const allQtys = [200,400,600,800,1000,1200,1400,1600,1800,2000,2500,3000,3500,4000,5000,6000,7000,8000,9000,10000];
  let count = 0;
  let skipCount = 0;

  for (const paper of options.paper_code) {
    for (const color of options.print_color_type) {
      for (const sizeType of options.size_type) {
        for (const paperSize of options.paper_size) {
          const qtySamples = {};
          let valid = true;

          for (const qty of QTY_SAMPLE) {
            // evaluate 밖에서 sleep 처리
            await page.evaluate(({ paper, color, sizeType, paperSize, qty }) => {
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
            }, { paper, color, sizeType, paperSize, qty });

            await sleep(150); // evaluate 밖에서 대기

            // 한 번 더 qty 세팅 (안정화)
            await page.evaluate(({ qty }) => {
              const el = document.querySelector('select[name=paper_qty]');
              if (el) {
                el.value = qty;
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, { qty });

            await sleep(150);

            const price = await page.evaluate(() => window.this_print_price);

            if (!price || price <= 0) { valid = false; break; }
            qtySamples[parseInt(qty)] = price;
          }

          if (!valid) { skipCount++; continue; }

          // 단조증가 검증 + 역전 보정
          const sampleKeys = Object.keys(qtySamples).map(Number).sort((a,b)=>a-b);
          let lastValid = qtySamples[sampleKeys[0]];
          for (const k of sampleKeys) {
            if (qtySamples[k] < lastValid) {
              console.log(`⚠️ 역전보정: ${paper} qty${k}: ${qtySamples[k]} → ${lastValid}`);
              qtySamples[k] = lastValid;
            } else {
              lastValid = qtySamples[k];
            }
          }

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
          if (count % 50 === 0) console.log(`✅ 진행: ${count}/${totalCombos}`);
          await sleep(50);
        }
      }
    }
  }

  await browser.close();
  const fs = require('fs');
  const outPath = `scripts/scraped_v2_${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n🎉 완료! ${results.length}개 저장: ${outPath}`);
  console.log(`⚠️ 스킵: ${skipCount}개`);
}

scrape().catch(console.error);
