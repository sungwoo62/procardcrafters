#!/usr/bin/env node
/**
 * OMO-3764 — 30일 인스타 콘텐츠 플랜 생성기 (하루 2건 × 30일 = 60건)
 *
 * 보드 요청("게시물 어떻게 할건지 60개 뽑아서 웹에 보고"): 60개 초안을 단일
 * 진실원천 JSON으로 생성 → 웹 리포트(/reports/omo-3764-instagram)가 import.
 * 모든 초안 status="draft". 정책: 전화번호·내부 수량임계값 미노출, 가짜 후기 금지(OMO-2760).
 *
 * 실행: node scripts/instagram/omo3764-gen-content.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', 'src', 'data', 'omo3764-instagram-plan.json')

const COMMON_TAGS = ['#printondemand', '#procardcrafters', '#customprinting']
const TAGS = {
  business_cards: ['#businesscards', '#branding', '#smallbusiness', '#networking', '#entrepreneur', '#design'],
  stickers: ['#stickers', '#stickershop', '#diecutstickers', '#holographic', '#branding', '#smallbusiness'],
  flyers: ['#flyers', '#flyerdesign', '#marketing', '#smallbusiness', '#promo', '#printdesign'],
  posters: ['#posters', '#wallart', '#posterdesign', '#largeformat', '#printart', '#decor'],
  postcards: ['#postcards', '#directmail', '#marketing', '#snailmail', '#branding'],
  brochures: ['#brochure', '#trifold', '#marketing', '#branding', '#smallbusiness'],
  labels: ['#labels', '#productlabels', '#packaging', '#branding', '#smallbusiness'],
  banners: ['#banners', '#signage', '#tradeshow', '#events', '#largeformat'],
  mixed: ['#print', '#branding', '#smallbusiness', '#marketing', '#design'],
}

// pillar별 초안. 각 항목: { pillar, product, caption, firstComment, imageDirection }
// 60개 = spotlight 20 + usecase 14 + education 10 + quality 8 + offer 5 + engagement 3
const POOL = [
  // ── PRODUCT SPOTLIGHT (20) ──────────────────────────────────────────
  { pillar: 'product_spotlight', product: 'business_cards', caption: 'Soft-touch matte that feels as premium as it looks. 🖤\n\nA velvety finish that makes bold ink pop and turns a quick handoff into a moment people remember.', firstComment: '✨ Configure yours and see the exact price in seconds — link in bio.', imageDirection: '소프트터치 매트 명함 클로즈업, 손가락이 표면 질감을 만지는 매크로 샷, 측광.' },
  { pillar: 'product_spotlight', product: 'business_cards', caption: 'Real metallic foil. Real first impression. ✨\n\nGold, silver, or rose foil pressed into premium stock — the kind of card people keep instead of toss.', firstComment: '🔗 Build your foil card and price it instantly — link in bio.', imageDirection: '골드 포일 디테일이 빛에 반사되는 45도 샷, 어두운 무드 배경.' },
  { pillar: 'product_spotlight', product: 'business_cards', caption: 'Spot UV: gloss where it matters, matte everywhere else. 🪞\n\nLogo that catches the light, background that stays understated. Subtle, tactile, unforgettable.', firstComment: '🔗 Try spot UV in the configurator — link in bio.', imageDirection: '매트 바탕에 스팟 UV 로고가 반짝이는 라이트 리플렉션 샷.' },
  { pillar: 'product_spotlight', product: 'business_cards', caption: 'Double-thick 32pt cards with a weight you can feel. 💪\n\nSome cards bend. These make a statement the second they hit your hand.', firstComment: '🔗 Pick your thickness — link in bio.', imageDirection: '두꺼운 명함 측면(엣지) 스택 매크로, 두께 강조.' },
  { pillar: 'product_spotlight', product: 'business_cards', caption: 'Rounded corners, softer impression. 🟦\n\nA small detail that makes your card look custom — and feel modern.', firstComment: '🔗 Round your corners in seconds — link in bio.', imageDirection: '라운드 코너 명함 페어, 깔끔한 파스텔 배경.' },
  { pillar: 'product_spotlight', product: 'stickers', caption: 'Holographic stickers that shift with the light. 🌈\n\nRainbow shimmer on a mirror-like film — the upgrade your branding has been waiting for.', firstComment: '🔗 Make holographic stickers — link in bio.', imageDirection: '홀로그래픽 스티커가 빛에 무지개로 변하는 클로즈업.' },
  { pillar: 'product_spotlight', product: 'stickers', caption: 'Die-cut to the exact shape of your design. ✂️\n\nNo borders, no boxes — just your logo, cut clean.', firstComment: '🔗 Upload art and we cut to shape — link in bio.', imageDirection: '로고 외곽선대로 컷된 다이컷 스티커 여러 개, 화이트 배경.' },
  { pillar: 'product_spotlight', product: 'stickers', caption: 'Clear stickers for that "printed right on it" look. 🫧\n\nTransparent film disappears so your design floats on glass, laptops, and packaging.', firstComment: '🔗 Try clear stickers — link in bio.', imageDirection: '투명 스티커가 노트북에 붙은 모습, 배경이 비치는 샷.' },
  { pillar: 'product_spotlight', product: 'stickers', caption: 'Kiss-cut sheets: a whole sticker set, one peel at a time. 📄\n\nPerfect for packs, inserts, and unboxing surprises.', firstComment: '🔗 Build a sticker sheet — link in bio.', imageDirection: '키스컷 스티커 시트 한 장, 여러 디자인 배열.' },
  { pillar: 'product_spotlight', product: 'stickers', caption: 'Matte vinyl stickers — waterproof, scratch-proof, sunlight-proof. ☔️\n\nStick them on bottles, bumpers, and laptops and they hold up.', firstComment: '🔗 Order durable vinyl — link in bio.', imageDirection: '물방울 맺힌 매트 비닐 스티커, 야외 질감.' },
  { pillar: 'product_spotlight', product: 'flyers', caption: 'High-gloss flyers that make color punch. 🎨\n\nVivid, shiny, and impossible to scroll past on a counter.', firstComment: '🔗 Print gloss flyers — link in bio.', imageDirection: '광택 플라이어 스택, 컬러 채도 강조 샷.' },
  { pillar: 'product_spotlight', product: 'flyers', caption: 'Silk matte flyers: smooth touch, zero glare. 🤍\n\nEasy to read under any light, premium in any hand.', firstComment: '🔗 Try silk matte — link in bio.', imageDirection: '실크 매트 플라이어를 손에 든 미니멀 샷.' },
  { pillar: 'product_spotlight', product: 'brochures', caption: 'Tri-fold brochures that tell the whole story. 📖\n\nSix panels to walk a customer from "what is this?" to "where do I buy?"', firstComment: '🔗 Build a tri-fold — link in bio.', imageDirection: '삼단 접지 브로슈어 펼친 모습, 패널 구조 보이게.' },
  { pillar: 'product_spotlight', product: 'posters', caption: 'Museum-grade matte fine-art posters. 🖼️\n\nDeep blacks, no glare, gallery feel — for art you actually want on the wall.', firstComment: '🔗 Print fine-art — link in bio.', imageDirection: '매트 파인아트 포스터 벽 설치, 갤러리 무드.' },
  { pillar: 'product_spotlight', product: 'posters', caption: 'Go big: large-format posters that own the room. 📐\n\nFrom A2 to wall-size, crisp at every scale.', firstComment: '🔗 Size up your poster — link in bio.', imageDirection: '대형 포스터 옆에 사람 실루엣으로 스케일 강조.' },
  { pillar: 'product_spotlight', product: 'posters', caption: 'Glossy photo posters with color that sings. 🌅\n\nFor photographers and brands who refuse to compromise on punch.', firstComment: '🔗 Print photo posters — link in bio.', imageDirection: '광택 포토 포스터, 일몰 이미지로 채도 강조.' },
  { pillar: 'product_spotlight', product: 'postcards', caption: 'Postcards that land in a mailbox and stay on a fridge. 💌\n\nThick stock, vivid print, a CTA people actually keep.', firstComment: '🔗 Design a postcard — link in bio.', imageDirection: '냉장고에 자석으로 붙은 포스트카드 라이프스타일 샷.' },
  { pillar: 'product_spotlight', product: 'labels', caption: 'Product labels that survive the fridge, the freezer, the rain. 🏷️\n\nWaterproof stock + sharp print = packaging that looks pro on every shelf.', firstComment: '🔗 Print product labels — link in bio.', imageDirection: '제품 병에 붙은 방수 라벨, 물기 있는 표면.' },
  { pillar: 'product_spotlight', product: 'posters', caption: 'Foamboard signage: lightweight, rigid, ready to display. 🪧', firstComment: '🔗 Order foamboard — link in bio.', imageDirection: '폼보드 사이니지를 이젤에 세운 행사 부스 샷.' },
  { pillar: 'product_spotlight', product: 'banners', caption: 'Roll-up banners that set up in seconds and travel anywhere. 🎪\n\nYour booth, your brand, head-height and impossible to miss.', firstComment: '🔗 Build a roll-up — link in bio.', imageDirection: '롤업 배너가 전시 부스 앞에 세워진 샷.' },

  // ── USE-CASE / AUDIENCE (14) ────────────────────────────────────────
  { pillar: 'use_case', product: 'business_cards', caption: 'Real estate agents: your card is the listing before the listing. 🏡\n\nFoil cards + matching postcards keep you top-of-mind long after the open house.', firstComment: '🔗 Build your realtor set — link in bio.', imageDirection: '부동산 중개사 명함 + 포스트카드 세트 플랫레이.' },
  { pillar: 'use_case', product: 'posters', caption: 'Photographers: sell the print, not just the file. 📸\n\nFine-art posters + premium cards turn a shoot into a product line.', firstComment: '🔗 Print your portfolio — link in bio.', imageDirection: '사진작가 작품 포스터 + 명함 디스플레이.' },
  { pillar: 'use_case', product: 'flyers', caption: 'Cafés & restaurants: today\'s special, printed to crave. ☕️\n\nGloss menu flyers + loyalty cards that keep regulars coming back.', firstComment: '🔗 Print your menu — link in bio.', imageDirection: '카페 카운터의 메뉴 플라이어 + 적립 카드.' },
  { pillar: 'use_case', product: 'labels', caption: 'Etsy & e-commerce shops: branding that survives shipping. 📦\n\nProduct labels + thank-you cards that make unboxing feel like a gift.', firstComment: '🔗 Brand your packaging — link in bio.', imageDirection: '이커머스 포장 박스 + 라벨 + 땡스카드 언박싱 샷.' },
  { pillar: 'use_case', product: 'posters', caption: 'Musicians & bands: posters that fill the room before you play. 🎸\n\nGig posters + sticker packs your fans actually want.', firstComment: '🔗 Print your show — link in bio.', imageDirection: '밴드 공연 포스터 벽 + 스티커 팩.' },
  { pillar: 'use_case', product: 'brochures', caption: 'Startups: walk into demo day with something they keep. 🚀\n\nClean brochures + premium cards that make a seed-stage team look series-A.', firstComment: '🔗 Build your pitch set — link in bio.', imageDirection: '스타트업 데모데이 브로슈어 + 명함.' },
  { pillar: 'use_case', product: 'business_cards', caption: 'Freelancers: one perfect card does the networking for you. ✍️\n\nMinimal, heavy stock, unmistakably you.', firstComment: '🔗 Design your card — link in bio.', imageDirection: '미니멀 프리랜서 명함 단독 샷, 데스크 무드.' },
  { pillar: 'use_case', product: 'posters', caption: 'Salons & spas: a calmer space starts on the wall. 💆\n\nService posters + appointment cards that match your vibe.', firstComment: '🔗 Print for your studio — link in bio.', imageDirection: '살롱 인테리어 포스터 + 예약 카드.' },
  { pillar: 'use_case', product: 'banners', caption: 'Event planners: signage that makes the day run itself. 🎉\n\nBanners, foamboard, and directional signs in one cohesive look.', firstComment: '🔗 Plan your signage — link in bio.', imageDirection: '이벤트장 배너 + 폼보드 안내판 세트.' },
  { pillar: 'use_case', product: 'postcards', caption: 'Nonprofits: a postcard that turns a story into a donation. 🤝\n\nWarm print, clear ask, real impact in a mailbox.', firstComment: '🔗 Print your campaign — link in bio.', imageDirection: '비영리 캠페인 포스트카드 따뜻한 톤.' },
  { pillar: 'use_case', product: 'banners', caption: 'Food trucks: be seen from across the lot. 🚚\n\nVinyl banners + menu boards built for sun, wind, and lunch rushes.', firstComment: '🔗 Wrap your truck story — link in bio.', imageDirection: '푸드트럭 비닐 배너 + 메뉴보드.' },
  { pillar: 'use_case', product: 'posters', caption: 'Open house this weekend? Foamboard signs do the directing. 🪧\n\nYard-ready, weather-tough, brand-consistent.', firstComment: '🔗 Print open-house signs — link in bio.', imageDirection: '오픈하우스 폼보드 안내판 야외 설치.' },
  { pillar: 'use_case', product: 'brochures', caption: 'Trade show booth? Travel light, look heavy. 🧳\n\nRoll-up banners + brochures that pack flat and present big.', firstComment: '🔗 Build your booth kit — link in bio.', imageDirection: '전시부스 롤업 + 브로슈어 진열.' },
  { pillar: 'use_case', product: 'stickers', caption: 'Creators: sticker packs are the merch that markets itself. 🎨\n\nEvery laptop they land on is a tiny billboard for your brand.', firstComment: '🔗 Make a sticker pack — link in bio.', imageDirection: '크리에이터 스티커 팩, 노트북에 붙인 컬렉션.' },

  // ── MATERIAL / FINISH EDUCATION (10) ────────────────────────────────
  { pillar: 'education', product: 'mixed', caption: 'Matte vs gloss — which finish is right for you? 🤔\n\nMatte = smooth, glare-free, easy to write on. Gloss = vivid color, extra pop. Save this for your next order.', firstComment: '🔗 Compare finishes in the configurator — link in bio.', imageDirection: '매트 vs 광택 비교 분할 화면.' },
  { pillar: 'education', product: 'business_cards', caption: 'What is Spot UV? ✨\n\nA clear gloss layer printed only on chosen areas — your logo shines while the rest stays matte. Tactile, premium, subtle.', firstComment: '🔗 See spot UV examples — link in bio.', imageDirection: '스팟 UV 도해, 코팅 영역 하이라이트.' },
  { pillar: 'education', product: 'business_cards', caption: 'Why "soft-touch"? 🖐️\n\nA fine matte laminate that feels like suede. It resists fingerprints and instantly reads as premium.', firstComment: '🔗 Feel the difference — order a sample-grade card. Link in bio.', imageDirection: '소프트터치 질감 매크로.' },
  { pillar: 'education', product: 'stickers', caption: 'Die-cut vs kiss-cut — what\'s the difference? ✂️\n\nDie-cut = cut all the way through to your shape. Kiss-cut = top layer only, easy peel on a backing sheet.', firstComment: '🔗 Pick your cut — link in bio.', imageDirection: '다이컷 vs 키스컷 단면 도해.' },
  { pillar: 'education', product: 'mixed', caption: 'Paper weight, explained. 📏\n\nHigher GSM = thicker, sturdier, more premium feel. We\'ll show the weight options right in the configurator.', firstComment: '🔗 Choose your stock — link in bio.', imageDirection: 'GSM별 종이 두께 비교 스택.' },
  { pillar: 'education', product: 'business_cards', caption: 'When should you use foil? 🥇\n\nFoil shines for logos, monograms, and luxury brands. Pair it with matte stock for maximum contrast.', firstComment: '🔗 Add foil — link in bio.', imageDirection: '포일 적용 전후 비교.' },
  { pillar: 'education', product: 'mixed', caption: 'CMYK vs Pantone — quick designer cheat sheet. 🎯\n\nCMYK covers most full-color art; Pantone locks an exact brand color. Set it before you print.', firstComment: '🔗 Upload print-ready art — link in bio.', imageDirection: 'CMYK/Pantone 색상 칩 비교.' },
  { pillar: 'education', product: 'mixed', caption: 'Bleed & safe area in 10 seconds. 🩸\n\nExtend art past the trim (bleed) and keep text inside the safe zone so nothing gets cut. We flag it for you.', firstComment: '🔗 See our templates — link in bio.', imageDirection: '재단선/안전선 가이드 도해.' },
  { pillar: 'education', product: 'stickers', caption: 'How tough are vinyl stickers, really? 💧\n\nWaterproof, UV-resistant, and dishwasher-brave. Built for bottles, cars, and the outdoors.', firstComment: '🔗 Order vinyl — link in bio.', imageDirection: '비닐 스티커 내수성 테스트 샷.' },
  { pillar: 'education', product: 'posters', caption: 'Matte, satin, or gloss poster paper? 🖼️\n\nMatte for art & text, satin for balanced photos, gloss for maximum color punch.', firstComment: '🔗 Choose your poster paper — link in bio.', imageDirection: '세 가지 포스터 용지 질감 비교.' },

  // ── QUALITY / BEHIND-THE-SCENES (8) ─────────────────────────────────
  { pillar: 'quality', product: 'mixed', caption: 'Printed at certified global facilities. 🌍\n\nThe same presses trusted by major brands — so your small order looks anything but small.', firstComment: '🔗 Start your order — link in bio.', imageDirection: '인쇄 설비 라인 비하인드 샷.' },
  { pillar: 'quality', product: 'mixed', caption: 'Delivered worldwide via FedEx. ✈️\n\nTracked from press to porch, wherever you are.', firstComment: '🔗 See delivery options — link in bio.', imageDirection: 'FedEx 패키지 배송 라이프스타일 샷.' },
  { pillar: 'quality', product: 'mixed', caption: 'Color you can trust, before you commit. 🎨\n\nWe sweat the proofing so the print matches the screen.', firstComment: '🔗 Configure with confidence — link in bio.', imageDirection: '컬러 프루핑/색교정 클로즈업.' },
  { pillar: 'quality', product: 'mixed', caption: 'Printing greener: recycled stock options. ♻️\n\nPremium feel, lighter footprint — for brands that care about both.', firstComment: '🔗 Choose recycled stock — link in bio.', imageDirection: '재생용지 질감 + 친환경 무드.' },
  { pillar: 'quality', product: 'mixed', caption: 'Your exact price, in seconds. ⏱️\n\nNo "request a quote" runaround. Configure, see USD, decide.', firstComment: '🔗 Price it now — link in bio.', imageDirection: '컨피규레이터 가격 표시 UI 스크린.' },
  { pillar: 'quality', product: 'mixed', caption: 'From cart to crafted — fast turnaround. ⚡️\n\nYour print moves the moment you approve it.', firstComment: '🔗 Start now — link in bio.', imageDirection: '주문→생산 타임라인 그래픽.' },
  { pillar: 'quality', product: 'mixed', caption: 'Packed to arrive flawless. 📦\n\nRigid mailers and corner care so your cards land crisp, not creased.', firstComment: '🔗 Order with care — link in bio.', imageDirection: '보호 포장 언박싱 샷.' },
  { pillar: 'quality', product: 'mixed', caption: 'See your design come to life before you buy. 👀\n\nConfigure finishes, sizes, and quantities and watch the price update live.', firstComment: '🔗 Try the configurator — link in bio.', imageDirection: '실시간 컨피규레이터 데모 화면.' },

  // ── OFFER / CTA (5) ─────────────────────────────────────────────────
  { pillar: 'offer', product: 'business_cards', caption: 'Your next great card is a few clicks away. 👆\n\nConfigure, price in USD, and ship worldwide — all in one place.', firstComment: '🔗 Start your card — link in bio.', imageDirection: '명함 컨피규레이터 콜투액션 그래픽.' },
  { pillar: 'offer', product: 'mixed', caption: 'New here? Start with one product and see how easy print can be. 🌟\n\nClear pricing, premium finishes, global delivery.', firstComment: '🔗 Begin your first order — link in bio.', imageDirection: '신규 고객 환영 브랜드 그래픽.' },
  { pillar: 'offer', product: 'mixed', caption: 'Loved your last batch? Reordering takes seconds. 🔁\n\nSame specs, same quality, fresh stack.', firstComment: '🔗 Reorder now — link in bio.', imageDirection: '재주문 플로우 UI.' },
  { pillar: 'offer', product: 'mixed', caption: 'Launching something? Pair cards + stickers for a cohesive drop. 🚀\n\nOne brand, two touchpoints, zero mismatch.', firstComment: '🔗 Build your launch set — link in bio.', imageDirection: '런칭 세트: 명함 + 스티커 플랫레이.' },
  { pillar: 'offer', product: 'mixed', caption: 'Everything you print, in one bio link. 🔗\n\nCards, stickers, flyers, posters — configure any of them today.', firstComment: '🔗 Explore all products — link in bio.', imageDirection: '전 제품 라인업 그리드 그래픽.' },

  // ── ENGAGEMENT (3) ──────────────────────────────────────────────────
  { pillar: 'engagement', product: 'mixed', caption: 'Matte or gloss — what\'s your finish? 🗳️\n\nDrop your pick in the comments. We\'re settling this once and for all. 👇', firstComment: 'Matte gang or gloss gang? 🤍✨', imageDirection: '매트 vs 광택 투표 그래픽.' },
  { pillar: 'engagement', product: 'mixed', caption: 'What are you printing next? 👀\n\nCards, stickers, a poster for the wall? Tell us in the comments and we\'ll share a tip. 👇', firstComment: 'Reply below — we read every one. 💬', imageDirection: '질문형 그래픽, 제품 아이콘 배열.' },
  { pillar: 'engagement', product: 'mixed', caption: 'Before you hit "order," run this 3-point check. ✅\n\n1) Bleed extended? 2) Text in the safe zone? 3) Colors in CMYK? Save this. 🔖', firstComment: '🔗 Grab our print-ready templates — link in bio.', imageDirection: '주문 전 체크리스트 인포그래픽.' },
]

// pillar당 표시 라벨
const PILLAR_LABEL = {
  product_spotlight: 'Product Spotlight',
  use_case: 'Use-Case / Audience',
  education: 'Material & Finish Education',
  quality: 'Quality / Behind-the-Scenes',
  offer: 'Offer / CTA',
  engagement: 'Engagement',
}

function tagsFor(product) {
  const base = TAGS[product] || TAGS.mixed
  return [...base, ...COMMON_TAGS]
}

// 30일 × 2슬롯. 두 슬롯의 필러가 같지 않도록 POOL을 그대로(이미 다양 분포) 순차 배치하되,
// 인접 중복 최소화를 위해 전반부/후반부 인터리브.
function schedule(pool) {
  const half = Math.ceil(pool.length / 2)
  const a = pool.slice(0, half)   // 09:00 슬롯 후보
  const b = pool.slice(half)      // 18:00 슬롯 후보
  const posts = []
  for (let day = 0; day < 30; day++) {
    const am = a[day]
    const pm = b[day]
    if (am) posts.push({ ...am, day: day + 1, slot: 'AM', timeET: '09:00' })
    if (pm) posts.push({ ...pm, day: day + 1, slot: 'PM', timeET: '18:00' })
  }
  return posts
}

const scheduled = schedule(POOL)
const posts = scheduled.map((p, i) => ({
  id: `omo3764-${String(i + 1).padStart(3, '0')}`,
  status: 'draft',
  day: p.day,
  slot: p.slot,
  timeET: p.timeET,
  pillar: p.pillar,
  pillarLabel: PILLAR_LABEL[p.pillar],
  product: p.product,
  caption: p.caption,
  hashtags: tagsFor(p.product),
  firstComment: p.firstComment,
  imageDirection: p.imageDirection,
  imageUrl: '',
  altText: p.caption.split('\n')[0].replace(/[\u{1F000}-\u{1FFFF}☀-➿]/gu, '').trim(),
}))

const out = {
  _comment: 'OMO-3764 인스타 30일 콘텐츠 플랜(2건/일 × 30일 = 60건). 단일 진실원천 — 웹 리포트(/reports/omo-3764-instagram) + 발행기(omo3764-ig-publish.mjs)가 함께 읽음. 모든 항목 draft, 보드 승인 후 approved→published. 가짜 후기·내부 임계값 금지(OMO-2760).',
  schemaVersion: 2,
  generatedFor: 'OMO-3764',
  cadence: '2 posts/day for 30 days = 60 posts (09:00 / 18:00 ET)',
  pillarMix: Object.fromEntries(Object.keys(PILLAR_LABEL).map(k => [k, posts.filter(p => p.pillar === k).length])),
  posts,
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`[OMO-3764] ${posts.length}개 게시물 생성 → ${OUT}`)
console.log('필러 분포:', out.pillarMix)
