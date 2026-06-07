import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import FreeShippingBanner from '@/components/FreeShippingBanner'
import SeasonalToast from '@/components/SeasonalToast'
import SocialProofToast from '@/components/SocialProofToast'
import CouponPopup from '@/components/CouponPopup'
import { getActiveCampaigns, getCampaignPriority, getTopPromoCode } from '@/lib/promotion-engine'
import type { Campaign } from '@/lib/promotion-engine'

// 마케팅 트래킹 env (NEXT_PUBLIC_* 라야 브라우저 노출).
// 없으면 해당 라이브러리 로드 안 함 (안전 폴백).
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const GTM_CONTAINER_ID  = process.env.NEXT_PUBLIC_GTM_ID || process.env.NEXT_PUBLIC_GTM_CONTAINER_ID
const META_PIXEL_ID     = process.env.NEXT_PUBLIC_META_PIXEL_ID
const TIKTOK_PIXEL_ID   = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID
const GOOGLE_ADS_ID     = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
const CLARITY_PROJECT   = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
const USE_GTM_PRIMARY = Boolean(GTM_CONTAINER_ID)

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

// `||` 사용 주의: 빈 문자열("") env 도 폴백시켜야 함.
// `??` 는 ""를 유효값으로 통과시켜 `new URL("")` 빌드 크래시 + 잘못된 canonical 을 유발한다(OMO-2561).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://procardcrafters.com'

// GSC 소유권 인증용 토큰. 값이 있으면 <meta name="google-site-verification"> 자동 삽입.
// 보드가 토큰만 제공하면 에이전트가 env 주입 + 재배포로 인증 완료 가능(OMO-2561).
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Procardcrafters — Premium Print On Demand',
    template: '%s | Procardcrafters',
  },
  description: 'High-quality business cards, stickers, flyers, postcards, and posters produced at certified global print facilities and delivered worldwide.',
  keywords: ['business cards', 'stickers', 'flyers', 'postcards', 'posters', 'print on demand'],
  openGraph: {
    type: 'website',
    siteName: 'Procardcrafters',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — produced at certified global print facilities and delivered worldwide.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Procardcrafters — Premium Print On Demand',
    description: 'Business cards, stickers, flyers, postcards, and posters — produced at certified global print facilities and delivered worldwide.',
  },
  robots: { index: true, follow: true },
  ...(GOOGLE_SITE_VERIFICATION
    ? { verification: { google: GOOGLE_SITE_VERIFICATION } }
    : {}),
}

export interface ProductCardData {
  image: string | null
  description: string | null
}

async function fetchProductCardData(): Promise<Record<string, ProductCardData>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return {}
  try {
    const res = await fetch(
      `${url}/rest/v1/print_products?select=slug,hero_image_url,description_en&is_active=eq.true`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      },
    )
    if (!res.ok) return {}
    const data: Array<{ slug: string; hero_image_url: string | null; description_en: string | null }> = await res.json()
    return Object.fromEntries(
      data.map(r => [r.slug, { image: r.hero_image_url ?? null, description: r.description_en ?? null }]),
    )
  } catch {
    return {}
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [productData, rawCampaigns] = await Promise.all([
    fetchProductCardData(),
    getActiveCampaigns().catch((): Campaign[] => []),
  ])
  const activeCampaigns = [...rawCampaigns].sort(
    (a, b) => getCampaignPriority(b.calendar.key) - getCampaignPriority(a.calendar.key),
  )
  const primaryCampaign = activeCampaigns[0] ?? null
  const primaryPromoCode = primaryCampaign
    ? await getTopPromoCode(primaryCampaign.id).catch(() => null)
    : null
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        {/* GA4 / Google Ads gtag (env 가 있을 때만 로드) */}
        {!USE_GTM_PRIMARY && (GA_MEASUREMENT_ID || GOOGLE_ADS_ID) && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID ?? GOOGLE_ADS_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}', { page_path: window.location.pathname });` : ''}
              ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
            `}</Script>
          </>
        )}

        {/* Google Tag Manager (별도 컨테이너) */}
        {GTM_CONTAINER_ID && (
          <Script id="gtm-init" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');
          `}</Script>
        )}

        {/* Meta Pixel (Facebook / Instagram 광고) */}
        {META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}</Script>
        )}

        {/* TikTok Pixel */}
        {TIKTOK_PIXEL_ID && (
          <Script id="tiktok-pixel" strategy="afterInteractive">{`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('${TIKTOK_PIXEL_ID}');
              ttq.page();
            }(window, document, 'ttq');
          `}</Script>
        )}

        {/* Microsoft Clarity (heatmaps / session replay) */}
        {CLARITY_PROJECT && (
          <Script id="clarity-init" strategy="afterInteractive">{`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_PROJECT}");
          `}</Script>
        )}
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        {/* GTM noscript fallback */}
        {GTM_CONTAINER_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
              height="0" width="0" style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {/* Meta Pixel noscript fallback */}
        {META_PIXEL_ID && (
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        )}
        <FreeShippingBanner />
        <Header productData={productData} activeCampaigns={activeCampaigns} />
        <main className="flex-1">{children}</main>
        <Footer />
        <ChatWidget />
        {primaryCampaign && (
          <SeasonalToast campaign={primaryCampaign} promoCode={primaryPromoCode?.code ?? null} />
        )}
        <CouponPopup />
        <SocialProofToast />
      </body>
    </html>
  )
}
