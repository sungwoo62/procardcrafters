import Image from 'next/image'
import { FINISHING_CATALOG } from '@/config/finishing-catalog'

interface Props {
  productCategory: string
  /** 이 카테고리에서 후가공이 구성기(Configurator)에서 직접 주문/가격반영 되는지 (OMO-2664). */
  orderable?: boolean
}

export default function FinishingSection({ productCategory, orderable = false }: Props) {
  const relevant = FINISHING_CATALOG.filter(f => f.fits.includes(productCategory))
  if (relevant.length === 0) return null

  return (
    <section className="bg-gray-50 border-t border-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Finishing Options</span>
          <h2 className="text-2xl font-bold text-gray-900 mt-1.5">Finishing Options</h2>
          <p className="text-gray-500 text-sm mt-1">
            {orderable
              ? 'Premium add-ons to elevate your print. Select foil, emboss, die-cut, or drilled-hole right in the configurator above — pricing is included instantly.'
              : 'Premium add-ons to elevate your print. Available at checkout — ask us for a quote.'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {relevant.map(f => (
            <div
              key={f.value}
              className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="relative w-full h-32">
                <Image
                  src={f.image_url}
                  alt={f.label_en}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                />
              </div>
              <div className="p-3">
                <div className="font-semibold text-gray-900 text-sm mb-1.5">{f.label_en}</div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{f.description_en}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-6">
          {orderable ? (
            <>
              * Foil, emboss, die-cut and drilled-hole are priced and ordered directly above. For other
              finishings or custom specs, contact{' '}
              <a href="mailto:hello@procardcrafters.com" className="text-blue-500 hover:underline">
                hello@procardcrafters.com
              </a>
              .
            </>
          ) : (
            <>
              * Finishing options are quoted separately. Contact us at{' '}
              <a href="mailto:hello@procardcrafters.com" className="text-blue-500 hover:underline">
                hello@procardcrafters.com
              </a>{' '}
              with your specifications.
            </>
          )}
        </p>
      </div>
    </section>
  )
}
