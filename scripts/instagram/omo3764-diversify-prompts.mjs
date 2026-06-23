#!/usr/bin/env node
/**
 * OMO-3772 / OMO-3764 — 프롬프트 다양화(diversify) 패스
 *
 * 보드 피드백(2026-06-23): "그림이 너무 같다. 다른 형태로 변형만 한다. 아예 다채로운
 * 디자인이 들어가게 해서 중복이 없으면 좋겠다(디자인 측면)."
 *
 * 기존 omo3764-gen-photos.mjs는 제품별 SUBJECT 1개 고정 + 배경 10개 i%10 순환이라
 * 같은 제품은 항상 같은 구도, 팔레트(파스텔 peach-lilac)도 반복 → 단조로움.
 *
 * 본 패스: 각 게시물에 (제품별 다중 구도 variant) × (넓은 컬러스토리·씬 풀) ×
 * (다양한 라이팅)을 서로 다른 조합으로 배정해 60장이 시각적으로 전부 달라지게 한다.
 * 결과를 src/data/omo3764-instagram-plan.json의 posts[].photoPrompt에 덮어쓴다.
 *
 * 실행: node scripts/instagram/omo3764-diversify-prompts.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLAN = join(__dirname, '..', '..', 'src', 'data', 'omo3764-instagram-plan.json')

// 제품별 다중 구도(서로 다른 형태/앵글/연출) — 같은 제품이라도 매번 다른 컷
const SUBJECTS = {
  business_cards: [
    'a tall spiral-fanned stack of luxe matte business cards with metallic foil edges',
    'a single business card floating mid-air while others tumble in motion below',
    'an extreme macro close-up of a business card edge revealing crisp foil and paper texture',
    'business cards scattered in an overlapping diagonal cascade across the frame',
    'a hand elegantly holding up one business card toward the light',
    'business cards standing upright in a sleek minimalist acrylic holder',
    'a tidy overhead flat-lay grid of business cards arranged in neat rows',
  ],
  stickers: [
    'a chaotic-cool overlapping pile of glossy die-cut stickers spilling across the frame',
    'a single oversized holographic sticker peeling up to catch a rainbow glint',
    'an overhead flat-lay of stickers arranged in a tidy color-sorted grid',
    'a hand pressing a sticker onto a laptop lid, others fanned nearby',
    'a macro shot of a sticker sheet with kiss-cut outlines and vinyl sheen',
    'stickers stuck playfully across a textured surface at varied angles',
  ],
  flyers: [
    'a crisp flyer held at a dynamic diagonal by manicured fingers',
    'a stack of freshly-printed flyers flat on a surface with the top one curling',
    'a flyer pinned to a textured wall casting a soft shadow',
  ],
  posters: [
    'a large framed poster of bold abstract color-field art leaning against a wall',
    'an unframed rolled poster partially unfurled revealing geometric Bauhaus shapes',
    'a gallery wall of three posters with duotone photographic art',
    'a framed minimal line-art botanical poster propped on a console',
    'a poster of expressive brushstroke abstract art held up by two hands',
    'a poster with retro color-blocked op-art mounted on a clean wall',
  ],
  postcards: [
    'a premium postcard resting on a textured surface beside minimal props',
    'a fan of postcards held in one hand against a bright scene',
  ],
  brochures: [
    'an open tri-fold brochure standing with crisp accordion folds',
    'a closed brochure resting beside a coffee cup in a lifestyle desk scene',
    'an overhead flat-lay of an unfolded brochure showing rich print panels',
  ],
  labels: [
    'a beautifully branded product bottle with a glossy waterproof printed label',
    'a row of jars with matte textured labels lined up with soft reflections',
  ],
  banners: [
    'a sleek roll-up banner standing in a chic modern event space',
    'a fabric hanging banner gently rippling against an architectural wall',
    'a tabletop mini banner styled on a trade-show counter vignette',
  ],
  mixed: [
    'an artful flat-lay of premium printed brand collateral fanned across the frame',
    'a floating exploded-view arrangement of cards, stickers and a flyer mid-air',
    'a styled desk vignette mixing business cards, a brochure and stickers',
    'a hand reaching into a tidy flat-lay of mixed print pieces',
    'an isometric tabletop scene of stacked and standing print collateral',
    'a close-up corner crop of layered print pieces with rich texture',
  ],
}

// 컬러스토리 × 씬(표면/배경) — 넓고 다채롭게. 파스텔 의존 탈피.
const SCENES = [
  'on a glossy chrome and iridescent holographic surface with prismatic light flares',
  'on warm terracotta and cream color-blocked planes, editorial styling',
  'on a deep emerald-green velvet backdrop with dramatic low-key shadows',
  'on a bold cobalt-blue and tangerine duotone set, high-fashion vibe',
  'on polished white carrara marble with green eucalyptus sprigs',
  'in a moody neon-lit dark studio glowing magenta and electric blue',
  'on sunlit natural linen with dappled window light and soft shadows',
  'on a brutalist raw concrete slab with hard directional light',
  'on a vivid primary-color Memphis-style set with playful geometric props',
  'on a jet-black reflective acrylic surface with a single crisp highlight',
  'on warm honey-toned oak wood with golden afternoon light',
  'on a soft sage-green and clay-pink color-blocked paper set with gentle shadows',
  'on a terra-rose and ochre color-blocked paper backdrop',
  'on a cool monochrome greyscale concrete set, minimalist and graphic',
  'on translucent frosted-glass and pastel acrylic shapes, glassy modern',
  'on a rich burgundy and gold art-deco backdrop, luxe and opulent',
  'on a fresh grass-green and lemon-yellow color-pop background',
  'on a soft blush-to-coral gradient with a subtle film-grain Y2K vibe',
  'on crumpled metallic silver foil catching cool studio light',
  'on a lavender-and-mint dual-tone set with long sculptural shadows',
  'on a glossy aqua-and-teal acrylic surface with crisp reflections',
  'on a bold coral-to-magenta color-blocked backdrop with retro glow',
  'on a clean cyber-lime and purple gradient with futuristic sheen',
  'on a cozy oatmeal boucle fabric with warm tactile shadows',
]

// 라이팅/무드 — 다양한 분위기
const LIGHTS = [
  'shot on 85mm f1.8, shallow depth of field, soft diffused studio light',
  'golden-hour window light with creamy bokeh and warm highlights',
  'high-key bright softbox lighting with crisp clean shadows',
  'cinematic low-key side light with rich contrast and editorial mood',
  'hard flash editorial lighting with punchy saturated colors',
  'gel-colored dual-tone lighting casting playful colored shadows',
  'gentle overcast daylight, airy and natural and true-to-color',
  'dramatic crisp spotlight with deep falloff and clean rectangular shadows',
]

// 제품에 인쇄된 '디자인 모티프' — GPT가 포스터/배너 등에 항상 같은 'sunset arch'를
// 디폴트로 넣는 중복을 깨기 위해 인스턴스마다 다른 추상 아트(텍스트 없는)를 지정
const DESIGN_MOTIFS = [
  'bold abstract color-field blocks',
  'geometric Bauhaus shapes',
  'flowing liquid-marble swirls',
  'a minimal single continuous-line drawing',
  'retro 70s color-blocked waves',
  'organic botanical leaf silhouettes',
  'soft gradient-mesh blobs',
  'op-art concentric circles',
  'Memphis-style confetti shapes',
  'duotone halftone texture',
  'expressive paint-splatter brushwork',
  'angular art-deco stepped-chevron lattice (no fans, no rays)',
  'iridescent holographic gradient',
  'pixelated glitch-art blocks',
  'hand-drawn doodle icons',
  'bold checkerboard pattern',
]

const SUFFIX =
  'photorealistic, ultra-detailed, professional product photography, trendy and hip Gen-Z aesthetic, distinctive and unique composition (not generic stock), vibrant and visually varied, social-media ready, perfectly square 1:1 composition, no text, no watermark, no logos. ' +
  'ABSOLUTELY NO landscape or celestial imagery ANYWHERE in the frame — not on the products, not in the background, not as props: no mountains, no ocean/water/pools/waves, no sun, no moon, no sunburst, no starburst, no radiating sun-rays, no glowing halo disc, no concentric ring that reads as a sun or moon, no sunset/sunrise, no horizon, no rainbow arch, no nature vista. Every printed design and every surface is strictly abstract geometric/graphic only'

// 서로소(coprime) stride로 축을 독립 분산 → 조합 중복 최소화
function build(posts) {
  const productSeen = {}
  posts.forEach((post, i) => {
    const prod = SUBJECTS[post.product] ? post.product : 'mixed'
    const inst = (productSeen[prod] = (productSeen[prod] ?? -1) + 1)
    const subjArr = SUBJECTS[prod]
    const subject = subjArr[inst % subjArr.length]
    const scene = SCENES[(i * 7 + inst * 3) % SCENES.length]
    const light = LIGHTS[(i * 5 + inst) % LIGHTS.length]
    const motif = DESIGN_MOTIFS[(i * 11 + inst * 5) % DESIGN_MOTIFS.length]
    post.photoPrompt = `${subject}, its printed design featuring ${motif} (purely graphic, no text), ${scene}, ${light}. ${SUFFIX}`
  })
}

const plan = JSON.parse(await readFile(PLAN, 'utf8'))
build(plan.posts)
plan._promptVariant = 'diversified-v2-omo3772'
await writeFile(PLAN, JSON.stringify(plan, null, 2) + '\n')

// 다양성 점검: 구도/씬 분포 출력
const comps = {}, scenes = {}
plan.posts.forEach(p => {
  const c = p.photoPrompt.split(',')[0]; comps[c] = (comps[c] || 0) + 1
})
console.log(`[diversify] ${plan.posts.length} prompts rewritten.`)
console.log(`unique opening compositions: ${Object.keys(comps).length}`)
console.log(`sample:\n- ${plan.posts[0].photoPrompt}\n- ${plan.posts[10].photoPrompt}\n- ${plan.posts[30].photoPrompt}`)
