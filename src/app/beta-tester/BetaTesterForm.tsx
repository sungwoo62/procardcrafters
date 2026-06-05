"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 폴백: timestamp + random (구형 브라우저)
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm transition focus:outline-none focus:border-neutral-600";

const SKU_OPTIONS = [
  { value: "business-cards", label: "명함 (Business Cards)" },
  { value: "flyers", label: "전단지 (Flyers)" },
  { value: "postcards", label: "엽서 (Postcards)" },
  { value: "eco-stickers", label: "친환경 스티커 (Eco Stickers)" },
] as const;

const CHANNEL_OPTIONS = [
  { value: "instagram", label: "인스타그램" },
  { value: "x", label: "X (Twitter)" },
  { value: "threads", label: "Threads" },
  { value: "disquiet", label: "디스콰이엇" },
  { value: "dbcut", label: "디비컷" },
  { value: "smb", label: "소상공인 (운영 중)" },
  { value: "friend", label: "지인 추천" },
  { value: "other", label: "기타" },
] as const;

export default function BetaTesterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const utm = {
    utm_source: searchParams.get("utm_source") ?? undefined,
    utm_medium: searchParams.get("utm_medium") ?? undefined,
    utm_campaign: searchParams.get("utm_campaign") ?? undefined,
    utm_term: searchParams.get("utm_term") ?? undefined,
    utm_content: searchParams.get("utm_content") ?? undefined,
  };

  async function onSubmit(formData: FormData) {
    setError(null);

    const eventId = newEventId();
    const preferredSku = formData.get("preferred_sku") as string;
    const channel = (formData.get("channel") as string) || undefined;

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      shipping_address: {
        recipient: String(formData.get("name") ?? "").trim(),
        zip: String(formData.get("zip") ?? "").trim(),
        address1: String(formData.get("address1") ?? "").trim(),
        address2: String(formData.get("address2") ?? "").trim(),
      },
      channel,
      channel_handle:
        String(formData.get("channel_handle") ?? "").trim() || undefined,
      preferred_sku: preferredSku,
      use_case: String(formData.get("use_case") ?? "").trim() || undefined,
      review_commitment: formData.get("review_commitment") === "on",
      disclosure_acknowledged:
        formData.get("disclosure_acknowledged") === "on",
      event_id: eventId,
      ...utm,
    };

    // Meta Pixel Lead — 서버 CAPI 와 동일 eventID 로 dedup (OMO-2427)
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq(
        "track",
        "Lead",
        {
          content_name: "beta_tester_landing",
          content_category: preferredSku,
          channel,
          currency: "USD",
          value: 0,
        },
        { eventID: eventId }
      );
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/beta-applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data?.error ?? "신청 처리 중 오류가 발생했습니다.");
          return;
        }

        router.push("/beta-tester/thank-you");
      } catch {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <Field label="이름" required>
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          className={INPUT_CLASS}
          placeholder="홍길동"
        />
      </Field>

      <Field label="이메일" required>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          className={INPUT_CLASS}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="연락처 (선택)">
        <input
          name="phone"
          type="tel"
          maxLength={50}
          className={INPUT_CLASS}
          placeholder="010-0000-0000"
        />
      </Field>

      <fieldset className="border border-neutral-200 rounded-lg p-4 space-y-3">
        <legend className="text-sm font-medium text-neutral-700 px-2">
          한국 내 배송 주소 (선정 시에만 사용)
        </legend>
        <Field label="우편번호">
          <input
            name="zip"
            type="text"
            maxLength={10}
            className={INPUT_CLASS}
            placeholder="06000"
          />
        </Field>
        <Field label="기본 주소">
          <input
            name="address1"
            type="text"
            maxLength={200}
            className={INPUT_CLASS}
            placeholder="서울특별시 강남구 ..."
          />
        </Field>
        <Field label="상세 주소">
          <input
            name="address2"
            type="text"
            maxLength={200}
            className={INPUT_CLASS}
            placeholder="동·호수"
          />
        </Field>
      </fieldset>

      <Field label="관심 품목" required>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SKU_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 py-2 cursor-pointer hover:border-neutral-400"
            >
              <input
                type="radio"
                name="preferred_sku"
                value={opt.value}
                required
                className="accent-neutral-900"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="활동 채널 (선택)">
        <select name="channel" className={INPUT_CLASS}>
          <option value="">선택 안 함</option>
          {CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="채널 핸들/링크 (선택)">
        <input
          name="channel_handle"
          type="text"
          maxLength={200}
          className={INPUT_CLASS}
          placeholder="@handle 또는 URL"
        />
      </Field>

      <Field label="어떤 용도로 사용하실 예정인가요?">
        <textarea
          name="use_case"
          rows={3}
          maxLength={1000}
          className={INPUT_CLASS}
          placeholder="브랜드/사업 소개, 활용 계획 등을 자유롭게 적어 주세요."
        />
      </Field>

      <div className="space-y-3 border-t border-neutral-200 pt-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="review_commitment"
            required
            className="mt-1 accent-neutral-900"
          />
          <span className="text-sm text-neutral-700">
            수령 후 <strong>7일 이내에 솔직한 사용 후기</strong>를 작성하는 데 동의합니다.
            평점이나 우호적 내용은 요구하지 않으며, 사용해 보고 느낀 그대로 작성하시면 됩니다.
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="disclosure_acknowledged"
            required
            className="mt-1 accent-neutral-900"
          />
          <span className="text-sm text-neutral-700">
            선정 시 무료로 제품을 받게 되며, 리뷰에는 <strong>미국 FTC §255.5</strong>에 따라
            &ldquo;무료 제공 받음&rdquo; 표기가 자동으로 추가된다는 점에 동의합니다.
          </span>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-neutral-900 text-white py-3 font-medium hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {isPending ? "신청 접수 중..." : "베타 테스터 신청하기"}
      </button>

      <p className="text-xs text-neutral-500 text-center">
        배송은 한국 국내 주소로만 가능합니다. 선정 결과는 7월 초에 이메일로 안내드립니다.
      </p>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-neutral-700 mb-1.5">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
