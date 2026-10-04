import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronRight, Clock3, History, PlayCircle, Search, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import StudyEmptyState from "@/components/StudyEmptyState";
import { useGetCourses } from "@/lib/api-client";
import { clearWatchHistory, getWatchedCourses, getWatchedVideos, type WatchedCourse, type WatchedVideo } from "@/lib/streak";

type HistoryTab = "all" | "videos" | "courses";

interface HistoryEntry {
  id: string;
  kind: "video" | "course";
  title: string;
  description: string;
  watchedAt: string;
  href: string;
}

export default function WatchedPage() {
  const [tab, setTab] = useState<HistoryTab>("all");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<{ videos: WatchedVideo[]; courses: WatchedCourse[] }>(() => ({
    videos: getWatchedVideos(),
    courses: getWatchedCourses(),
  }));
  const { data: courses } = useGetCourses();

  useEffect(() => {
    const refresh = () => setHistory({ videos: getWatchedVideos(), courses: getWatchedCourses() });
    window.addEventListener("tnc-watched-videos-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tnc-watched-videos-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const courseNames = new Map((Array.isArray(courses) ? courses : []).map((course) => [course.rowId, course.name]));
  const videoEntries: HistoryEntry[] = history.videos.map((video) => ({
    id: `video:${video.sessionId}`,
    kind: "video",
    title: video.title,
    description: video.courseId ? courseNames.get(video.courseId) ?? "Video lecture" : "Video lecture",
    watchedAt: video.watchedAt,
    href: `/watch/${video.sessionId}`,
  }));
  const courseEntries: HistoryEntry[] = history.courses.map((course) => ({
    id: `course:${course.courseId}`,
    kind: "course",
    title: courseNames.get(course.courseId) ?? course.name,
    description: "Course visited",
    watchedAt: course.watchedAt,
    href: `/courses/${course.courseId}`,
  }));
  const allEntries = [...videoEntries, ...courseEntries].sort((a, b) => b.watchedAt.localeCompare(a.watchedAt));
  const tabEntries = tab === "videos" ? videoEntries : tab === "courses" ? courseEntries : allEntries;
  const query = search.trim().toLowerCase();
  const visibleEntries = tabEntries.filter((entry) => `${entry.title} ${entry.description}`.toLowerCase().includes(query));
  const totalEntries = history.videos.length + history.courses.length;

  function clearHistory() {
    if (window.confirm("Clear your watched videos and course history?")) clearWatchHistory();
  }

  return (
    <Layout>
      <div className="tnc-hero-gradient text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15"><History size={23} /></div>
          <div>
            <h1 className="text-2xl font-black">Your Study History</h1>
            <p className="mt-1 text-sm text-white/75">Pick up where you left off.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-7">
        <section className="mb-7 grid grid-cols-3 divide-x divide-gray-200 border-y border-gray-200 py-4" aria-label="Study history totals">
          <div className="px-3 text-center sm:text-left"><p className="text-xl font-black text-gray-900">{history.videos.length}</p><p className="text-xs text-gray-500">Videos watched</p></div>
          <div className="px-3 text-center sm:text-left"><p className="text-xl font-black text-gray-900">{history.courses.length}</p><p className="text-xs text-gray-500">Courses visited</p></div>
          <div className="px-3 text-center sm:text-left"><p className="text-xl font-black text-gray-900">{totalEntries}</p><p className="text-xs text-gray-500">Total activities</p></div>
        </section>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-fit gap-1 border-b border-gray-200" role="tablist" aria-label="History type">
            {(["all", "videos", "courses"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`border-b-2 px-3 py-2 text-sm font-semibold capitalize transition-colors ${tab === value ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
              >
                {value === "all" ? "Activity" : value}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search history"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                aria-label="Search watch history"
              />
            </label>
            <button
              type="button"
              onClick={clearHistory}
              disabled={!totalEntries}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>

        {visibleEntries.length ? (
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {visibleEntries.map((entry) => {
              const Icon = entry.kind === "video" ? PlayCircle : BookOpen;
              return (
                <Link key={entry.id} href={entry.href} className="group flex items-center gap-3 py-4 hover:bg-blue-50/50">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${entry.kind === "video" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-700"}`}><Icon size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900">{entry.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">{entry.description}</span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs text-gray-400 sm:flex"><Clock3 size={13} />{new Date(entry.watchedAt).toLocaleString()}</span>
                  <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-blue-600" />
                </Link>
              );
            })}
          </div>
        ) : totalEntries ? (
          <StudyEmptyState title="No matching history" message="Try another search or switch history tabs." />
        ) : (
          <div className="py-16 text-center">
            <History size={40} className="mx-auto mb-3 text-gray-300" />
            <StudyEmptyState title="Your study history is empty" message="Watched videos and opened courses will appear here." />
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/videos" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Browse videos</Link>
              <Link href="/courses" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Browse courses</Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}