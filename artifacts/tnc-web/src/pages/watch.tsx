import { useParams, Link } from "wouter";
import { useEffect, useRef, useState, useCallback } from "react";
import { useGetSession, useGetPromoStatus, useGetUserPurchases, getGetUserPurchasesQueryKey, useListSessions, getListSessionsQueryKey } from "@/lib/api-client";
import { ArrowLeft, Lock, Video, FileText, AlertCircle, ChevronRight, PlayCircle, ShieldAlert } from "lucide-react";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { markVideoWatched } from "@/lib/streak";
import { getFirebaseVideoUrl, sendOtp, confirmOtp, isFirebaseSignedIn } from "@/lib/firebase";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function getApiUrl(path: string) {
  return `${BASE}${path}`;
}

function HlsPlayer({ src, sessionId }: { src: string; sessionId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(false);
    let cleanup: (() => void) | undefined;

    const isHls = src.includes(".m3u8");
    const isProxied = src.startsWith("/api/media-proxy");

    if (isHls && !isProxied) {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) setError(true);
          });
          cleanup = () => hls.destroy();
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
        }
      });
    } else {
      video.src = src;
      video.onerror = () => setError(true);
    }

    if (sessionId) {
      const onPlay = () => markVideoWatched(sessionId);
      video.addEventListener("play", onPlay);
      const prevCleanup = cleanup;
      cleanup = () => {
        video.removeEventListener("play", onPlay);
        prevCleanup?.();
      };
    }

    return () => cleanup?.();
  }, [src, sessionId]);

  if (error) {
    return (
      <div className="w-full h-64 bg-black rounded-xl flex flex-col items-center justify-center text-white/60 gap-3">
        <AlertCircle size={36} />
        <p className="text-sm">Video failed to load. Try refreshing.</p>
        <button
          onClick={() => { setError(false); if (videoRef.current) videoRef.current.load(); }}
          className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="w-full max-h-[70vh] bg-black rounded-xl"
      data-testid="video-player"
      controlsList="nodownload"
    >
      Your browser does not support video playback.
    </video>
  );
}

function YouTubeEmbed({ url }: { url: string }) {
  const videoId = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) {
    return (
      <div className="h-40 flex items-center justify-center text-white/50 text-sm bg-black rounded-xl">
        Could not parse YouTube video ID
      </div>
    );
  }
  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
        className="absolute inset-0 w-full h-full rounded-xl"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        data-testid="youtube-embed"
        title="Video lecture"
      />
    </div>
  );
}

function PdfViewer({ url, title }: { url: string; title: string }) {
  const fullUrl = url.startsWith("http") ? url : getApiUrl(url);
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
          <FileText size={18} className="text-red-500" />
          <span className="text-sm font-semibold text-gray-700 truncate flex-1">{title}</span>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 font-medium hover:underline shrink-0"
          >
            Open in new tab ↗
          </a>
        </div>
        <iframe
          src={fullUrl}
          className="w-full"
          style={{ height: "75vh" }}
          title={title}
          data-testid="pdf-viewer"
        />
      </div>
    </div>
  );
}

type FbState =
  | "loading"
  | "phone_needed"
  | "phone_input"
  | "sending_otp"
  | "otp_input"
  | "verifying"
  | "fetching_url"
  | "ready";

