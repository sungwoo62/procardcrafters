import type { Metadata } from 'next'
import { ArrowRight, Printer, ShoppingCart, Upload, CheckCircle, Star, Package } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Design System',
  robots: { index: false, follow: false },
}

// ─────────────────────────────────────────────
// Color System (20 colors)
// ─────────────────────────────────────────────
const BRAND_COLORS = [
  { name: 'Brand 50',  hex: '#eff6ff', bg: 'bg-blue-50',  text: 'text-gray-700', label: 'blue-50' },
  { name: 'Brand 100', hex: '#dbeafe', bg: 'bg-blue-100', text: 'text-gray-700', label: 'blue-100' },
  { name: 'Brand 200', hex: '#bfdbfe', bg: 'bg-blue-200', text: 'text-gray-700', label: 'blue-200' },
  { name: 'Brand 300', hex: '#93c5fd', bg: 'bg-blue-300', text: 'text-gray-700', label: 'blue-300' },
  { name: 'Brand 400', hex: '#60a5fa', bg: 'bg-blue-400', text: 'text-white',    label: 'blue-400' },
  { name: 'Brand 500', hex: '#3b82f6', bg: 'bg-blue-500', text: 'text-white',    label: 'blue-500' },
  { name: 'Brand 600', hex: '#2563eb', bg: 'bg-blue-600', text: 'text-white',    label: 'blue-600 ★ Primary' },
  { name: 'Brand 700', hex: '#1d4ed8', bg: 'bg-blue-700', text: 'text-white',    label: 'blue-700' },
  { name: 'Brand 800', hex: '#1e40af', bg: 'bg-blue-800', text: 'text-white',    label: 'blue-800' },
  { name: 'Brand 900', hex: '#1e3a8a', bg: 'bg-blue-900', text: 'text-white',    label: 'blue-900' },
]

const NEUTRAL_COLORS = [
  { name: 'White',      hex: '#ffffff', bg: 'bg-white',    text: 'text-gray-400', label: 'white',    border: true },
  { name: 'Neutral 50', hex: '#f9fafb', bg: 'bg-gray-50',  text: 'text-gray-600', label: 'gray-50',  border: false },
  { name: 'Neutral 100',hex: '#f3f4f6', bg: 'bg-gray-100', text: 'text-gray-600', label: 'gray-100', border: false },
  { name: 'Neutral 200',hex: '#e5e7eb', bg: 'bg-gray-200', text: 'text-gray-700', label: 'gray-200', border: false },
  { name: 'Neutral 400',hex: '#9ca3af', bg: 'bg-gray-400', text: 'text-white',    label: 'gray-400', border: false },
  { name: 'Neutral 500',hex: '#6b7280', bg: 'bg-gray-500', text: 'text-white',    label: 'gray-500 — Body text', border: false },
  { name: 'Neutral 700',hex: '#374151', bg: 'bg-gray-700', text: 'text-white',    label: 'gray-700', border: false },
  { name: 'Neutral 900',hex: '#111827', bg: 'bg-gray-900', text: 'text-white',    label: 'gray-900 — Heading', border: false },
]

const SEMANTIC_COLORS = [
  { name: 'Success', hex: '#22c55e', bg: 'bg-green-500', text: 'text-white',    label: 'green-500 — Success/Complete' },
  { name: 'Warning', hex: '#eab308', bg: 'bg-yellow-500', text: 'text-white',   label: 'yellow-500 — Warning/Rating' },
]

// ─────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────
const TYPOGRAPHY = [
  { label: 'Display / H1', cls: 'text-5xl font-bold text-gray-900', sample: 'Premium Print' },
  { label: 'H2', cls: 'text-3xl font-bold text-gray-900', sample: 'Our Products' },
  { label: 'H3', cls: 'text-xl font-semibold text-gray-900', sample: 'Business Cards' },
  { label: 'Body Large', cls: 'text-lg text-gray-600', sample: 'Distributed from LA, delivered worldwide.' },
  { label: 'Body', cls: 'text-base text-gray-700', sample: 'Choose your product, size, and finish options.' },
  { label: 'Body Small', cls: 'text-sm text-gray-500', sample: 'Free FedEx shipping on orders over $100.' },
  { label: 'Caption', cls: 'text-xs text-gray-400', sample: '3–5 business days production' },
  { label: 'Label / Badge', cls: 'text-xs font-semibold uppercase tracking-wide text-blue-600', sample: 'New arrival' },
]

