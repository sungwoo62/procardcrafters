/**
 * SVG-based product illustrations for each product category.
 * Moo·Vistaprint 스타일 단순 일러스트 — 24 카테고리 커버.
 */

const illustrations: Record<string, React.ReactNode> = {
  business_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="30" y="35" width="120" height="72" rx="6" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="40" y="30" width="120" height="72" rx="6" fill="white" stroke="#3b82f6" strokeWidth="2" />
      <rect x="52" y="46" width="40" height="4" rx="2" fill="#3b82f6" />
      <rect x="52" y="56" width="60" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="52" y="64" width="48" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="52" y="72" width="55" height="3" rx="1.5" fill="#cbd5e1" />
      <circle cx="140" cy="62" r="14" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      <path d="M135 62l3 3 7-7" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  premium_business_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="40" y="30" width="120" height="72" rx="6" fill="#f8fafc" stroke="#6366f1" strokeWidth="2" />
      <rect x="40" y="30" width="120" height="20" rx="6" fill="#6366f1" />
      <rect x="40" y="44" width="120" height="6" fill="#6366f1" />
      <rect x="52" y="60" width="50" height="4" rx="2" fill="#6366f1" />
      <rect x="52" y="70" width="70" height="3" rx="1.5" fill="#a5b4fc" />
      <path d="M130 70l6-8 6 8h-3v8h-6v-8h-3z" fill="#eab308" />
    </svg>
  ),
  premium_foil_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="40" y="30" width="120" height="72" rx="6" fill="#1f2937" />
      <rect x="52" y="46" width="60" height="6" rx="2" fill="url(#foil)" />
      <rect x="52" y="58" width="40" height="3" rx="1.5" fill="#fde68a" />
      <rect x="52" y="66" width="50" height="3" rx="1.5" fill="#fbbf24" opacity="0.6" />
      <circle cx="135" cy="64" r="14" fill="url(#foil)" />
      <path d="M130 64l3 3 7-7" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  letterpress_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="40" y="30" width="120" height="72" rx="6" fill="#fafaf9" stroke="#78716c" strokeWidth="2" />
      <rect x="52" y="48" width="55" height="6" rx="1" fill="#fafaf9" stroke="#0c0a09" strokeWidth="1" />
      <rect x="52" y="60" width="70" height="3" rx="1" fill="#78716c" />
      <rect x="52" y="68" width="50" height="3" rx="1" fill="#a8a29e" />
      <text x="120" y="86" fill="#0c0a09" fontSize="9" fontWeight="700">L.P.</text>
    </svg>
  ),
  stickers: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <circle cx="100" cy="65" r="40" fill="#fef9c3" stroke="#eab308" strokeWidth="2" />
      <circle cx="70" cy="50" r="18" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="130" cy="50" r="15" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <path d="M100 35l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" fill="#f59e0b" />
    </svg>
  ),
  die_cut_stickers: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <path d="M100 25c20 0 38 8 50 25s8 38-5 52-35 18-50 18-33-5-45-18-17-35-5-52S80 25 100 25z" fill="#fffbeb" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" />
      <path d="M80 60l10 10 20-20" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  eco_stickers: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <circle cx="100" cy="65" r="42" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
      <path d="M100 40c-12 0-22 10-22 22 0 6 2 11 6 15 4-8 9-13 16-17-2 5-4 11-3 18 8-3 14-9 17-17 1 6 0 12-2 17 9-4 15-13 15-22 0-10-9-16-27-16z" fill="#16a34a" />
      <path d="M86 95l8-8 6 6 18-18" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  greeting_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="55" y="22" width="90" height="100" rx="4" fill="white" stroke="#ec4899" strokeWidth="2" />
      <path d="M100 70c-6-9-18-9-18 0 0 9 18 18 18 18s18-9 18-18c0-9-12-9-18 0z" fill="#fbcfe8" stroke="#ec4899" strokeWidth="1.5" />
      <rect x="68" y="96" width="64" height="3" rx="1" fill="#94a3b8" />
      <rect x="74" y="104" width="52" height="3" rx="1" fill="#cbd5e1" />
    </svg>
  ),
  labels: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <path d="M50 50 L100 30 L150 50 L150 100 L100 120 L50 100 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
      <circle cx="100" cy="75" r="6" fill="#d97706" />
      <rect x="76" y="88" width="48" height="3" rx="1" fill="#92400e" />
      <rect x="82" y="96" width="36" height="3" rx="1" fill="#a16207" />
    </svg>
  ),
  flyers: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="55" y="20" width="90" height="110" rx="4" fill="white" stroke="#10b981" strokeWidth="2" />
      <rect x="65" y="30" width="70" height="30" rx="3" fill="#d1fae5" />
      <rect x="65" y="68" width="50" height="4" rx="2" fill="#10b981" />
      <rect x="65" y="78" width="70" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="65" y="86" width="60" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="65" y="108" width="35" height="12" rx="3" fill="#10b981" />
    </svg>
  ),
  brochures: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="35" y="25" width="55" height="90" rx="3" fill="white" stroke="#14b8a6" strokeWidth="1.5" />
      <rect x="72" y="25" width="55" height="90" rx="3" fill="white" stroke="#14b8a6" strokeWidth="1.5" />
      <rect x="110" y="25" width="55" height="90" rx="3" fill="white" stroke="#14b8a6" strokeWidth="2" />
      <rect x="42" y="33" width="40" height="18" rx="2" fill="#ccfbf1" />
      <rect x="79" y="33" width="40" height="18" rx="2" fill="#ccfbf1" />
      <rect x="117" y="33" width="40" height="18" rx="2" fill="#99f6e4" />
      <path d="M72 25v90M110 25v90" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4 2" />
    </svg>
  ),
  booklets: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="35" y="25" width="60" height="95" rx="3" fill="white" stroke="#0891b2" strokeWidth="2" />
      <rect x="95" y="25" width="60" height="95" rx="3" fill="white" stroke="#0891b2" strokeWidth="2" />
      <path d="M95 25v95" stroke="#0891b2" strokeWidth="1.5" />
      <rect x="43" y="35" width="44" height="6" rx="1" fill="#0891b2" />
      <rect x="43" y="48" width="38" height="3" rx="1" fill="#67e8f9" />
      <rect x="43" y="56" width="40" height="3" rx="1" fill="#67e8f9" />
      <rect x="43" y="64" width="36" height="3" rx="1" fill="#67e8f9" />
      <rect x="103" y="48" width="38" height="3" rx="1" fill="#67e8f9" />
      <rect x="103" y="56" width="40" height="3" rx="1" fill="#67e8f9" />
      <rect x="103" y="64" width="36" height="3" rx="1" fill="#67e8f9" />
    </svg>
  ),
  postcards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="30" y="30" width="140" height="85" rx="6" fill="white" stroke="#ec4899" strokeWidth="2" />
      <line x1="100" y1="38" x2="100" y2="107" stroke="#fce7f3" strokeWidth="1.5" />
      <rect x="40" y="38" width="50" height="60" rx="3" fill="#fce7f3" />
      <rect x="110" y="45" width="45" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="110" y="53" width="50" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="140" y="80" width="18" height="18" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1" />
    </svg>
  ),
  envelopes: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="35" y="40" width="130" height="80" rx="3" fill="white" stroke="#8b5cf6" strokeWidth="2" />
      <path d="M35 40 L100 90 L165 40" stroke="#8b5cf6" strokeWidth="2" fill="#ede9fe" />
      <rect x="120" y="55" width="30" height="20" rx="2" fill="#c4b5fd" stroke="#8b5cf6" strokeWidth="1" />
    </svg>
  ),
  forms: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="50" y="20" width="100" height="105" rx="4" fill="white" stroke="#6b7280" strokeWidth="2" />
      <rect x="60" y="32" width="60" height="4" rx="2" fill="#374151" />
      <rect x="60" y="48" width="80" height="2" rx="1" fill="#9ca3af" />
      <rect x="60" y="58" width="80" height="2" rx="1" fill="#9ca3af" />
      <rect x="60" y="68" width="80" height="2" rx="1" fill="#9ca3af" />
      <rect x="60" y="80" width="35" height="14" rx="1" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1" />
      <rect x="100" y="80" width="35" height="14" rx="1" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1" />
      <rect x="60" y="100" width="80" height="2" rx="1" fill="#9ca3af" />
      <rect x="60" y="108" width="60" height="2" rx="1" fill="#9ca3af" />
    </svg>
  ),
  posters: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="50" y="10" width="100" height="120" rx="4" fill="white" stroke="#8b5cf6" strokeWidth="2" />
      <rect x="58" y="18" width="84" height="50" rx="3" fill="#ede9fe" />
      <circle cx="80" cy="43" r="12" fill="#c4b5fd" />
      <path d="M75 58l15-20 15 20" fill="#ddd6fe" />
      <rect x="58" y="76" width="60" height="5" rx="2.5" fill="#8b5cf6" />
      <rect x="58" y="88" width="84" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="58" y="96" width="70" height="3" rx="1.5" fill="#94a3b8" />
    </svg>
  ),
  banners: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="75" y="10" width="50" height="110" rx="4" fill="white" stroke="#ef4444" strokeWidth="2" />
      <rect x="82" y="18" width="36" height="24" rx="2" fill="#fee2e2" />
      <rect x="82" y="50" width="30" height="3" rx="1.5" fill="#ef4444" />
      <rect x="82" y="58" width="36" height="2.5" rx="1" fill="#94a3b8" />
      <rect x="85" y="85" width="30" height="10" rx="3" fill="#ef4444" />
      <rect x="95" y="120" width="10" height="15" rx="1" fill="#94a3b8" />
      <rect x="90" y="135" width="20" height="3" rx="1" fill="#64748b" />
    </svg>
  ),
  pop: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <path d="M70 110 L130 110 L120 30 L80 30 Z" fill="#fef9c3" stroke="#ca8a04" strokeWidth="2" />
      <rect x="86" y="40" width="28" height="4" rx="2" fill="#ca8a04" />
      <rect x="83" y="50" width="34" height="2.5" rx="1" fill="#fde047" />
      <rect x="86" y="58" width="28" height="2.5" rx="1" fill="#fde047" />
      <circle cx="100" cy="80" r="14" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
      <text x="93" y="84" fill="#713f12" fontSize="11" fontWeight="700">%</text>
      <path d="M60 110 L140 110 L145 120 L55 120 Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
    </svg>
  ),
  boxes: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <path d="M60 50 L100 30 L140 50 L140 105 L100 125 L60 105 Z" fill="#fed7aa" stroke="#c2410c" strokeWidth="2" />
      <path d="M60 50 L100 70 L140 50" stroke="#c2410c" strokeWidth="2" fill="none" />
      <path d="M100 70 L100 125" stroke="#c2410c" strokeWidth="2" />
      <path d="M82 60 L82 75 L100 85 L118 75 L118 60" stroke="#9a3412" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  paper_bags: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <path d="M65 40 L65 120 L135 120 L135 40" fill="#fef3c7" stroke="#a16207" strokeWidth="2" />
      <path d="M65 40 L80 25 L120 25 L135 40" fill="#fde68a" stroke="#a16207" strokeWidth="2" />
      <path d="M85 28 C85 18 115 18 115 28" stroke="#a16207" strokeWidth="2" fill="none" />
      <rect x="80" y="60" width="40" height="4" rx="1" fill="#a16207" />
      <rect x="80" y="72" width="35" height="3" rx="1" fill="#d4d4d8" />
    </svg>
  ),
  notebooks: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="55" y="20" width="90" height="105" rx="4" fill="#fef3c7" stroke="#a16207" strokeWidth="2" />
      <rect x="60" y="20" width="6" height="105" fill="#a16207" />
      <line x1="75" y1="45" x2="135" y2="45" stroke="#d4a574" strokeWidth="1" />
      <line x1="75" y1="55" x2="135" y2="55" stroke="#d4a574" strokeWidth="1" />
      <line x1="75" y1="65" x2="135" y2="65" stroke="#d4a574" strokeWidth="1" />
      <line x1="75" y1="75" x2="135" y2="75" stroke="#d4a574" strokeWidth="1" />
      <line x1="75" y1="85" x2="135" y2="85" stroke="#d4a574" strokeWidth="1" />
      <line x1="75" y1="95" x2="135" y2="95" stroke="#d4a574" strokeWidth="1" />
      <line x1="75" y1="105" x2="135" y2="105" stroke="#d4a574" strokeWidth="1" />
    </svg>
  ),
  memo_pads: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="60" y="35" width="80" height="80" rx="2" fill="#fef08a" stroke="#a16207" strokeWidth="1.5" />
      <rect x="60" y="35" width="80" height="10" fill="#facc15" />
      <line x1="70" y1="55" x2="130" y2="55" stroke="#a16207" strokeWidth="1" opacity="0.4" />
      <line x1="70" y1="65" x2="130" y2="65" stroke="#a16207" strokeWidth="1" opacity="0.4" />
      <line x1="70" y1="75" x2="130" y2="75" stroke="#a16207" strokeWidth="1" opacity="0.4" />
      <line x1="70" y1="85" x2="130" y2="85" stroke="#a16207" strokeWidth="1" opacity="0.4" />
      <line x1="70" y1="95" x2="115" y2="95" stroke="#a16207" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
  calendars: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="40" y="30" width="120" height="100" rx="4" fill="white" stroke="#0284c7" strokeWidth="2" />
      <rect x="40" y="30" width="120" height="22" fill="#0284c7" />
      <text x="100" y="46" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">JUNE 2026</text>
      <g fill="#0c4a6e">
        <rect x="52" y="60" width="6" height="6" rx="1" />
        <rect x="68" y="60" width="6" height="6" rx="1" />
        <rect x="84" y="60" width="6" height="6" rx="1" />
        <rect x="100" y="60" width="6" height="6" rx="1" />
        <rect x="116" y="60" width="6" height="6" rx="1" />
        <rect x="132" y="60" width="6" height="6" rx="1" />
        <rect x="148" y="60" width="6" height="6" rx="1" />
      </g>
      <g fill="#cbd5e1">
        <rect x="52" y="72" width="6" height="6" rx="1" />
        <rect x="68" y="72" width="6" height="6" rx="1" />
        <rect x="84" y="72" width="6" height="6" rx="1" />
        <rect x="100" y="72" width="6" height="6" rx="1" fill="#0284c7" />
        <rect x="116" y="72" width="6" height="6" rx="1" />
        <rect x="132" y="72" width="6" height="6" rx="1" />
        <rect x="148" y="72" width="6" height="6" rx="1" />
        <rect x="52" y="84" width="6" height="6" rx="1" />
        <rect x="68" y="84" width="6" height="6" rx="1" />
        <rect x="84" y="84" width="6" height="6" rx="1" />
        <rect x="100" y="84" width="6" height="6" rx="1" />
        <rect x="116" y="84" width="6" height="6" rx="1" />
        <rect x="132" y="84" width="6" height="6" rx="1" />
        <rect x="148" y="84" width="6" height="6" rx="1" />
        <rect x="52" y="96" width="6" height="6" rx="1" />
        <rect x="68" y="96" width="6" height="6" rx="1" />
        <rect x="84" y="96" width="6" height="6" rx="1" />
        <rect x="100" y="96" width="6" height="6" rx="1" />
        <rect x="116" y="96" width="6" height="6" rx="1" />
      </g>
    </svg>
  ),
  sample_pack: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <rect x="40" y="40" width="40" height="55" rx="3" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.5" />
      <rect x="80" y="50" width="40" height="55" rx="3" fill="#fef3c7" stroke="#ca8a04" strokeWidth="1.5" />
      <rect x="120" y="40" width="40" height="55" rx="3" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
      <rect x="55" y="105" width="90" height="12" rx="2" fill="#1e3a8a" />
      <text x="100" y="114" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">SAMPLE PACK</text>
    </svg>
  ),
}

export default function ProductImage({ category, className = '' }: { category: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center p-6 ${className}`}>
      {illustrations[category] ?? (
        <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
          <rect x="50" y="30" width="100" height="80" rx="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
          <text x="100" y="75" textAnchor="middle" fill="#94a3b8" fontSize="14">Product</text>
        </svg>
      )}
    </div>
  )
}
