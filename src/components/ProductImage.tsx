/**
 * SVG-based product illustrations for each product category.
 * Moo·Vistaprint 스타일 단순 일러스트 — 24 카테고리 커버.
 */

const illustrations: Record<string, React.ReactNode> = {
  business_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="bcShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="118" rx="60" ry="6" fill="url(#bcShadow)" />
      <g transform="translate(0,4)">
        <rect x="28" y="48" width="120" height="68" rx="4" fill="#e2e8f0" />
        <rect x="34" y="42" width="120" height="68" rx="4" fill="#f1f5f9" />
        <rect x="40" y="36" width="120" height="68" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="0.5" />
        <rect x="40" y="36" width="120" height="6" fill="#3b82f6" />
        <text x="52" y="60" fill="#0f172a" fontSize="9" fontWeight="700" fontFamily="ui-sans-serif, system-ui">JANE DOE</text>
        <text x="52" y="72" fill="#64748b" fontSize="6" fontFamily="ui-sans-serif, system-ui">Creative Director</text>
        <rect x="52" y="80" width="60" height="2" rx="1" fill="#94a3b8" />
        <rect x="52" y="86" width="48" height="2" rx="1" fill="#cbd5e1" />
        <rect x="52" y="92" width="55" height="2" rx="1" fill="#cbd5e1" />
        <circle cx="140" cy="78" r="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
        <path d="M136 78l3 3 5-6" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  ),
  premium_business_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="pbcShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pbcCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="118" rx="60" ry="6" fill="url(#pbcShadow)" />
      <g transform="translate(0,4)">
        <rect x="28" y="48" width="120" height="68" rx="4" fill="#312e81" opacity="0.4" />
        <rect x="34" y="42" width="120" height="68" rx="4" fill="#312e81" opacity="0.7" />
        <rect x="40" y="36" width="120" height="68" rx="4" fill="url(#pbcCard)" />
        <text x="52" y="62" fill="#fde68a" fontSize="9" fontWeight="700" fontFamily="serif" letterSpacing="1">A. MILLER</text>
        <rect x="52" y="68" width="40" height="0.7" fill="#fbbf24" />
        <text x="52" y="80" fill="#e0e7ff" fontSize="5.5" fontFamily="serif">Founder &amp; Principal</text>
        <text x="52" y="92" fill="#a5b4fc" fontSize="4.5" fontFamily="serif">miller@studio.com</text>
        <path d="M133 80l4-6 4 6h-2v6h-4v-6h-2z" fill="#fbbf24" />
        <circle cx="137" cy="92" r="2.5" fill="#fde68a" />
      </g>
    </svg>
  ),
  premium_foil_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="30%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="foilShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="118" rx="62" ry="6" fill="url(#foilShadow)" />
      <g transform="translate(0,4)">
        <rect x="28" y="48" width="120" height="68" rx="4" fill="#111827" opacity="0.6" />
        <rect x="34" y="42" width="120" height="68" rx="4" fill="#1f2937" opacity="0.85" />
        <rect x="40" y="36" width="120" height="68" rx="4" fill="#111827" />
        <text x="52" y="64" fill="url(#foil)" fontSize="10" fontWeight="700" fontFamily="serif" letterSpacing="2">LUXE</text>
        <rect x="52" y="70" width="45" height="0.8" fill="url(#foil)" />
        <text x="52" y="82" fill="#9ca3af" fontSize="5" fontFamily="serif">Boutique Studio</text>
        <text x="52" y="92" fill="#6b7280" fontSize="4.5" fontFamily="serif">est. 2024</text>
        <circle cx="135" cy="78" r="11" fill="url(#foil)" opacity="0.95" />
        <path d="M131 76l4 4 6-7" stroke="#111827" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  ),
  letterpress_cards: (
    <svg viewBox="0 0 200 140" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="lpShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lpEmboss" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#a8a29e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#a8a29e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="118" rx="62" ry="6" fill="url(#lpShadow)" />
      <g transform="translate(0,4)">
        <rect x="28" y="48" width="120" height="68" rx="3" fill="#e7e5e4" />
        <rect x="34" y="42" width="120" height="68" rx="3" fill="#f5f5f4" />
        <rect x="40" y="36" width="120" height="68" rx="3" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="0.5" />
        <ellipse cx="100" cy="70" rx="40" ry="20" fill="url(#lpEmboss)" />
        <text x="100" y="65" fill="#1c1917" fontSize="11" fontWeight="700" fontFamily="serif" textAnchor="middle" letterSpacing="3">CRANE</text>
        <rect x="80" y="69" width="40" height="0.6" fill="#1c1917" />
        <text x="100" y="78" fill="#44403c" fontSize="4.5" fontFamily="serif" textAnchor="middle" letterSpacing="1.5">FINE PRINTING</text>
        <text x="100" y="92" fill="#78716c" fontSize="4" fontFamily="serif" textAnchor="middle">600gsm · Cotton · Letterpress</text>
      </g>
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
      <defs>
        <linearGradient id="gcShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gcCard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffaf5" />
          <stop offset="100%" stopColor="#fde4d8" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="125" rx="55" ry="5" fill="url(#gcShadow)" />
      <g transform="translate(0,2)">
        <rect x="50" y="22" width="100" height="100" rx="3" fill="url(#gcCard)" stroke="#f9a8d4" strokeWidth="0.8" />
        {/* 모서리 장식 — 청첩장/초청장 무드 */}
        <path d="M62 32 Q70 26 80 32" stroke="#ec4899" strokeWidth="0.8" fill="none" opacity="0.5" />
        <path d="M120 32 Q130 26 138 32" stroke="#ec4899" strokeWidth="0.8" fill="none" opacity="0.5" />
        <path d="M62 112 Q70 118 80 112" stroke="#ec4899" strokeWidth="0.8" fill="none" opacity="0.5" />
        <path d="M120 112 Q130 118 138 112" stroke="#ec4899" strokeWidth="0.8" fill="none" opacity="0.5" />
        {/* 꽃잎 모티프 */}
        <g opacity="0.75">
          <path d="M100 48 Q92 52 96 60 Q104 56 100 48 Z" fill="#fbcfe8" />
          <path d="M100 48 Q108 52 104 60 Q96 56 100 48 Z" fill="#f9a8d4" />
          <circle cx="100" cy="56" r="2" fill="#ec4899" />
        </g>
        <text x="100" y="76" fill="#831843" fontSize="9" fontWeight="700" fontFamily="serif" textAnchor="middle" letterSpacing="2">FOREVER</text>
        <text x="100" y="86" fill="#9d174d" fontSize="6" fontFamily="serif" textAnchor="middle" fontStyle="italic">Sarah &amp; James</text>
        <rect x="80" y="92" width="40" height="0.5" fill="#ec4899" opacity="0.6" />
        <text x="100" y="102" fill="#be185d" fontSize="4.5" fontFamily="serif" textAnchor="middle" letterSpacing="1">JUNE 14, 2026</text>
      </g>
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
