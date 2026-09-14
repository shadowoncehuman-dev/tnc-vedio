import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-server";
import { supabaseRequest } from "./supabase-rest";

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

export interface WebsiteStudyHeartbeat {
  visitorId: string;
  visitorName: string;
  sessionId: string;
  seconds: number;
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

export async function recordWebsiteStudyHeartbeat(input: WebsiteStudyHeartbeat): Promise<void> {
  const seconds = Math.min(Math.max(Math.round(input.seconds), 0), 300);
  const visitorId = input.visitorId.trim().slice(0, 120);
  const visitorName = input.visitorName.trim().slice(0, 80);
  if (!seconds || !visitorId || !visitorName || !input.sessionId) return;
  await supabaseRequest("rpc/record_website_study_time", {
    method: "POST",
    body: JSON.stringify({
      p_visitor_id: visitorId,
      p_visitor_name: visitorName,
      p_session_id: input.sessionId,
      p_seconds: seconds,
    }),
  });
}

export async function getLeaderboard(limit = 20): Promise<StudySessionSummary[]> {
  const rows = await supabaseRequest<Array<{
    participant_id: number | string;
    first_name: string;
    username: string | null;
    seconds: number;
    sessions: number;
  }>>(
    `study_leaderboard?select=participant_id,first_name,username,seconds,sessions&order=seconds.desc&limit=${Math.min(limit, 100)}`,
  );
  return rows.map((row) => ({
    telegramId: String(row.participant_id),
    firstName: row.first_name,
    username: row.username,
    seconds: Number(row.seconds),
    sessions: Number(row.sessions),
  }));
}
