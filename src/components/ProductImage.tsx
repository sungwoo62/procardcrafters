/**
 * SVG-based product illustrations for each product category.
 * Used instead of emoji placeholders for a professional look.
 */

const illustrations: Record<string, React.ReactNode> = {
  business_cards: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="30" y="35" width="120" height="72" rx="6" fill="white" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="40" y="30" width="120" height="72" rx="6" fill="white" stroke="#3b82f6" strokeWidth="2" />
      <rect x="52" y="46" width="40" height="4" rx="2" fill="#3b82f6" />
      <rect x="52" y="56" width="60" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="52" y="64" width="48" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="52" y="72" width="55" height="3" rx="1.5" fill="#cbd5e1" />
      <rect x="52" y="80" width="30" height="3" rx="1.5" fill="#cbd5e1" />
      <circle cx="140" cy="62" r="14" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      <path d="M135 62l3 3 7-7" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  premium_business_cards: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="40" y="30" width="120" height="72" rx="6" fill="#f8fafc" stroke="#6366f1" strokeWidth="2" />
      <rect x="40" y="30" width="120" height="20" rx="6" fill="#6366f1" />
      <rect x="40" y="44" width="120" height="6" fill="#6366f1" />
      <rect x="52" y="60" width="50" height="4" rx="2" fill="#6366f1" />
      <rect x="52" y="70" width="70" height="3" rx="1.5" fill="#a5b4fc" />
      <rect x="52" y="78" width="55" height="3" rx="1.5" fill="#c7d2fe" />
      <path d="M130 70l6-8 6 8h-3v8h-6v-8h-3z" fill="#eab308" />
      <circle cx="136" cy="86" r="4" fill="#fde68a" stroke="#eab308" strokeWidth="1" />
    </svg>
  ),
  stickers: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="100" cy="65" r="40" fill="#fef9c3" stroke="#eab308" strokeWidth="2" />
      <circle cx="70" cy="50" r="18" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="130" cy="50" r="15" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="85" y="90" width="30" height="20" rx="4" fill="white" stroke="#d97706" strokeWidth="1.5" />
      <path d="M92 97h16M92 103h10" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M100 35l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" fill="#f59e0b" />
    </svg>
  ),
  die_cut_stickers: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M100 25c20 0 38 8 50 25s8 38-5 52-35 18-50 18-33-5-45-18-17-35-5-52S80 25 100 25z" fill="#fffbeb" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3" />
      <path d="M80 60l10 10 20-20" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="60" y="95" width="80" height="2" rx="1" fill="#fde68a" />
      <text x="70" y="115" fill="#92400e" fontSize="10" fontFamily="system-ui" fontWeight="600">CUSTOM CUT</text>
    </svg>
  ),
  flyers: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="55" y="20" width="90" height="110" rx="4" fill="white" stroke="#10b981" strokeWidth="2" />
      <rect x="65" y="30" width="70" height="30" rx="3" fill="#d1fae5" />
      <rect x="65" y="68" width="50" height="4" rx="2" fill="#10b981" />
      <rect x="65" y="78" width="70" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="65" y="86" width="60" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="65" y="94" width="65" height="3" rx="1.5" fill="#cbd5e1" />
      <rect x="65" y="108" width="35" height="12" rx="3" fill="#10b981" />
      <text x="70" y="117" fill="white" fontSize="8" fontFamily="system-ui" fontWeight="600">ORDER</text>
    </svg>
  ),
  brochures: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="35" y="25" width="55" height="90" rx="3" fill="white" stroke="#14b8a6" strokeWidth="1.5" />
      <rect x="72" y="25" width="55" height="90" rx="3" fill="white" stroke="#14b8a6" strokeWidth="1.5" />
      <rect x="110" y="25" width="55" height="90" rx="3" fill="white" stroke="#14b8a6" strokeWidth="2" />
      <rect x="42" y="33" width="40" height="18" rx="2" fill="#ccfbf1" />
      <rect x="42" y="57" width="35" height="2.5" rx="1" fill="#94a3b8" />
      <rect x="42" y="63" width="38" height="2.5" rx="1" fill="#cbd5e1" />
      <rect x="79" y="33" width="40" height="18" rx="2" fill="#ccfbf1" />
      <rect x="79" y="57" width="35" height="2.5" rx="1" fill="#94a3b8" />
      <rect x="117" y="33" width="40" height="18" rx="2" fill="#99f6e4" />
      <rect x="117" y="57" width="35" height="2.5" rx="1" fill="#14b8a6" />
      <rect x="117" y="63" width="38" height="2.5" rx="1" fill="#94a3b8" />
      <path d="M72 25v90M110 25v90" stroke="#14b8a6" strokeWidth="1" strokeDasharray="4 2" />
    </svg>
  ),
  postcards: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="30" y="30" width="140" height="85" rx="6" fill="white" stroke="#ec4899" strokeWidth="2" />
      <line x1="100" y1="38" x2="100" y2="107" stroke="#fce7f3" strokeWidth="1.5" />
      <rect x="40" y="38" width="50" height="60" rx="3" fill="#fce7f3" />
      <path d="M50 88h30M50 94h20" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="110" y="45" width="45" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="110" y="53" width="50" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="110" y="61" width="40" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="140" y="80" width="18" height="18" rx="2" fill="#fce7f3" stroke="#ec4899" strokeWidth="1" />
      <path d="M144 84l4 4 6-6" stroke="#ec4899" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  posters: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="50" y="10" width="100" height="120" rx="4" fill="white" stroke="#8b5cf6" strokeWidth="2" />
      <rect x="58" y="18" width="84" height="50" rx="3" fill="#ede9fe" />
      <circle cx="80" cy="43" r="12" fill="#c4b5fd" />
      <path d="M75 58l15-20 15 20" fill="#ddd6fe" />
      <path d="M90 58l12-15 12 15" fill="#c4b5fd" />
      <rect x="58" y="76" width="60" height="5" rx="2.5" fill="#8b5cf6" />
      <rect x="58" y="88" width="84" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="58" y="96" width="70" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="58" y="104" width="84" height="3" rx="1.5" fill="#cbd5e1" />
      <rect x="58" y="116" width="40" height="8" rx="2" fill="#8b5cf6" />
    </svg>
  ),
  banners: (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="75" y="10" width="50" height="110" rx="4" fill="white" stroke="#ef4444" strokeWidth="2" />
      <rect x="82" y="18" width="36" height="24" rx="2" fill="#fee2e2" />
      <rect x="82" y="50" width="30" height="3" rx="1.5" fill="#ef4444" />
      <rect x="82" y="58" width="36" height="2.5" rx="1" fill="#94a3b8" />
      <rect x="82" y="65" width="28" height="2.5" rx="1" fill="#94a3b8" />
      <rect x="82" y="72" width="33" height="2.5" rx="1" fill="#cbd5e1" />
      <rect x="85" y="85" width="30" height="10" rx="3" fill="#ef4444" />
      <text x="91" y="93" fill="white" fontSize="7" fontFamily="system-ui" fontWeight="600">CTA</text>
      <rect x="95" y="120" width="10" height="15" rx="1" fill="#94a3b8" />
      <rect x="90" y="135" width="20" height="3" rx="1" fill="#64748b" />
    </svg>
  ),
}

export default function ProductImage({ category, className = '' }: { category: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center p-6 ${className}`}>
      {illustrations[category] ?? (
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <rect x="50" y="30" width="100" height="80" rx="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
          <text x="100" y="75" textAnchor="middle" fill="#94a3b8" fontSize="14" fontFamily="system-ui">Product</text>
        </svg>
      )}
    </div>
  )
}
