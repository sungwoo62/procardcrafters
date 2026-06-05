import type { Metadata } from "next";
import Link from "next/link";
import PixelTrack from "../PixelTrack";

export const metadata: Metadata = {
  title: "신청이 접수되었습니다 — ProCardCrafters",
  robots: {
    index: false,
    follow: false,
  },
};

export default function BetaTesterThankYouPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
      <PixelTrack event="CompleteRegistration" contentName="beta_tester_landing" />
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-3">
        신청이 접수되었습니다
      </h1>
      <p className="text-neutral-700 leading-relaxed mb-6">
        ProCardCrafters 베타 테스터 모집에 신청해 주셔서 감사합니다.
        <br />
        <strong>선정 결과는 7월 초에 이메일로 안내</strong>드립니다.
      </p>

      <div className="text-left bg-neutral-50 border border-neutral-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">앞으로의 진행</h2>
        <ol className="text-sm text-neutral-700 space-y-1.5 list-decimal list-inside">
          <li>신청 검토 후 7월 초 선정 결과 이메일 안내</li>
          <li>선정 시 한국 내 주소로 무료 샘플 발송</li>
          <li>수령 후 7일 이내 솔직한 사용 후기 작성</li>
          <li>리뷰에는 FTC §255.5 무료 제공 표기 자동 추가</li>
        </ol>
      </div>

      <p className="text-sm text-neutral-500 mb-8">
        확인 이메일이 도착하지 않았다면 스팸함을 확인해 주세요.
      </p>

      <Link
        href="/"
        className="inline-block rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 transition"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