// ─────────────────────────────────────────────
// Components — Buttons
// ─────────────────────────────────────────────
const BUTTONS = [
  { label: 'Primary', cls: 'bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg font-semibold text-sm' },
  { label: 'Secondary', cls: 'border border-gray-300 text-gray-700 hover:border-gray-400 px-5 py-2.5 rounded-lg font-semibold text-sm' },
  { label: 'Ghost', cls: 'text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-lg font-semibold text-sm' },
  { label: 'Danger', cls: 'bg-red-600 text-white hover:bg-red-700 px-5 py-2.5 rounded-lg font-semibold text-sm' },
  { label: 'Primary SM', cls: 'bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-md font-medium text-xs' },
  { label: 'Disabled', cls: 'bg-gray-200 text-gray-400 cursor-not-allowed px-5 py-2.5 rounded-lg font-semibold text-sm' },
]

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Internal
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Procardcrafters Design System</h1>
          <p className="text-gray-500 text-lg">Colors, Typography, Components, Layout — at a glance</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-20">

        {/* ══════════════ 1. COLOR SYSTEM ══════════════ */}
        <section>
          <SectionTitle number="01" title="Color System" subtitle="Brand 10 + Neutral 8 + Semantic 2 = 20 colors total" />

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Brand (Blue)</h3>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">
            {BRAND_COLORS.map((c) => (
              <ColorSwatch key={c.name} {...c} />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Neutral (Gray)</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-8">
            {NEUTRAL_COLORS.map((c) => (
              <ColorSwatch key={c.name} {...c} />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Semantic</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SEMANTIC_COLORS.map((c) => (
              <ColorSwatch key={c.name} {...c} />
            ))}
          </div>
        </section>

        {/* ══════════════ 2. TYPOGRAPHY ══════════════ */}
        <section>
          <SectionTitle number="02" title="Typography" subtitle="Geist Sans — 8-step type scale" />
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {TYPOGRAPHY.map((t) => (
              <div key={t.label} className="flex items-baseline gap-6 px-6 py-5">
                <span className="text-xs font-mono text-gray-400 w-28 shrink-0">{t.label}</span>
                <span className={t.cls}>{t.sample}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════ 3. BUTTONS ══════════════ */}
        <section>
          <SectionTitle number="03" title="Buttons" subtitle="6 button variants" />
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="flex flex-wrap gap-4 items-center">
              {BUTTONS.map((b) => (
                <button key={b.label} className={`transition-colors ${b.cls}`}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ 4. BADGES & TAGS ══════════════ */}
        <section>
          <SectionTitle number="04" title="Badges & Tags" subtitle="Status indicator badges" />
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'New', cls: 'bg-blue-100 text-blue-700' },
                { label: 'Popular', cls: 'bg-indigo-100 text-indigo-700' },
                { label: 'In Stock', cls: 'bg-green-100 text-green-700' },
                { label: 'Sold Out', cls: 'bg-red-100 text-red-700' },
                { label: 'Sale', cls: 'bg-yellow-100 text-yellow-700' },
                { label: 'Processing', cls: 'bg-gray-100 text-gray-600' },
                { label: 'Shipped', cls: 'bg-emerald-100 text-emerald-700' },
                { label: 'Delivered', cls: 'bg-teal-100 text-teal-700' },
              ].map((b) => (
                <span key={b.label} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${b.cls}`}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ 5. CARDS ══════════════ */}
        <section>
          <SectionTitle number="05" title="Cards" subtitle="Product card · Feature card · Review card" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Product Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer group">
              <div className="text-5xl mb-4">🪪</div>
              <div className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-2">Popular</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-lg mb-1">Business Cards</h3>
              <p className="text-sm text-gray-500 mb-4">Professional cards that make a lasting impression.</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">From $18</span>
                <div className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                  Order <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Feature Card */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl mb-4">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Premium Quality</h3>
              <p className="text-sm text-blue-100 leading-relaxed">
                Printed with top-tier equipment and premium materials. Quality guaranteed.
              </p>
            </div>

            {/* Review Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                "The quality blew me away. My clients always ask where I get my business cards printed."
              </p>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Sarah M.</div>
                <div className="text-gray-400 text-xs">Freelance Designer</div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ 6. FORM ELEMENTS ══════════════ */}
        <section>
          <SectionTitle number="06" title="Form Elements" subtitle="Input · Select · Checkbox · Radio" />
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  readOnly
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Quantity</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>100 pcs</option>
                  <option>200 pcs</option>
                  <option>500 pcs</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Error State</label>
                <input
                  type="text"
                  value="Invalid value"
                  className="w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50"
                  readOnly
                />
                <p className="text-xs text-red-500">Please enter a valid value.</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Disabled</label>
                <input
                  type="text"
                  value="Not editable"
                  disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="chk1" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="chk1" className="text-sm text-gray-700">I agree to the Terms of Service</label>
              </div>
              <div className="flex items-center gap-6 pt-2">
                {['Standard Paper', 'Premium Gloss', 'Matte Finish'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="finish" className="w-4 h-4 text-blue-600" readOnly />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ 7. 3 LAYOUTS ══════════════ */}
        <section>
          <SectionTitle number="07" title="3 Layout Variants" subtitle="Marketing / Product Detail / Form" />

          {/* Layout A: Marketing (Hero + Grid) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Layout A — Marketing (Hero + Grid)
            </h3>
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              {/* Mini Hero */}
              <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-8 py-10 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  Trusted by 10,000+ customers
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
                  Premium Print,{' '}
                  <span className="text-blue-600">Shipped From LA</span>
                </h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm mb-6">
                  Business cards, stickers, flyers — printed with precision and delivered worldwide.
                </p>
                <div className="flex gap-3 justify-center">
                  <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold text-sm inline-flex items-center gap-2">
                    Shop Now <ArrowRight className="w-4 h-4" />
                  </button>
                  <button className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-semibold text-sm">
                    Learn More
                  </button>
                </div>
              </div>
              {/* Grid */}
              <div className="px-8 py-6 bg-white">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {['🪪 Business Cards', '⭐ Stickers', '📄 Flyers', '💌 Postcards', '🖼️ Posters'].map((p) => (
                    <div key={p} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors text-center text-sm">
                      <div className="text-2xl mb-2">{p.split(' ')[0]}</div>
                      <div className="text-xs text-gray-600 font-medium">{p.split(' ').slice(1).join(' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Layout B: Product Detail (Sidebar + Main) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Layout B — Product Detail (Sidebar + Main Content)
            </h3>
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
              <div className="flex">
                {/* Sidebar */}
                <div className="w-64 border-r border-gray-200 p-6 shrink-0">
                  <div className="text-5xl mb-4">🪪</div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Business Cards</h2>
                  <p className="text-sm text-gray-500 mb-4">Standard or premium options.</p>
                  <div className="text-2xl font-bold text-gray-900 mb-1">$18.00</div>
                  <div className="text-xs text-gray-400 mb-6">+ FedEx shipping calculated at checkout</div>
                  <button className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-2">
                    <ShoppingCart className="w-4 h-4" /> Add to Cart
                  </button>
                </div>
                {/* Main */}
                <div className="flex-1 p-6">
                  <div className="space-y-4">
                    {[
                      { label: 'Size', options: ['Standard (90×55mm)', 'US (89×51mm)', 'Square (55×55mm)'] },
                      { label: 'Quantity', options: ['100 pcs', '200 pcs', '500 pcs', '1000 pcs'] },
                      { label: 'Paper', options: ['350g Art Paper', '400g Premium Stock', '500g Clear PVC'] },
                      { label: 'Coating', options: ['Uncoated', 'Gloss Coating', 'Matte Coating', 'Spot UV'] },
                    ].map((opt) => (
                      <div key={opt.label}>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">{opt.label}</label>
                        <div className="flex flex-wrap gap-2">
                          {opt.options.map((o, i) => (
                            <button
                              key={o}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                i === 0
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Layout C: Form (Centered) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Layout C — Form (Centered Layout)
            </h3>
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
              <div className="max-w-lg mx-auto py-10 px-8">
                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                  {['Cart', 'Shipping', 'Payment', 'Confirm'].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-blue-600 text-white' :
                        i < 2 ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-200 text-gray-400'
                      }`}>
                        {i < 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${
                        i === 0 ? 'text-blue-600' : i < 2 ? 'text-blue-400' : 'text-gray-400'
                      }`}>{step}</span>
                      {i < 3 && <div className="w-6 h-px bg-gray-300" />}
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-6">Shipping Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">First Name</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="John" readOnly />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">Last Name</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Doe" readOnly />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Address</label>
                      <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="123 Main St" readOnly />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-gray-600">City</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="New York" readOnly />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">ZIP</label>
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="10001" readOnly />
                      </div>
                    </div>
                    <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm mt-2 inline-flex items-center justify-center gap-2">
                      Continue to Payment <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ 8. SAMPLE PAGES ══════════════ */}
        <section>
          <SectionTitle number="08" title="Sample Pages — Preview" subtitle="Actual page layout thumbnails" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Homepage */}
            <PagePreview title="Homepage" href="/" color="from-blue-50 to-indigo-50">
              <div className="space-y-2 p-3">
                <div className="h-8 bg-blue-600 rounded-lg w-3/4 mx-auto" />
                <div className="h-2 bg-gray-200 rounded w-2/3 mx-auto" />
                <div className="h-2 bg-gray-200 rounded w-1/2 mx-auto" />
                <div className="flex gap-1 justify-center mt-2">
                  <div className="h-5 w-14 bg-blue-600 rounded" />
                  <div className="h-5 w-14 bg-gray-200 rounded" />
                </div>
                <div className="grid grid-cols-3 gap-1 mt-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-white border border-gray-200 rounded-lg" />
                  ))}
                </div>
              </div>
            </PagePreview>

            {/* Product Detail */}
            <PagePreview title="Product Detail" href="/products/business-cards" color="from-white to-gray-50">
              <div className="flex gap-2 p-3 h-full">
                <div className="w-1/3 space-y-1.5">
                  <div className="h-10 w-10 bg-gray-100 rounded-lg" />
                  <div className="h-2 bg-gray-300 rounded w-full" />
                  <div className="h-2 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-blue-600 rounded w-full mt-3" />
                </div>
                <div className="flex-1 space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <div className="h-1.5 bg-gray-300 rounded w-1/3 mb-1" />
                      <div className="flex gap-1">
                        {[...Array(3)].map((_, j) => (
                          <div key={j} className={`h-4 w-10 rounded border ${j === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PagePreview>

            {/* Order Form */}
            <PagePreview title="Order Form" href="/order" color="from-gray-50 to-gray-100">
              <div className="p-3 space-y-2">
                <div className="flex justify-center gap-1 mb-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className={`w-4 h-4 rounded-full ${i === 0 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      {i < 3 && <div className="w-3 h-px bg-gray-200" />}
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1">
                    <div className="h-4 bg-gray-100 rounded border border-gray-200" />
                    <div className="h-4 bg-gray-100 rounded border border-gray-200" />
                  </div>
                  <div className="h-4 bg-gray-100 rounded border border-gray-200" />
                  <div className="h-4 bg-blue-600 rounded mt-2" />
                </div>
              </div>
            </PagePreview>
          </div>
        </section>

        {/* ══════════════ 9. SPACING & RADIUS ══════════════ */}
        <section>
          <SectionTitle number="09" title="Spacing & Radius" subtitle="Spacing scale + border radius rules" />
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Spacing */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Spacing Scale</h3>
                <div className="space-y-2">
                  {[
                    { size: '4px', cls: 'w-1', label: 'p-1 — Icon gap' },
                    { size: '8px', cls: 'w-2', label: 'p-2 — Compact padding' },
                    { size: '12px', cls: 'w-3', label: 'p-3 — Small card' },
                    { size: '16px', cls: 'w-4', label: 'p-4 — Default padding' },
                    { size: '24px', cls: 'w-6', label: 'p-6 — Card padding' },
                    { size: '32px', cls: 'w-8', label: 'p-8 — Section padding' },
                    { size: '48px', cls: 'w-12', label: 'py-12 — Section gap' },
                    { size: '80px', cls: 'w-20', label: 'py-20 — Section block' },
                  ].map((s) => (
                    <div key={s.size} className="flex items-center gap-3">
                      <div className={`h-3 bg-blue-400 rounded shrink-0 ${s.cls}`} />
                      <span className="text-xs text-gray-500 font-mono">{s.size}</span>
                      <span className="text-xs text-gray-400">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Border Radius</h3>
                <div className="space-y-3">
                  {[
                    { label: 'rounded (4px)', cls: 'rounded', usage: 'Checkbox, Radio' },
                    { label: 'rounded-md (6px)', cls: 'rounded-md', usage: 'Small buttons, Badges' },
                    { label: 'rounded-lg (8px)', cls: 'rounded-lg', usage: 'Buttons, Inputs' },
                    { label: 'rounded-xl (12px)', cls: 'rounded-xl', usage: 'CTA buttons' },
                    { label: 'rounded-2xl (16px)', cls: 'rounded-2xl', usage: 'Cards, Sections' },
                    { label: 'rounded-full', cls: 'rounded-full', usage: 'Badges, Avatars' },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-3">
                      <div className={`w-16 h-8 bg-blue-100 border-2 border-blue-300 shrink-0 ${r.cls}`} />
                      <div>
                        <div className="text-xs font-mono text-gray-700">{r.label}</div>
                        <div className="text-xs text-gray-400">{r.usage}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ 10. ICON SET ══════════════ */}
        <section>
          <SectionTitle number="10" title="Icon Set (lucide-react)" subtitle="Key icons — all 24px base size" />
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-4">
              {[
                { Icon: Package, label: 'Logo' },
                { Icon: Printer, label: 'Print' },
                { Icon: ShoppingCart, label: 'Cart' },
                { Icon: Upload, label: 'Upload' },
                { Icon: CheckCircle, label: 'Complete' },
                { Icon: Star, label: 'Rating' },
                { Icon: ArrowRight, label: 'Navigate' },
              ].map(({ Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                  <Icon className="w-6 h-6 text-gray-700" />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">Procardcrafters Design System — Internal Use Only</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────
function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className="text-3xl font-black text-blue-100 font-mono leading-none mt-1">{number}</div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function ColorSwatch({
  name, hex, bg, text, label, border = false,
}: {
  name: string; hex: string; bg: string; text: string; label: string; border?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className={`h-14 rounded-xl ${bg} ${border ? 'border border-gray-200' : ''}`} title={hex} />
      <div className="px-0.5">
        <div className={`text-xs font-semibold truncate ${text === 'text-white' ? 'text-gray-700' : 'text-gray-700'}`}>
          {name}
        </div>
        <div className="text-xs text-gray-400 font-mono truncate">{hex}</div>
        <div className="text-xs text-gray-400 truncate">{label}</div>
      </div>
    </div>
  )
}

function PagePreview({
  title, href, color, children,
}: {
  title: string; href: string; color: string; children: React.ReactNode;
}) {
  return (
    <a href={href} className="group block border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all">
      <div className={`bg-gradient-to-br ${color} h-48 overflow-hidden relative`}>
        <div className="absolute inset-0 scale-100 origin-top-left">
          {children}
        </div>
      </div>
      <div className="bg-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
      </div>
    </a>
  )
}