function FirebaseVideoPlayer({ firebaseId, title, sessionId }: { firebaseId: string; title: string; sessionId: string }) {
  const [state, setState] = useState<FbState>("loading");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState("7037917438");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const tryClientUrl = useCallback(async () => {
    setState("fetching_url");
    try {
      const url = await getFirebaseVideoUrl(firebaseId);
      if (url) { setVideoUrl(url); setState("ready"); return true; }
    } catch { /* fall through */ }
    setState("phone_needed");
    return false;
  }, [firebaseId]);

  useEffect(() => {
    let cancelled = false;
    async function tryLoad() {
      // 1. Server-side proxy (only when FIREBASE_USER_EMAIL has @ — real email accounts)
      try {
        const statusResp = await fetch(getApiUrl("/api/firebase-status"));
        if (!cancelled && statusResp.ok) {
          const status = (await statusResp.json()) as { configured: boolean };
          if (status.configured) {
            const streamUrl = `${getApiUrl("/api/firebase-stream")}/${encodeURIComponent(firebaseId)}`;
            // Probe first to confirm auth actually works
            const probe = await fetch(streamUrl, { method: "HEAD" }).catch(() => null);
            if (probe?.ok || (probe && probe.status >= 200 && probe.status < 400)) {
              setVideoUrl(streamUrl);
              setState("ready");
              return;
            }
          }
        }
      } catch { /* fall through */ }

      if (cancelled) return;

      // 2. Already signed in via phone auth (persisted across page loads)
      if (isFirebaseSignedIn()) {
        const url = await getFirebaseVideoUrl(firebaseId).catch(() => null);
        if (!cancelled && url) { setVideoUrl(url); setState("ready"); return; }
      }

      if (!cancelled) setState("phone_needed");
    }
    tryLoad();
    return () => { cancelled = true; };
  }, [firebaseId]);

  const handleSendOtp = async () => {
    setPhoneError("");
    if (!phone.replace(/\D/g, "")) { setPhoneError("Enter your mobile number"); return; }
    setState("sending_otp");
    try {
      await sendOtp(phone, recaptchaRef.current!);
      setState("otp_input");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhoneError(msg.includes("TOO_SHORT") ? "Number too short" : msg.includes("INVALID") ? "Invalid number" : "Failed to send OTP. Check your number.");
      setState("phone_input");
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    if (otp.length < 4) { setOtpError("Enter the 6-digit code"); return; }
    setState("verifying");
    const ok = await confirmOtp(otp);
    if (!ok) { setOtpError("Wrong code. Try again."); setState("otp_input"); return; }
    await tryClientUrl();
  };

  if (state === "loading" || state === "fetching_url") {
    return (
      <div className="bg-black rounded-2xl h-64 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm">{state === "fetching_url" ? "Fetching video…" : "Loading video…"}</p>
      </div>
    );
  }

  if (state === "ready" && videoUrl) {
    return (
      <div className="bg-black rounded-2xl overflow-hidden shadow-2xl">
        <HlsPlayer src={videoUrl} sessionId={sessionId} />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-6 text-center">
      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaRef} />

      <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert size={28} className="text-amber-400" />
      </div>
      <h2 className="text-base font-bold text-white mb-1">{title}</h2>

      {/* Phone input */}
      {(state === "phone_needed" || state === "phone_input") && (
        <div className="max-w-xs mx-auto mt-5 space-y-3 text-left">
          <p className="text-sm text-slate-300 font-semibold text-center">Sign in with your TNC mobile number</p>
          <p className="text-xs text-slate-500 text-center">You'll receive an OTP via SMS to verify</p>
          <div className="flex gap-2">
            <div className="flex items-center bg-slate-700 border border-slate-600 rounded-xl px-3 text-slate-400 text-sm select-none">
              +91
            </div>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
          <button
            onClick={handleSendOtp}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            Send OTP
          </button>
        </div>
      )}

      {/* Sending OTP spinner */}
      {state === "sending_otp" && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Sending OTP to +91 {phone}…</p>
        </div>
      )}

      {/* OTP input */}
      {(state === "otp_input" || state === "verifying") && (
        <div className="max-w-xs mx-auto mt-5 space-y-3 text-left">
          <p className="text-sm text-slate-300 font-semibold text-center">Enter the OTP sent to</p>
          <p className="text-xs text-emerald-400 text-center">+91 {phone}</p>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit OTP"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-3 text-white text-lg text-center tracking-[0.4em] placeholder:text-slate-500 placeholder:tracking-normal focus:outline-none focus:border-blue-500"
          />
          {otpError && <p className="text-xs text-red-400 text-center">{otpError}</p>}
          <button
            onClick={handleVerifyOtp}
            disabled={state === "verifying"}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            {state === "verifying" ? "Verifying…" : "Verify & Watch"}
          </button>
          <button
            onClick={() => { setState("phone_input"); setOtp(""); setOtpError(""); }}
            className="w-full text-slate-500 text-xs hover:text-slate-400 py-1 transition-colors"
          >
            ← Use a different number
          </button>
        </div>
      )}

      <p className="text-xs text-slate-700 mt-4">ID: {firebaseId.slice(0, 12)}…</p>
    </div>
  );
}

function SecuredVideoCard({ title, firebaseId }: { title: string; firebaseId: string | null }) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert size={32} className="text-amber-400" />
      </div>
      <h2 className="text-base font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400 mb-4 max-w-xs mx-auto">
        This lecture is hosted on a secured media server.
      </p>
      {firebaseId && (
        <p className="text-xs text-slate-500 font-mono">ID: {firebaseId.slice(0, 8)}…</p>
      )}
    </div>
  );
}

function NoContentCard({ title }: { title: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center">
      <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
      <h2 className="text-base font-semibold text-gray-600 mb-1">{title}</h2>
      <p className="text-sm text-gray-400">No viewable content is attached to this session yet.</p>
    </div>
  );
}

function VideoPlayer({ session, sessionId }: { session: { videoUrl: string | null; contentType: string; title: string }; sessionId: string }) {
  const { videoUrl } = session;
  if (!videoUrl) return null;

  const isYT = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");

  return (
    <div className="bg-black rounded-2xl overflow-hidden shadow-2xl">
      {isYT ? (
        <YouTubeEmbed url={videoUrl} />
      ) : (
        <HlsPlayer src={videoUrl.startsWith("/api/") ? getApiUrl(videoUrl) : videoUrl} sessionId={sessionId} />
      )}
    </div>
  );
}

