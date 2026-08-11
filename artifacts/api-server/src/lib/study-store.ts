import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-server";

function ensureClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured on server");
  return getSupabaseAdmin();
}

export interface StudySessionSummary {
  telegramId: string;
  firstName: string;
  username: string | null;
  seconds: number;
  sessions: number;
}

export async function recordStudyHeartbeat(input: {
  telegramId: number;
  sessionId: string;
  seconds: number;
}): Promise<void> {
  const seconds = Math.min(Math.max(Math.round(input.seconds), 0), 300);
  if (!seconds) return;
  const supabase = ensureClient();
  const { error } = await supabase.rpc("record_study_time", {
    p_telegram_id: input.telegramId,
    p_session_id: input.sessionId,
    p_seconds: seconds,
  });
  if (error) throw error;
}

export async function getLeaderboard(limit = 20): Promise<StudySessionSummary[]> {
  const rows = await supabaseRequest<Array<{
    telegram_id: number | string;
    first_name: string;
    username: string | null;
    seconds: number;
    sessions: number;
  }>>(
    `study_leaderboard?select=telegram_id,first_name,username,seconds,sessions&limit=${Math.min(limit, 100)}`,
  );
  return rows.map((row) => ({
    telegramId: String(row.telegram_id),
    firstName: row.first_name,
    username: row.username,
    seconds: Number(row.seconds),
    sessions: Number(row.sessions),
  }));
}
