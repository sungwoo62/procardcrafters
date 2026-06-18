import Link from 'next/link'
import { ArrowLeft, BadgeCheck, Layers, Sparkles, ArrowRight } from 'lucide-react'
import { PRINTCITY_PRODUCTS, startingSupplyKrw, withVat } from '@/lib/printcity-product'

// OMO-3452 (board 2026-06-18): real product pages for namecards, English site, supplier hidden from URL.
//   Each card → /business-cards/[id] with full option configurator + per-combo live pricing + finishing.
//   Legacy supplier (swadpia) namecard code is preserved but not surfaced here. Customer USD/checkout = board gate.
export const dynamic = 'force-static'
export const metadata = {
  title: 'Business Cards · Procardcrafters',
  description: 'Custom business cards — choose paper, size, coating, sides, foil and finishing. Full option mapping, live pricing, worldwide delivery.',
}

const won = (n: number) => `₩${Math.round(n).toLocaleString('en-US')}`

export default function NamecardIndexPage() {
  const products = PRINTCITY_PRODUCTS
  const totalCombos = products.reduce((s, p) => s + p.table.length, 0)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/products"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>

      <div className="flex items-center gap-2">
        <BadgeCheck className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Business Cards</h1>
      </div>
      <p className="mt-2 text-sm text-gray-600 max-w-2xl">
        Premium custom business cards across {products.length} styles. Open any card to choose
        <strong> paper, size, coating, print sides, foil</strong> and <strong>finishing</strong> — every option is
        selectable and priced per combination and quantity.
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat value={String(products.length)} label="Card styles" />
        <Stat value={totalCombos.toLocaleString('en-US')} label="Option combinations" />
        <Stat value="Live" label="Real per-combo pricing" icon={<Layers className="h-4 w-4 text-green-700" />} green />
        <Stat value="Finishing" label="Foil, emboss, scoring & more" icon={<Sparkles className="h-4 w-4 text-amber-700" />} amber />
      </div>

      {groupBySub(products).map(({ sub, items }) => (
        <section key={sub} className="mt-8">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-4 rounded-full bg-blue-500" />
            {sub} <span className="text-gray-400 font-normal">({items.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => {
              const start = startingSupplyKrw(p)
              const startTotal = start ? withVat(start.krw).total : null
              const axisCount = Object.keys(p.axes).length
              return (
                <Link
                  key={p.id}
                  href={`/business-cards/${p.id}`}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <div className="aspect-[16/9] rounded-xl bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 border border-gray-100 flex items-center justify-center mb-4">
                    <BadgeCheck className="h-9 w-9 text-blue-400" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.label}</h3>
                    {p.hasFoil && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                        {p.axes.foil?.options.length ?? 0} foils
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{p.subEn ?? p.sub}</p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    {axisCount + 1} option groups · {p.table.length} combinations · {p.quantities.length} qty tiers
                  </p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      {startTotal != null ? (
                        <>
                          <span className="text-[11px] text-gray-400">from </span>
                          <span className="text-lg font-bold text-gray-900">{won(startTotal)}</span>
                          <span className="text-[11px] text-gray-400"> / {start?.qty.toLocaleString('en-US')} pcs</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">Configure</span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                      Configure <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function groupBySub(products: typeof PRINTCITY_PRODUCTS) {
  const order: string[] = []
  const map = new Map<string, typeof PRINTCITY_PRODUCTS>()
  for (const p of products) {
    const sub = p.subEn ?? p.sub ?? 'Business Cards'
    if (!map.has(sub)) { map.set(sub, []); order.push(sub) }
    map.get(sub)!.push(p)
  }
  return order.map((sub) => ({ sub, items: map.get(sub)! }))
}

function Stat({
  value,
  label,
  icon,
  green,
  amber,
}: {
  value: string
  label: string
  icon?: React.ReactNode
  green?: boolean
  amber?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className={`flex items-center gap-1 text-lg font-bold ${green ? 'text-green-700' : amber ? 'text-amber-700' : 'text-gray-900'}`}>
        {icon}
        {value}
      </div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  )
}
