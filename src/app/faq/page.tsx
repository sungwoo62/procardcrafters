import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ - Procardcrafters',
  description: 'Frequently asked questions about ordering, shipping, and printing.',
}

const FAQS = [
  {
    q: 'Where are your products printed?',
    a: 'All products are printed using professional-grade equipment and premium materials, and distributed from our Los Angeles facility.',
  },
  {
    q: 'What file formats do you accept?',
    a: 'We accept PDF, AI (Adobe Illustrator), and PSD (Photoshop) files. PDF is recommended for best results.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Production takes 3-5 business days. International shipping via FedEx typically takes 3-7 business days depending on your location.',
  },
  {
    q: 'What currency do you charge in?',
    a: 'All prices are in USD. We use daily exchange rates to ensure fair and transparent pricing.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Since products are custom-printed, we cannot offer refunds for completed orders. However, if there is a quality issue, please contact us and we will make it right.',
  },
  {
    q: 'Do you offer bulk discounts?',
    a: 'Yes, higher quantities come with better per-unit pricing. Configure your order on any product page to see volume pricing.',
  },
  {
    q: 'How do I track my order?',
    a: 'After placing your order, you will receive a confirmation email with your order number. Use our Order Status page to track progress.',
  },
]

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
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
