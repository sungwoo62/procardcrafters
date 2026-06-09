// OMO-2774: 에스컬레이션 알림 — Telegram allpackmeister_bot
//
// 환경변수:
//   TELEGRAM_BOT_TOKEN   — allpackmeister_bot 토큰 (없으면 no-op, throw 안 함)
//   TELEGRAM_OWNER_CHAT_ID — 사장님 chat_id
//
// 키가 없으면 발송을 건너뛰되 파이프라인은 막지 않는다(가드레일은 DB 큐가 책임).

export type FetchFn = typeof fetch;

export interface TelegramResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendTelegram(
  text: string,
  deps: { fetchFn?: FetchFn; token?: string; chatId?: string } = {}
): Promise<TelegramResult> {
  const token = deps.token ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = deps.chatId ?? process.env.TELEGRAM_OWNER_CHAT_ID;
  const doFetch = deps.fetchFn ?? fetch;

  if (!token || !chatId) {
    console.warn("[telegram] 토큰/chat_id 미설정 — 알림 생략");
    return { ok: true, skipped: true };
  }

  try {
    const res = await doFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `telegram_${res.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `telegram_failed: ${(e as Error).message}` };
  }
}
