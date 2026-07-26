import { useParams, Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useGetSession, useGetPromoStatus, useGetUserPurchases, getGetUserPurchasesQueryKey, useListSessions, getListSessionsQueryKey } from "@/lib/api-client";
import { ArrowLeft, Lock, Video, FileText, AlertCircle, ChevronRight, PlayCircle, ShieldAlert } from "lucide-react";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { markVideoWatched } from "@/lib/streak";
import { getFirebaseVideoUrl } from "@/lib/firebase";

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

function FirebaseVideoPlayer({ firebaseId, title, sessionId }: { firebaseId: string; title: string; sessionId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tryLoad() {
      // 1. Try server-side proxy stream (works with FIREBASE_USER_EMAIL/PASSWORD or service account)
      try {
        const statusResp = await fetch(getApiUrl("/api/firebase-status"));
        if (!cancelled && statusResp.ok) {
          const status = await statusResp.json() as { configured: boolean };
          if (status.configured) {
            // Use the proxy stream URL directly as video src
            const streamUrl = `${getApiUrl("/api/firebase-stream")}/${encodeURIComponent(firebaseId)}`;
            setVideoUrl(streamUrl);
            setState("ready");
            return;
          }
        }
      } catch {
        // fall through
      }

      // 2. Try client-side Firebase anonymous auth (if enabled in Firebase Console)
      try {
        const clientUrl = await getFirebaseVideoUrl(firebaseId);
        if (!cancelled && clientUrl) {
          setVideoUrl(clientUrl);
          setState("ready");
          return;
        }
      } catch {
        // fall through
      }

      if (!cancelled) setState("unavailable");
    }
    tryLoad();
    return () => { cancelled = true; };
  }, [firebaseId]);

  if (state === "loading") {
    return (
      <div className="bg-black rounded-2xl h-64 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Loading video…</p>
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
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert size={32} className="text-amber-400" />
      </div>
      <h2 className="text-base font-bold text-white mb-1">{title}</h2>
      <p className="text-sm text-slate-400 mb-5 max-w-xs mx-auto">
        This lecture is secured by Firebase Authentication.
      </p>

      <div className="max-w-sm mx-auto space-y-3 text-left">
        {/* Option 1 — TNC Account credentials */}
        <div className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-emerald-400">⚡ Easiest — Use your TNC account</p>
          <p className="text-xs text-slate-400 leading-relaxed">The server will sign into Firebase as you and stream all videos through a proxy. No Firebase Console needed.</p>
          <div className="space-y-1.5">
            <div className="bg-slate-800 rounded-lg p-2 font-mono text-xs text-emerald-300">
              FIREBASE_USER_EMAIL = your@email.com
            </div>
            <div className="bg-slate-800 rounded-lg p-2 font-mono text-xs text-emerald-300">
              FIREBASE_USER_PASSWORD = yourpassword
            </div>
          </div>
          <p className="text-xs text-slate-500">Add these as Replit secrets → restart API server → all videos play.</p>
        </div>

        {/* Option 2 — Service Account */}
        <div className="bg-slate-700/40 border border-slate-600/50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-bold text-amber-400">🔑 Alternative — Service Account</p>
          <ol className="text-xs text-slate-400 leading-relaxed space-y-1 list-decimal pl-4">
            <li><a href="https://console.firebase.google.com/project/team-nursing-classes-818e5/settings/serviceaccounts/adminsdk" target="_blank" rel="noreferrer" className="text-blue-400 underline">Firebase Console → Service Accounts</a> → Generate private key</li>
            <li>Add JSON as secret <code className="bg-slate-600 px-1 rounded text-slate-300">FIREBASE_SERVICE_ACCOUNT</code></li>
            <li>Restart API server</li>
          </ol>
        </div>

        <p className="text-xs text-slate-600 text-center">Firebase ID: {firebaseId.slice(0, 16)}…</p>
      </div>
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
