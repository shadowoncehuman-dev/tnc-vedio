export type VideoProvider = "fs" | "vimeo" | "youtube" | "direct";

/**
 * Build an embeddable URL for a lecture.
 *
 * TNC's wrapper pages (videoplay.tncnursing.in/videos/fs/ and .../videos/vimeo/)
 * send `X-Frame-Options: SAMEORIGIN`, so they can never render inside an iframe
 * on another domain. We bypass them and embed the underlying providers directly,
 * which allow cross-origin embedding.
 */
export function getVideoEmbedUrl(provider: VideoProvider, videoId: string): string {
  switch (provider) {
    case "fs":
      // FastStream CDN player (Content-Security-Policy: frame-ancestors *)
      return `https://fs-stream.net/video/8KHkEmpcrjoDH9OAlRMxr6d7jcrYdjOo/1681712213826_R9nD/${videoId}`;

    case "vimeo": {
      // Extract numeric Vimeo ID if a full link was passed
      const cleanId = videoId.match(/(\d{5,})/)?.[1] ?? videoId;
      return `https://player.vimeo.com/video/${cleanId}?app_id=58479`;
    }

    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;

    default:
      return "";
  }
}

export function extractYouTubeId(value: string | null | undefined): string | null {
  if (!value) return null;
  return (
    value.match(
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    )?.[1] ?? null
  );
}

export function extractVimeoId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.match(/(\d{5,})/)?.[1] ?? null;
}

export interface LectureVideoSource {
  videoUrl?: string | null;
  firebaseId?: string | null;
  videoProvider?: string | null;
  videoId?: string | null;
}

/** Resolve which provider to embed, preferring the backend's explicit value. */
export function resolveVideoProvider(session: LectureVideoSource): VideoProvider | null {
  const declared = session.videoProvider;
  if (declared === "fs" || declared === "vimeo" || declared === "youtube" || declared === "direct") {
    return declared;
  }
  if (session.firebaseId) return "fs";
  const url = session.videoUrl ?? "";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/youtu\.?be/i.test(url)) return "youtube";
  return url ? "direct" : null;
}

/** Resolve the provider-specific video id used to build the embed URL. */
export function resolveVideoId(provider: VideoProvider | null, session: LectureVideoSource): string {
  if (!provider) return "";
  if (session.videoId) return session.videoId;
  if (provider === "fs") return session.firebaseId ?? "";
  if (provider === "vimeo") return extractVimeoId(session.videoUrl) ?? "";
  if (provider === "youtube") return extractYouTubeId(session.videoUrl) ?? "";
  return "";
}
