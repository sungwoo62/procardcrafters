import type { Metadata } from "next";
import { Suspense } from "react";
import BetaTesterForm from "./BetaTesterForm";
import PixelTrack from "./PixelTrack";

export const metadata: Metadata = {
  title: "베타 테스터 모집 — ProCardCrafters",
  description:
    "런칭 전 무료 샘플을 받고 솔직한 후기를 남길 베타 테스터를 모집합니다. 한국 내 배송, FTC §255.5 공시 안내 포함.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BetaTesterPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
      <PixelTrack event="ViewContent" contentName="beta_tester_landing" />
      <header className="mb-8">
        <p className="text-sm text-neutral-500 mb-2">Pre-launch · Beta Tester Program</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 mb-3">
          런칭 전, 진짜 후기를 들려주실 분을 모십니다
        </h1>
        <p className="text-neutral-700 leading-relaxed">
          ProCardCrafters는 명함·전단지·엽서·친환경 스티커를 합리적인 가격에 만드는
          프린트 스튜디오입니다. 정식 런칭에 앞서, 실제 인쇄물을 받아 보시고
          <strong> 솔직한 사용 후기</strong>를 남겨주실 베타 테스터를 모집합니다.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        <Pillar title="무료 샘플" body="선정되시면 신청하신 품목 1종을 무료로 보내드립니다." />
        <Pillar title="솔직한 리뷰" body="7일 이내 사용 후기를 자유롭게 작성해 주세요." />
        <Pillar title="공시 자동 표기" body="FTC §255.5에 따라 무료 제공 표기가 자동 추가됩니다." />
      </section>

      <section className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 mb-10">
        <h2 className="text-base font-semibold text-neutral-900 mb-2">
          공시(Disclosure) 안내
        </h2>
        <p className="text-sm text-neutral-700 leading-relaxed">
          선정 시 <strong>무료 제품</strong>을 받고 <strong>7일 이내에 솔직한 리뷰</strong>를
          작성하는 조건입니다. 리뷰에는 미국 FTC §255.5(Endorsement Guides)에 따라
          <strong> &ldquo;무료 제공 받음&rdquo; 표기가 자동으로 붙습니다</strong>.
          평점이나 우호적 내용은 요구하지 않습니다 — 사용해 보고 느낀 그대로,
          개선이 필요한 부분도 있는 그대로 적어 주시면 됩니다.
        </p>
      </section>

      <Suspense fallback={<div className="text-sm text-neutral-500">폼을 불러오는 중...</div>}>
        <BetaTesterForm />
      </Suspense>
    </div>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-neutral-200 rounded-xl p-4">
      <div className="text-sm font-semibold text-neutral-900 mb-1">{title}</div>
      <div className="text-xs text-neutral-600 leading-relaxed">{body}</div>
    </div>
  );
}
