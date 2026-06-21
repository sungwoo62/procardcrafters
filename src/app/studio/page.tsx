// OMO-3684 · Procardcrafters Ad Studio — 인스타 피드 + 메타 광고 콘텐츠 스튜디오.
// 뉴트리바이오비스 광고 스튜디오 참고. 내부용(noindex). 키작업(Meta API/이미지 파이프라인) 이후 실집행 연결.
import type { Metadata } from 'next'
import StudioGallery from '@/components/studio/StudioGallery'
import { INSTAGRAM_POSTS, META_AD_SETS, GENERATED_IMAGE_COUNT } from '@/config/adStudio'

export const metadata: Metadata = {
  title: 'Ad Studio — Procardcrafters',
  description: 'Instagram + Meta ad content studio for Procardcrafters.',
  robots: { index: false, follow: false }, // 내부 콘텐츠 스튜디오
}

const STATS = [
  { value: `${INSTAGRAM_POSTS.length}`, label: '인스타 콘텐츠' },
  { value: `${GENERATED_IMAGE_COUNT}`, label: 'AI 생성 명함 제품샷' },
  { value: `${META_AD_SETS.length}`, label: '메타 광고세트' },
  { value: 'CTR+ROI', label: '평가 지표(META_ADS)' },
]

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-blue-950 via-indigo-900 to-slate-900 px-4 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">OMO-3684 · Ad Studio</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
            인스타 피드 + 메타 광고 콘텐츠 스튜디오
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-blue-100/80">
            뉴트리바이오비스 광고 스튜디오 패턴을 프로카드(미국 명함 POD)에 적용. 명함류 프리미엄 라인업과
            잘나갈 제품을 중심으로 인스타 포스팅 30종 + 메타 광고 30세트를 컨셉·카피·레이아웃까지 완성.
            명함류 {GENERATED_IMAGE_COUNT}종은 AI 생성 실사 제품샷(배경 합성 포함)으로 적용 완료, 나머지는 컨셉 프레임.
            대외 게시는 사람 승인 게이트(OMO-1908).
          </p>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 p-4">
                <p className="text-2xl font-extrabold text-amber-300">{s.value}</p>
                <p className="mt-1 text-[11px] text-blue-100/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StudioGallery />

      <section className="border-t border-slate-200 bg-white px-4 py-10">
        <div className="mx-auto max-w-7xl text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-700">컴플라이언스 가드</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>고객 노출 카피는 영어(미국 B2C). 가짜 후기·근거불명 합산 stat 금지(OMO-2975).</li>
            <li>내부 수량 임계값/전화번호 노출 금지 → 견적·콜백·무료 디자인 CTA(OMO-2760).</li>
            <li>메타 광고 구조·지표는 전사 META_ADS 표준(OMO-3444): 신규=1캠페인-1광고세트-1광고, 평가=CTR+ROI, 예산=CAC×3~5.</li>
            <li>실집행(캠페인 게시)·실사 이미지 생성은 사람 승인 게이트 + 키작업 이후 연결.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
