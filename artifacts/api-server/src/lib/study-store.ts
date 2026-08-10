import { supabaseRequest } from "./supabase-rest";

export async function recordStudyHeartbeat(input: {
  telegramId: number;
  sessionId: string;
  seconds: number;
}): Promise<void> {
  const seconds = Math.min(Math.max(Math.round(input.seconds), 0), 300);
  if (!seconds) return;
  await supabaseRequest("rpc/record_study_time", {
    method: "POST",
    body: JSON.stringify({
      p_telegram_id: input.telegramId,
      p_session_id: input.sessionId,
      p_seconds: seconds,
    }),
  });
}

export async function getLeaderboard(limit = 20): Promise<Array<{
  telegramId: string;
  firstName: string;
  username: string | null;
  seconds: number;
}>> {
  const rows = await supabaseRequest<Array<{
    telegram_id: number | string;
    first_name: string;
    username: string | null;
    seconds: number;
  }>>(
    `study_leaderboard?select=telegram_id,first_name,username,seconds&limit=${Math.min(limit, 100)}`,
  );
  return rows.map((row) => ({
    telegramId: String(row.telegram_id),
    firstName: row.first_name,
    username: row.username,
    seconds: Number(row.seconds),
  }));
}
