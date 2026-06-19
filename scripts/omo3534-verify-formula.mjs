// OMO-3534: getBakPriceUnit/calcuBakPrice TS 재구현을 그라운드트루스 대비 검증.
const MU = { // CNC1000 material_unit (런타임 표집, omo3534)
  BKT01: { m2: 26000, rate: 2, low: 640, high: 60000 }, BKT02: { m2: 26000, rate: 2, low: 640, high: 60000 },
  BKT03: { m2: 26000, rate: 2, low: 640, high: 60000 }, BKT04: { m2: 26000, rate: 2, low: 640, high: 60000 },
  BKT05: { m2: 26000, rate: 2, low: 640, high: 60000 }, BKT06: { m2: 30000, rate: 2, low: 640, high: 60000 },
  BKT07: { m2: 70000, rate: 2, low: 640, high: 60000 }, BKT08: { m2: 35000, rate: 2, low: 640, high: 60000 },
  BKT09: { m2: 26000, rate: 2, low: 640, high: 60000 }, BKT10: { m2: 26000, rate: 2, low: 640, high: 60000 },
  BKT11: { m2: 70000, rate: 2, low: 640, high: 60000 }, BKT12: { m2: 70000, rate: 2, low: 640, high: 60000 },
  BKT13: { m2: 70000, rate: 2, low: 640, high: 60000 }, BKT16: { m2: 26000, rate: 2, low: 640, high: 60000 },
  BKT17: { m2: 26000, rate: 2, low: 640, high: 60000 }, BKT18: { m2: 80000, rate: 2, low: 640, high: 60000 },
}

function bakPaperMaxPrice(cm) {
  if (cm < 100) return 3000; if (cm < 120) return 5000; if (cm < 150) return 8000; if (cm < 200) return 10000
  if (cm < 250) return 12000; if (cm < 300) return 14000; if (cm < 350) return 16000; if (cm < 400) return 25000
  if (cm < 500) return 30000; if (cm < 600) return 35000; return 40000
}
function bakPaperWorkAddPrice(cx, cy, qty) {
  const cm = Math.max(cx, cy)
  if (cm < 100) return 0
  const R34 = 4000, R36 = 5000, R37 = 5000, R39 = 17000, R40 = 17000, R42 = 50000
  const Q34 = 101, Q36 = 170, Q37 = 171, Q39 = 300, Q40 = 301, Q42 = 600
  let p = 0
  if (cm < Q34) p = 0; else if (cm === Q34) p = R34; else if (cm <= 169) p = R34 - ((R34 - R36) / (Q36 - Q34) * (cm - Q34))
  else if (cm === Q36) p = R36; else if (cm === Q37) p = R37; else if (cm <= 299) p = R37 - ((R37 - R39) / (Q39 - Q37) * (cm - Q37))
  else if (cm === Q39) p = R39; else if (cm === Q40) p = R40; else if (cm <= 599) p = R40 - ((R40 - R42) / (Q42 - Q40) * (cm - Q40))
  else if (cm <= Q42) p = R42
  const M8a = (cx * cy) / 5 * qty / 1700
  let M8b = 1
  if (qty >= 3000 && cm >= 120) M8b = (cx * cy) / 3 * qty / 3300 - 10000
  return parseInt(p + M8a - M8b, 10)
}
function bakPriceUnitCnc({ bakType, bakX, bakY, cutX, cutY, paperQty }) {
  const u = MU[bakType]
  const cm = Math.max(cutX, cutY), cmin = Math.min(cutX, cutY)
  const workPrice = (cutX + cutY) / 20 + 11
  const paperMax = bakPaperMaxPrice(cm)
  const paperAdd = bakPaperWorkAddPrice(cutX, cutY, paperQty)
  const bxMax = Math.max(bakX, 30), byMax = Math.max(bakY, 30)
  const sizeExtra = (cm >= 150 || cmin >= 100) ? 2000 : 0
  let film = u.m2 / (u.low * u.high) * (bxMax + 15) * (byMax + 15) * u.rate
  film = Math.round(film * 100) / 100
  let unit = Math.max(workPrice * paperQty + film * paperQty + sizeExtra, paperMax)
  unit += paperAdd + 600
  return unit
}
function bakExtraUnit(cutX, cutY, bakX, bakY, orderCount) {
  const xy = Math.max(Math.max(bakX, 30), Math.max(bakY, 30))
  let eu = 1, em = 3000
  const bands = [[30, 1.04, 3300], [35, 1.08, 3600], [40, 1.12, 3900], [45, 1.16, 4200], [50, 1.20, 4500], [55, 1.24, 4800], [60, 1.28, 6000], [65, 1.32, 6500], [70, 1.36, 8000], [75, 1.40, 1000], [80, 1.40, 1300], [85, 1.40, 14000], [90, 1.40, 15000], [95, 1.40, 18000], [100, 1.40, 20000]]
  if (xy < 30) { eu = 1.0; em = 3000 } else { for (const [lo, u2, m] of bands) { if (xy >= lo) { eu = u2; em = m } } }
  let eu3 = 500, eu4 = 1.1
  if ((cutX === 90 && cutY === 50) || (cutX === 50 && cutY === 90)) { eu3 = 0; eu4 = 1 }
  em = Math.ceil(em * Math.max(orderCount * 0.7, 1) / 100) * 100
  return { extraUnit: eu, extraMin: em, extraUnit3: eu3, extraUnit4: eu4 }
}
function bakDongpanCnc(bakX, bakY, section) {
  if (section === 'BKS20') return 0
  const p1 = Math.max(bakX, 30) * Math.max(bakY, 30) * 1.6 + 1100
  return Math.max(p1, 3000)
}
function bakPriceCnc({ bakType, bakX, bakY, cutX, cutY, paperQty, orderCount, bakSide, bakSection }) {
  let unit = bakPriceUnitCnc({ bakType, bakX, bakY, cutX, cutY, paperQty })
  let dongpan = bakDongpanCnc(bakX, bakY, bakSection)
  unit = unit * orderCount * 1.35
  if (bakSide === 'BKD30') unit *= 2
  const { extraUnit, extraMin, extraUnit3, extraUnit4 } = bakExtraUnit(cutX, cutY, bakX, bakY, orderCount)
  unit = unit * extraUnit4 * extraUnit
  unit = Math.ceil(unit / 100) * 100
  unit = Math.max(unit + extraUnit3, extraMin)
  if (Math.max(cutX, cutY) >= 100) unit = Math.max(unit, 18500)
  dongpan = Math.ceil(dongpan / 100) * 100
  return { bakPrice: unit + dongpan, unit, dongpan }
}

const gt = require('./test-artifacts/omo3534/cnc-groundtruth.json')
for (const c of gt) {
  if (c.bak_amt === '0' || c.bak_section == null) { console.log(`SKIP(${c.input.bak_type} ${c.bak_section}) bak_amt=${c.bak_amt}`); continue }
  const got = bakPriceCnc({
    bakType: c.input.bak_type, bakX: c.input.bak_x, bakY: c.input.bak_y,
    cutX: +c.cut_x_size, cutY: +c.cut_y_size, paperQty: +c.paper_qty,
    orderCount: +c.order_count, bakSide: c.bak_side, bakSection: c.bak_section,
  })
  const ok = got.bakPrice === +c.bak_amt
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.input.bak_type} ${c.input.bak_x}x${c.input.bak_y} oc=${c.order_count} | got=${got.bakPrice} (unit=${got.unit} dongpan=${got.dongpan}) expect=${c.bak_amt}`)
}
