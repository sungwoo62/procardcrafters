import { adminLoginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/admin/beta-applications", error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        action={adminLoginAction}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">관리자 로그인</h1>
        <p className="mt-1 text-sm text-slate-500">
          ADMIN_TOKEN 을 입력하세요.
        </p>

        <input type="hidden" name="next" value={next} />

        <label className="mt-5 block text-sm font-medium text-slate-700">
          토큰
          <input
            type="password"
            name="token"
            autoFocus
            autoComplete="off"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-600">
            토큰이 일치하지 않습니다.
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
