"use client";

import { useState, useTransition } from "react";
import {
  approveBetaApplication,
  rejectBetaApplication,
} from "./actions";
import {
  CHANNEL_LABELS,
  SKU_LABELS,
  type BetaApplicationRow,
} from "@/lib/beta-applications";

function summaryAddress(addr: Record<string, unknown>): string {
  const city = (addr.city ?? addr.region ?? addr.state) as string | undefined;
  const district = (addr.district ?? addr.gu ?? addr.do) as string | undefined;
  const zip = (addr.zip ?? addr.postal_code ?? addr.postalCode) as
    | string
    | undefined;
  const parts = [district, city, zip].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : "주소 정보 미입력";
}

export default function ApplicationRow({
  app,
  mode,
}: {
  app: BetaApplicationRow;
  mode: "pending" | "approved" | "fulfilled" | "rejected";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const channelLabel =
    (app.channel && CHANNEL_LABELS[app.channel]) ?? app.channel ?? "—";
  const skuLabel = SKU_LABELS[app.preferred_sku] ?? app.preferred_sku;

  const onApprove = () => {
    if (!confirm("이 신청을 승인하고 무상 주문을 생성합니다. 진행할까요?")) {
      return;
    }
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await approveBetaApplication(app.id);
      if (res.ok) {
        setOkMsg(`주문 ${res.orderId.slice(0, 8)}… 생성 완료.`);
      } else {
        setError(res.error);
      }
    });
  };

  const onReject = () => {
    setError(null);
    setOkMsg(null);
    if (!reason.trim()) {
      setError("반려 사유는 필수입니다.");
      return;
    }
    startTransition(async () => {
      const res = await rejectBetaApplication(app.id, reason);
      if (res.ok) {
        setOkMsg("반려 처리되었습니다.");
        setShowReject(false);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {app.name}{" "}
            <span className="text-sm font-normal text-slate-500">
              · {app.email}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            신청 {new Date(app.created_at).toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>
            채널 <span className="font-medium text-slate-800">{channelLabel}</span>
            {app.channel_handle && (
              <span className="ml-1 text-slate-500">{app.channel_handle}</span>
            )}
          </div>
          <div>
            SKU <span className="font-medium text-slate-800">{skuLabel}</span>
          </div>
        </div>
      </header>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            전화
          </dt>
          <dd className="text-slate-800">{app.phone ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            배송 (요약)
          </dt>
          <dd className="text-slate-800">{summaryAddress(app.shipping_address)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          사용 의도
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
          {app.use_case ?? "—"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span
          className={`rounded-full px-2 py-0.5 ${app.review_commitment ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          리뷰 약속 {app.review_commitment ? "✓" : "✗"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 ${app.disclosure_acknowledged ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          FTC disclosure {app.disclosure_acknowledged ? "✓" : "✗"}
        </span>
        {app.utm_source && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            UTM {app.utm_source}
            {app.utm_campaign ? ` · ${app.utm_campaign}` : ""}
          </span>
        )}
      </div>

      {mode === "fulfilled" && app.fulfilled_order_id && (
        <p className="mt-3 text-sm text-slate-700">
          ✓ 무상 주문 생성됨 — print_orders.id{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            {app.fulfilled_order_id.slice(0, 8)}…
          </code>
        </p>
      )}
      {mode === "rejected" && app.rejected_reason && (
        <p className="mt-3 text-sm text-red-700">
          반려 사유: {app.rejected_reason}
        </p>
      )}

      {mode === "pending" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={pending}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            comp 주문 생성
          </button>
          <button
            type="button"
            onClick={() => setShowReject((v) => !v)}
            disabled={pending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      )}

      {showReject && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="block text-sm font-medium text-slate-700">
            반려 사유 (필수)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              placeholder="예: 해외 배송지 / 신원 불명 / SKU 재고 부족 등"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onReject}
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              반려 확정
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReject(false);
                setReason("");
              }}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {okMsg && <p className="mt-2 text-sm text-emerald-700">{okMsg}</p>}
    </article>
  );
}