function CoursePlaylist({ courseId, currentSessionId }: { courseId: string; currentSessionId: string }) {
  const [showAll, setShowAll] = useState(false);
  const { data: sessionsRaw } = useListSessions(
    { courseId },
    { query: { queryKey: getListSessionsQueryKey({ courseId }) } }
  );

  const sessions = Array.isArray(sessionsRaw) ? sessionsRaw : [];
  const displaySessions = showAll ? sessions : sessions.slice(0, 12);

  if (!sessions.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800">Course Playlist</h3>
        <span className="text-xs text-gray-400">{sessions.length} lessons</span>
      </div>
      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {displaySessions.map((s) => {
          const isCurrent = s.rowId === currentSessionId;
          const isVideo = s.contentType === "youtube" || s.videoUrl;
          const isPdf = s.contentType === "pdf" || s.pdfUrl;
          const href = isVideo
            ? `/watch/${s.rowId}`
            : isPdf
              ? `/pdf/${s.rowId}`
              : `/watch/${s.rowId}`;

          return (
            <Link
              key={s.rowId}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors ${isCurrent ? "bg-blue-50 border-l-2 border-blue-600" : ""}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isCurrent ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                {isVideo ? <PlayCircle size={14} /> : isPdf ? <FileText size={13} /> : <Video size={13} />}
              </div>
              <p className={`text-xs font-medium truncate flex-1 ${isCurrent ? "text-blue-700" : "text-gray-700"}`}>{s.title}</p>
              {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
            </Link>
          );
        })}
      </div>
      {sessions.length > 12 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border-t transition-colors"
        >
          {showAll ? "Show less" : `Show all ${sessions.length} lessons`}
        </button>
      )}
    </div>
  );
}

export default function WatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const user = getUser();

  const { data: session, isLoading } = useGetSession(sessionId ?? "");
  const { data: promo } = useGetPromoStatus();
  const { data: purchases } = useGetUserPurchases(user?.userId ?? "", {
    query: { enabled: !!user, queryKey: getGetUserPurchasesQueryKey(user?.userId ?? "") },
  });

  const purchasedIds = new Set((Array.isArray(purchases) ? purchases : []).map((p) => p.courseId));
  const isCourseUnlocked = promo?.enabled || (!!session?.courseId && purchasedIds.has(session.courseId));
  const isUnlocked = !session?.isPaid || isCourseUnlocked;

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-80 skeleton rounded-2xl mb-4" />
          <div className="h-6 skeleton rounded w-1/2 mb-2" />
          <div className="h-4 skeleton rounded w-3/4" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-20">
          <Video size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">Session not found</p>
          <Link href="/courses" className="text-blue-600 text-sm mt-2 inline-block">Back to courses</Link>
        </div>
      </Layout>
    );
  }

  const contentType = session.contentType ?? (session.videoUrl ? "youtube" : "none");
  const backHref = session.courseId ? `/courses/${session.courseId}` : "/courses";

  const firebaseId = (session as unknown as Record<string, unknown>).firebaseId as string | null ?? null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 w-fit"
          data-testid="link-back-session"
        >
          <ArrowLeft size={14} /> Back to Course
        </Link>

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 min-w-0">
            {!isUnlocked ? (
              <div className="bg-gray-100 rounded-2xl p-12 text-center">
                <Lock size={48} className="mx-auto text-gray-300 mb-4" />
                <h2 className="text-lg font-bold text-gray-700 mb-2">Content Locked</h2>
                <p className="text-gray-500 text-sm mb-4">Purchase the course to access this paid session</p>
                <Link href="/buy" className="px-6 py-2 rounded-xl tnc-brand-gradient text-white text-sm font-semibold inline-block" data-testid="btn-buy-unlock">
                  Buy Course
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {contentType === "youtube" && session.videoUrl ? (
                  <VideoPlayer session={session} sessionId={sessionId ?? ""} />
                ) : contentType === "pdf" && session.pdfUrl ? (
                  <PdfViewer url={session.pdfUrl} title={session.title} />
                ) : contentType === "firebase" && firebaseId ? (
                  <FirebaseVideoPlayer firebaseId={firebaseId} title={session.title} sessionId={sessionId ?? ""} />
                ) : (
                  <NoContentCard title={session.title} />
                )}

                {contentType !== "pdf" && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                      <h1 className="text-lg font-black text-gray-900 leading-snug" data-testid="session-title">
                        {session.title}
                      </h1>
                      {!session.isPaid && (
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">FREE</span>
                      )}
                    </div>
                    {session.courseId && (
                      <Link href={`/courses/${session.courseId}`} className="text-xs text-blue-600 mt-2 inline-flex items-center gap-1 hover:underline">
                        View full course <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {session.courseId && (
            <div className="lg:w-72 flex-shrink-0">
              <CoursePlaylist courseId={session.courseId} currentSessionId={sessionId ?? ""} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
