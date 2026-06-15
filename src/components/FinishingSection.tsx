import Image from 'next/image'
import { FINISHING_CATALOG } from '@/config/finishing-catalog'

interface Props {
  productCategory: string
}

export default function FinishingSection({ productCategory }: Props) {
  const relevant = FINISHING_CATALOG.filter(f => f.fits.includes(productCategory))
  if (relevant.length === 0) return null

  return (
    <section className="bg-gray-50 border-t border-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">후가공 옵션</span>
          <h2 className="text-2xl font-bold text-gray-900 mt-1.5">Finishing Options</h2>
          <p className="text-gray-500 text-sm mt-1">
            Premium add-ons to elevate your print. Available at checkout — ask us for a quote.
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
                  // OMO-3196: 사진 미보유 후가공은 인라인 SVG(data-URI) — 최적화 우회 필요.
                  unoptimized={f.image_url.startsWith('data:')}
                />
              </div>
              <div className="p-3">
                <div className="font-semibold text-gray-900 text-sm">{f.label_en}</div>
                <div className="text-xs font-medium text-blue-600 mt-0.5 mb-1.5">{f.label_ko}</div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{f.description_en}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-6">
          * Finishing options are quoted separately. Contact us at{' '}
          <a href="mailto:hello@procardcrafters.com" className="text-blue-500 hover:underline">
            hello@procardcrafters.com
          </a>{' '}
          with your specifications.
        </p>
      </div>
    </section>
  )
}
