import { getSupabaseAdmin, isSupabaseConfigured } from "./supabase-server";

function ensureClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured on server");
  return getSupabaseAdmin();
}

export async function claimComebackNotification(): Promise<boolean> {
  const { data, error } = await ensureClient().rpc("claim_bot_comeback_notification");
  if (error) throw error;
  return data === true;
}

export async function logBroadcast(input: {
  adminTelegramId: number;
  contentType: string;
  messageText?: string | null;
  mediaUrl?: string | null;
  mediaType?: "photo" | "video" | "document" | "mixed" | null;
  totalRecipients: number;
  successfulSends: number;
  failedSends: number;
}): Promise<void> {
  const supabase = ensureClient();
  const payload = {
    admin_telegram_id: input.adminTelegramId,
    content_type: input.contentType,
    message_text: input.messageText ?? null,
    media_url: input.mediaUrl ?? null,
    media_type: input.mediaType ?? null,
    total_recipients: input.totalRecipients,
    successful_sends: input.successfulSends,
    failed_sends: input.failedSends,
  };
  const { error } = await supabase.from("broadcast_logs").insert(payload);
  if (error) {
    // Don't throw — logging failure shouldn't stop the main flow
    console.error("Failed to log broadcast", error);
  }
}
