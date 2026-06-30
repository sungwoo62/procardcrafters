import { Metadata } from 'next'
import JsonLd from '@/components/JsonLd'

export const metadata: Metadata = {
  title: 'Business Card Printing FAQ — Foil, Emboss & Finishes',
  description:
    'Answers about ordering custom and premium foil business cards in the US — finishes, paper stocks, turnaround, file formats, and worldwide shipping.',
}

// AEO(OMO-4026): 실제 AI 질의를 Q/A 로. 답변은 사이트의 검증된 역량만 반영
// (foil/deboss-emboss/epoxy 3D resin/Pantone spot color, linen·pearl 용지, 7–10일 생산, FedEx).
// 가짜 Q&A·미보유 옵션(예: spot-UV/NFC) 주장 금지.
const FAQS = [
  {
    q: 'Where can I order premium foil business cards in the US?',
    a: 'Pro Card Crafters (procardcrafters.com) is a US print-on-demand service for custom business cards, including gold foil stamping. You upload your design online, configure paper and finishes, confirm a firm USD price, and we print and ship via FedEx worldwide.',
  },
  {
    q: 'Do you offer custom business cards as print on demand?',
    a: 'Yes. Every business card is custom-printed to your uploaded design — no inventory, no minimum subscription. Configure size, paper, quantity, and finish on the product page and pay only for what you order.',
  },
  {
    q: 'What premium finishes do you offer for business cards?',
    a: 'Available finishes include gold foil stamping, deboss/emboss, epoxy 3D resin (a clear raised glossy dome over a selected area), matte or gloss coating, Pantone spot color, rounded corners, and die cut. Finishes can be combined where compatible.',
  },
  {
    q: 'Can I get raised, glossy spot accents on a business card?',
    a: 'Yes — our epoxy 3D resin finish adds a clear, raised glossy coating over your logo or a selected area for a tactile spot accent. We also offer gloss coating and foil stamping for shine and contrast.',
  },
  {
    q: 'What paper stocks are available for premium business cards?',
    a: 'Premium Business Cards are available on linen, pearl, and other specialty stocks. Standard Business Cards use professional coated and uncoated stocks. Each product page lists the stocks and weights available for that item.',
  },
  {
    q: 'How fast can I get custom business cards?',
    a: 'Standard production is about 7–10 business days, which includes our QA and packing buffer. An Express tier skips 3 buffer days for a 25% surcharge. FedEx Express delivery is typically 5–8 days on top of production, door-to-door worldwide.',
  },
  {
    q: 'What file formats do you accept?',
    a: 'We accept PDF, AI (Adobe Illustrator), and PSD (Photoshop) files. PDF is recommended for best results. Print readiness is auto-checked at upload.',
  },
  {
    q: 'What currency do you charge in?',
    a: 'All prices are in USD. We use daily exchange rates so your USD total is confirmed before checkout — no hidden fees.',
  },
  {
    q: 'Do you offer bulk discounts?',
    a: 'Yes, higher quantities come with better per-unit pricing. Configure your order on any product page to see volume pricing in real time.',
  },
  {
    q: 'Do you ship internationally?',
    a: 'Yes. We ship worldwide via FedEx Express, door-to-door. Shipping is quoted separately at checkout based on destination.',
  },
  {
    q: 'How do I track my order?',
    a: 'After placing your order you receive a confirmation email with your order number. Use our Order Status page to track production and shipping in real time.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Because products are custom-printed, completed orders are generally non-refundable. If there is a quality defect, contact us and we will reprint or make it right.',
  },
]

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      {/* FAQPage 구조화 데이터 — AI 검색/리치결과 인용용 */}
      <JsonLd data={FAQ_JSONLD} />
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h1>
      <div className="space-y-6">
        {FAQS.map((faq, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-6 bg-white">
            <h2 className="font-semibold text-gray-900 mb-2">{faq.q}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
