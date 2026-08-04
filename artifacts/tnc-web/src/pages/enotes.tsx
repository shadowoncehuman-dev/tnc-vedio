import { useState, useCallback } from "react";
import { Link } from "wouter";
import {
  useGetCourses,
  useGetPromoStatus,
  useGetUserPurchases,
  getGetUserPurchasesQueryKey,
} from "@/lib/api-client";
import { customFetch } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, Lock, Search, BookOpen, ChevronRight,
  ChevronDown, ArrowRight, Loader2, ExternalLink, BookMarked,
} from "lucide-react";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
interface NoteSession {
  rowId: string;
  title: string;
  pdfUrl: string | null;
  isPaid: boolean;
  serialNo: string;
  courseId: string | null;
  contentType: string;
}

// ─── Hook: fetch PDFs for one course on demand ────────────────────────────────
function useCourseNotes(courseId: string | null, enabled: boolean) {
  return useQuery<NoteSession[]>({
    queryKey: ["notes", courseId],
    queryFn: () =>
      customFetch<NoteSession[]>(`/api/notes?courseId=${courseId}`),
    enabled: !!courseId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Hook: fetch recent PDFs across all courses ───────────────────────────────
function useRecentNotes() {
  return useQuery<NoteSession[]>({
    queryKey: ["notes", "recent"],
    queryFn: () => customFetch<NoteSession[]>("/api/notes?limit=60"),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── CourseNoteRow: expandable per-course PDF list ───────────────────────────
function CourseNoteRow({
  course,
  isUnlocked,
}: {
  course: { rowId: string; name: string; description?: string; imageUrl?: string | null };
  isUnlocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: notes, isLoading } = useCourseNotes(course.rowId, open);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-all"
    >
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center gap-4 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
        data-testid={`btn-expand-course-${course.rowId}`}
      >
        <div
          className={`w-12 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isUnlocked ? "bg-red-50" : "bg-gray-100"
          }`}
        >
          {course.imageUrl ? (
            <img
              src={course.imageUrl}
              alt={course.name}
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="text-center">
              <FileText size={22} className={isUnlocked ? "text-red-500" : "text-gray-400"} />
              <span className="text-[9px] mt-0.5 block font-bold text-gray-400">PDF</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{course.name}</p>
          {course.description && course.description !== "Description" && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{course.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                isUnlocked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isUnlocked ? "Unlocked" : <><Lock size={9} /> Locked</>}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <BookOpen size={10} /> Course Notes
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isUnlocked && (
            <Link
              href="/buy"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <Lock size={11} /> Unlock
            </Link>
          )}
          <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <ChevronDown size={18} className="text-gray-400" />
          </span>
        </div>
      </button>

      {/* Expanded PDF list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading notes…</span>
              </div>
            ) : !notes || notes.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                No PDF notes found for this course
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notes.map((note, idx) => (
                  <NoteItem
                    key={note.rowId}
                    note={note}
                    index={idx}
                    isUnlocked={isUnlocked}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Individual note item ─────────────────────────────────────────────────────
function NoteItem({
  note,
  index,
  isUnlocked,
}: {
  note: NoteSession;
  index: number;
  isUnlocked: boolean;
}) {
  const canAccess = !note.isPaid || isUnlocked;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="px-4 py-3 flex items-center gap-3"
    >
      <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 text-red-400">
        <FileText size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{note.title}</p>
        {!note.isPaid && (
          <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">
            FREE
          </span>
        )}
      </div>
      {canAccess ? (
        <Link
          href={`/pdf/${note.rowId}`}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 transition-colors whitespace-nowrap"
          data-testid={`btn-view-note-${note.rowId}`}
        >
          View PDF <ChevronRight size={11} />
        </Link>
      ) : (
        <Link
          href="/buy"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
        >
          <Lock size={10} /> Unlock
        </Link>
      )}
    </motion.div>
  );
}

// ─── Recent notes flat list ───────────────────────────────────────────────────
function RecentNotesList({
  isUnlocked,
  search,
}: {
  isUnlocked: (courseId: string | null) => boolean;
  search: string;
}) {
  const { data: notes, isLoading } = useRecentNotes();

  const filtered = (Array.isArray(notes) ? notes : []).filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <FileText size={48} className="mx-auto text-gray-200 mb-3" />
        <p className="font-medium">No PDF notes found</p>
        <p className="text-sm text-gray-400 mt-1">Try a different search or browse by course</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((note, i) => {
        const unlocked = isUnlocked(note.courseId);
        const canAccess = !note.isPaid || unlocked;
        return (
          <motion.div
            key={note.rowId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.4) }}
            className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 hover:shadow-md transition-all"
            data-testid={`recent-note-${note.rowId}`}
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{note.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {!note.isPaid && (
                  <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">FREE</span>
                )}
                <span className="text-[10px] text-gray-400">PDF Note</span>
              </div>
            </div>
            {canAccess ? (
              <Link
                href={`/pdf/${note.rowId}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                Open <ExternalLink size={11} />
              </Link>
            ) : (
              <Link
                href="/buy"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-semibold"
              >
                <Lock size={11} /> Unlock
              </Link>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EnotesPage() {
  const user = getUser();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"courses" | "recent">("courses");

  const { data: courses, isLoading } = useGetCourses();
  const { data: promo } = useGetPromoStatus();
  const { data: purchases } = useGetUserPurchases(user?.userId ?? "", {
    query: { enabled: !!user, queryKey: getGetUserPurchasesQueryKey(user?.userId ?? "") },
  });

  const courseList = Array.isArray(courses) ? courses : [];
  const purchasedIds = new Set(
    (Array.isArray(purchases) ? purchases : []).map((p) => p.courseId),
  );

  const isUnlocked = useCallback(
    (courseRowId: string | null) =>
      !!(promo?.enabled || (courseRowId && purchasedIds.has(courseRowId))),
    [promo, purchasedIds],
  );

  const filtered = courseList.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Layout>
      {/* Hero */}
      <div className="tnc-brand-gradient text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <BookMarked size={22} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black">E-Notes / PDF Notes</h1>
          </div>
          <p className="text-white/70 text-sm ml-[52px]">
            {courseList.length > 0
              ? `${courseList.length} courses with structured PDF study materials`
              : "Comprehensive PDF notes for all nursing exams"}
          </p>
        </div>
      </div>

      {/* Sticky bar — search + tabs */}
      <div className="bg-white border-b sticky top-16 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-1">
            {[
              { key: "courses", label: "By Course" },
              { key: "recent", label: "Recent PDFs" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t.key
                    ? "bg-red-600 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "courses" ? "Search courses…" : "Search notes…"}
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400"
              data-testid="input-search-notes"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {tab === "courses" ? (
          <>
            <p className="text-xs text-gray-400 mb-5 font-medium uppercase tracking-wide">
              Click a course to browse its PDF notes
            </p>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 skeleton rounded-2xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <FileText size={48} className="mx-auto text-gray-200 mb-3" />
                <p className="font-medium">No courses found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((course) => (
                  <CourseNoteRow
                    key={course.rowId}
                    course={course}
                    isUnlocked={isUnlocked(course.rowId)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-5 font-medium uppercase tracking-wide">
              Latest PDF notes across all courses
            </p>
            <RecentNotesList isUnlocked={isUnlocked} search={search} />
          </>
        )}

        {/* CTA */}
        <div className="mt-10 bg-red-50 rounded-2xl p-5 border border-red-100 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">Get unlimited access to all PDF notes</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Well-structured e-notes for NORCET, AIIMS &amp; all nursing exams
            </p>
          </div>
          <Link
            href="/buy"
            className="flex items-center gap-1 px-4 py-2 rounded-xl tnc-brand-gradient text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Buy Now <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
