import { useParams, Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useGetSession, useGetPromoStatus, useGetUserPurchases, getGetUserPurchasesQueryKey, useListSessions, getListSessionsQueryKey } from "@/lib/api-client";
import { ArrowLeft, Lock, Video, FileText, AlertCircle, ChevronRight, PlayCircle, Smartphone, Download } from "lucide-react";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { markVideoWatched } from "@/lib/streak";

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


function AppRequiredCard({ title }: { title: string }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2027 50%, #1a1a2e 100%)" }}>
      {/* Top banner */}
      <div className="bg-blue-600/20 border-b border-blue-500/20 px-5 py-2.5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-blue-300 text-xs font-semibold tracking-wide uppercase">Premium App Lecture</span>
      </div>

      <div className="px-6 py-8 text-center">
        {/* App icon */}
        <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
          <Smartphone size={36} className="text-white" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-black text-white mb-2 leading-snug">{title}</h2>
        <p className="text-blue-200 text-sm mb-1 font-medium">This lecture streams exclusively in the TNC app</p>
        <p className="text-slate-400 text-xs mb-7 max-w-xs mx-auto">
          Download the free TNC Nursing Classes app and watch this lecture along with thousands of other premium video lessons.
        </p>

        {/* Download buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <a
            href="https://play.google.com/store/apps/details?id=com.tncnursing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 bg-white text-gray-900 font-bold text-sm px-5 py-3 rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.18 23.76c.3.17.64.24.99.2l12.9-11.88-2.97-2.97-10.92 14.65zM.94 1.05C.36 1.56 0 2.4 0 3.48V20.5c0 1.08.36 1.92.94 2.43l.12.1 9.72-9.72v-.24L1.06.95.94 1.05zM20.17 9.58l-2.77-1.6-3.12 3.13 3.12 3.12 2.8-1.6c.8-.46.8-1.6-.03-2.05zM4.17.24L17.07 12.12l-2.97 2.97L4.17.24z"/>
            </svg>
            Google Play
          </a>
          <a
            href="https://tncnursing.in"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-300 hover:text-blue-200 text-sm font-medium transition-colors"
          >
            <Download size={14} />
            Visit tncnursing.in
          </a>
        </div>

        {/* Divider + note */}
        <div className="mt-7 pt-5 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">
            Already have the app?{" "}
            <span className="text-slate-400">Open TNC app → Courses → find this lecture</span>
          </p>
        </div>
      </div>
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
                  <VideoPlayer session={{ ...session, videoUrl: session.videoUrl ?? null }} sessionId={sessionId ?? ""} />
                ) : contentType === "pdf" && session.pdfUrl ? (
                  <PdfViewer url={session.pdfUrl} title={session.title} />
                ) : contentType === "firebase" && firebaseId ? (
                  <AppRequiredCard title={session.title} />
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
