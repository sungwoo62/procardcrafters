import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import {
  ADMIN_TAB_STATUSES,
  CHANNEL_LABELS,
  getServiceSupabase,
  type AdminTabStatus,
  type BetaApplicationRow,
} from "@/lib/beta-applications";
import { adminLogoutAction } from "../login/actions";
import ApplicationRow from "./ApplicationRow";

export const dynamic = "force-dynamic";

const TAB_LABELS: Record<AdminTabStatus, string> = {
  pending: "검토 대기",
  approved: "승인됨",
  fulfilled: "발송 완료",
  rejected: "반려",
};

interface MonitoringSnapshot {
  last7Days: { date: string; fulfilled: number }[];
  perChannel: {
    channel: string;
    applied: number;
    fulfilled: number;
    rate: number;
  }[];
  totals: Record<AdminTabStatus | "all", number>;
}

async function fetchTabData(status: AdminTabStatus): Promise<BetaApplicationRow[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("print_beta_applications")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: status === "fulfilled" ? false : true })
    .limit(200);
  if (error) {
    console.error("[beta-applications] fetch failed", error);
    return [];
  }
  return (data ?? []) as BetaApplicationRow[];
}

async function fetchMonitoring(): Promise<MonitoringSnapshot> {
  const supabase = getServiceSupabase();

  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("print_beta_applications")
    .select("status, approved_at, channel")
    .gte("created_at", sevenAgo)
    .limit(2000);

  const totals: Record<AdminTabStatus | "all", number> = {
    pending: 0,
    approved: 0,
    fulfilled: 0,
    rejected: 0,
    all: 0,
  };
  for (const s of ADMIN_TAB_STATUSES) totals[s] = 0;

  const { data: counts } = await supabase
    .from("print_beta_applications")
    .select("status")
    .limit(10000);
  for (const r of counts ?? []) {
    totals.all++;
    if (ADMIN_TAB_STATUSES.includes(r.status as AdminTabStatus)) {
      totals[r.status as AdminTabStatus]++;
    }
  }

  const days: { date: string; fulfilled: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), fulfilled: 0 });
  }
  for (const row of recent ?? []) {
    if (row.status !== "fulfilled" || !row.approved_at) continue;
    const key = row.approved_at.slice(0, 10);
    const slot = days.find((d) => d.date === key);
    if (slot) slot.fulfilled++;
  }

  const { data: allByChannel } = await supabase
    .from("print_beta_applications")
    .select("channel, status")
    .limit(10000);
  const channelMap = new Map<string, { applied: number; fulfilled: number }>();
  for (const row of allByChannel ?? []) {
    const ch = row.channel ?? "unknown";
    const slot = channelMap.get(ch) ?? { applied: 0, fulfilled: 0 };
    slot.applied++;
    if (row.status === "fulfilled") slot.fulfilled++;
    channelMap.set(ch, slot);
  }
  const perChannel = Array.from(channelMap.entries())
    .map(([channel, s]) => ({
      channel,
      applied: s.applied,
      fulfilled: s.fulfilled,
      rate: s.applied > 0 ? s.fulfilled / s.applied : 0,
    }))
    .sort((a, b) => b.applied - a.applied);

  return { last7Days: days, perChannel, totals };
}

export default async function BetaApplicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isAdmin())) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin/beta-applications")}`);
  }

  const sp = await searchParams;
  const tab: AdminTabStatus =
    (ADMIN_TAB_STATUSES as readonly string[]).includes(sp.tab ?? "")
      ? (sp.tab as AdminTabStatus)
      : "pending";

  const [rows, monitoring] = await Promise.all([
    fetchTabData(tab),
    fetchMonitoring(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            베타 테스터 신청 큐
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            OMO-2411 캠페인 · 보드 승인 2026-06-05 · 1인 1발송 / FTC §255.5 disclosure 강제
          </p>
        </div>
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="text-sm text-slate-500 underline hover:text-slate-900"
          >
            로그아웃
          </button>
        </form>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {ADMIN_TAB_STATUSES.map((status) => {
              const active = status === tab;
              return (
                <Link
                  key={status}
                  href={`/admin/beta-applications?tab=${status}`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {TAB_LABELS[status]}
                  <span
                    className={`ml-2 inline-block rounded-full px-2 text-xs ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {monitoring.totals[status]}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-3">
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                현재 탭에 신청이 없습니다.
              </p>
            ) : (
              rows.map((app) => (
                <ApplicationRow key={app.id} app={app} mode={tab} />
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              선정 기준 체크리스트
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>✅ 명확한 사용 의도 (예: &ldquo;스튜디오 명함 100장&rdquo;)</li>
              <li>✅ 사진/스토리 공유 의향</li>
              <li>✅ D+7 ~ D+14 리뷰 작성 약속 체크</li>
              <li>✅ 디자이너 · 1인 브랜드 · 소상공인 우대</li>
              <li>✅ 한국 국내 주소만</li>
              <li>❌ 우리 제품 리뷰 이력 (중복 disclosure)</li>
              <li>❌ 익명 / 신원불명 신청</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              플레이북 §4 — OMO-2411
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              일일 발송 페이스 (7일)
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {monitoring.last7Days.map((d) => (
                <li
                  key={d.date}
                  className="flex justify-between text-slate-700"
                >
                  <span>{d.date}</span>
                  <span className="font-medium">{d.fulfilled}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              타겟 페이스 25/일 · 플레이북 §7
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">
              채널별 응답률
            </h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-1">채널</th>
                  <th className="pb-1 text-right">신청</th>
                  <th className="pb-1 text-right">발송</th>
                  <th className="pb-1 text-right">전환</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monitoring.perChannel.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-3 text-center text-slate-500"
                    >
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  monitoring.perChannel.map((c) => (
                    <tr key={c.channel}>
                      <td className="py-1.5 text-slate-700">
                        {CHANNEL_LABELS[c.channel] ?? c.channel}
                      </td>
                      <td className="py-1.5 text-right">{c.applied}</td>
                      <td className="py-1.5 text-right">{c.fulfilled}</td>
                      <td className="py-1.5 text-right text-slate-700">
                        {(c.rate * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </aside>
      </section>
    </main>
  );
}
