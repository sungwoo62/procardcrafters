// OMO-3196 (보드 재요청): 미국 고객이 못 알아보는 한글 음역 지종명(띤또레또/아르미울트라/
// 랑데뷰 등) 대신 US-친화 영문명 + 짧은 특징 2~3개를 드롭다운/팝업에 노출한다.
// 라이브 성원 데이터라 용지 코드가 가변 → 라벨(한/영) 키워드로 매칭한다.

export interface PaperDisplay {
  /** 미국 고객용 영문 표시명(브랜드는 보조로 괄호). */
  name: string
  /** 드롭다운에 이름 옆에 붙일 짧은 특징 2~3개. */
  features: string[]
  /** 팝업 설명문. */
  desc: string
}

// OMO-3195: img = 재질 샘플 사진의 패밀리 슬러그(paper-images.ts / 생성 스크립트와 일치).
const TABLE: { match: RegExp; name: string; features: string[]; desc: string; img: string }[] = [
  // 코트지 계열
  { match: /스노우|snow/i, name: 'Matte Coated', features: ['Matte', 'Smooth', 'No glare'], desc: 'Smooth matte coated stock with a clean, glare-free surface — a versatile, popular choice.', img: 'matte-coated' },
  { match: /아트지|아트\b|art\s?paper|gloss/i, name: 'Glossy Coated', features: ['Glossy', 'Vivid color', 'Smooth'], desc: 'Glossy coated paper that makes color pop — crisp, vivid print on a smooth surface.', img: 'glossy-coated' },
  { match: /몽블랑|랑데뷰|rendez/i, name: 'Rendezvous (premium uncoated)', features: ['Uncoated', 'Natural texture', 'Designer pick'], desc: 'Premium uncoated stock with a smooth natural surface and superb ink hold — a designer favorite.', img: 'rendezvous' },
  { match: /반누보|nouveau/i, name: 'Vent Nouveau (soft uncoated)', features: ['Uncoated', 'Soft texture', 'Warm white'], desc: 'Soft, refined uncoated paper with a delicate texture and warm white tone — elegant and tactile.', img: 'vent-nouveau' },
  { match: /스타드림|stardream/i, name: 'Stardream Pearl', features: ['Pearlescent', 'Shimmer', 'Luxury'], desc: 'Pearlescent metallic stock with a shimmer that shifts in the light — luxurious and eye-catching.', img: 'stardream' },
  { match: /마제스틱|majestic/i, name: 'Majestic Pearl', features: ['Pearl', 'Metallic', 'Luxury'], desc: 'Luxury pearl-metallic stock with a subtle sheen — a premium feel for high-end cards.', img: 'majestic' },
  { match: /띤또레또|틴토레토|tintoretto/i, name: 'Felt-Textured Art Stock', features: ['Felt texture', 'Premium', 'Uncoated'], desc: 'Heavy felt-textured art stock (Tintoretto) with a tactile premium surface — distinctive and refined.', img: 'felt-art' },
  { match: /아르미|아르떼|arte|armi/i, name: 'Ultra-Smooth Premium', features: ['Ultra-smooth', 'Bright white', 'Premium'], desc: 'Ultra-smooth bright-white premium stock with a clean, modern feel and excellent print sharpness.', img: 'ultra-smooth' },
  { match: /큐리어스|curious/i, name: 'Metallic Specialty', features: ['Metallic', 'Specialty', 'Shimmer'], desc: 'Specialty metallic stock with a distinctive modern finish that catches the light.', img: 'metallic-specialty' },
  { match: /린넨|리넨|linen/i, name: 'Linen Texture', features: ['Woven texture', 'Classic', 'Premium'], desc: 'Linen-embossed stock with a woven, cloth-like texture — classic and sophisticated.', img: 'linen' },
  { match: /펄지|펄|pearl/i, name: 'Pearlescent', features: ['Shimmer', 'Coated', 'Premium'], desc: 'Pearlescent coated stock with a soft shimmer that adds a premium glow to your design.', img: 'pearlescent' },
  { match: /크라프트|kraft/i, name: 'Kraft (natural brown)', features: ['Natural', 'Eco', 'Writable'], desc: 'Natural brown kraft stock with a rustic, eco feel — uncoated and easy to write on.', img: 'kraft' },
  { match: /유포|yupo/i, name: 'Synthetic (waterproof)', features: ['Waterproof', 'Tear-proof', 'Synthetic'], desc: 'Waterproof synthetic (Yupo) film — tear- and water-resistant, slightly translucent.', img: 'synthetic-film' },
  { match: /모조|우드프리|woodfree/i, name: 'Uncoated Woodfree', features: ['Uncoated', 'Writable', 'Economical'], desc: 'Uncoated woodfree paper with a natural matte surface — easy to write on and economical.', img: 'woodfree' },
  { match: /코튼|cotton/i, name: 'Cotton', features: ['Soft texture', 'Uncoated', 'Premium'], desc: 'Natural cotton stock with a soft tactile texture — uncoated and luxurious.', img: 'cotton' },
  { match: /현수막|배너|banner|pvc/i, name: 'PVC Banner', features: ['Durable', 'Outdoor', 'Waterproof'], desc: 'Durable PVC banner material for indoor and outdoor display.', img: 'pvc-banner' },
]

export function paperDisplay(label: string): PaperDisplay | null {
  const weight = label.match(/(\d{2,3})\s*g/i)?.[1]
  for (const t of TABLE) {
    if (t.match.test(label)) {
      return {
        name: weight ? `${t.name} ${weight}gsm` : t.name,
        features: t.features,
        desc: weight ? `${t.desc} (${weight}gsm)` : t.desc,
      }
    }
  }
  if (weight) {
    return {
      name: label.trim(),
      features: [`${weight}gsm`, 'Premium'],
      desc: `Premium specialty card stock — ${weight}gsm, substantial in hand.`,
    }
  }
  return null
}

/**
 * OMO-3195: 라벨로 재질 샘플 사진의 패밀리 슬러그를 매칭한다(없으면 null → SVG 폴백).
 * gsm 만 다른 코드는 같은 패밀리 사진을 공유한다.
 */
export function paperImageKey(label: string): string | null {
  for (const t of TABLE) {
    if (t.match.test(label)) return t.img
  }
  return null
}
