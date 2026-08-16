import { useState } from "react";
import { Link } from "wouter";
import { useGetCourses, useGetPromoStatus, useGetUserPurchases, getGetUserPurchasesQueryKey } from "@/lib/api-client";
import { Video, Lock, PlayCircle, Search, BookOpen, ChevronRight, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { motion } from "framer-motion";

export default function VideosPage() {
  const user = getUser();
  const [search, setSearch] = useState("");

  const { data: courses, isLoading } = useGetCourses();
  const { data: promo } = useGetPromoStatus();
  const { data: purchases } = useGetUserPurchases(user?.userId ?? "", {
    query: { enabled: !!user, queryKey: getGetUserPurchasesQueryKey(user?.userId ?? "") },
  });

  const courseList = Array.isArray(courses) ? courses : [];
  const purchasedIds = new Set((Array.isArray(purchases) ? purchases : []).map((p) => p.courseId));

  function isUnlocked(courseRowId: string) {
    return promo?.enabled || purchasedIds.has(courseRowId);
  }

  const filtered = courseList.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="tnc-brand-gradient text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Video size={22} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black">Video Lectures</h1>
          </div>
          <p className="text-white/70 text-sm ml-[52px]">
            {courseList.length > 0 ? `${courseList.length} courses — thousands of HD video lectures` : "Browse video lectures by course"}
          </p>
        </div>
      </div>

      <div className="bg-white border-b sticky top-16 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses..."
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-search-videos"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-xs text-gray-500 mb-5 font-medium uppercase tracking-wide">Select a course to browse its videos</p>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border">
                <div className="h-40 skeleton" />
                <div className="p-4 space-y-2">
                  <div className="h-4 skeleton rounded w-3/4" />
                  <div className="h-3 skeleton rounded w-full" />
                  <div className="h-9 skeleton rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Video size={48} className="mx-auto text-gray-200 mb-3" />
            <p className="font-medium">No courses found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((course, i) => {
              const unlocked = isUnlocked(course.rowId);
              return (
                <motion.div
                  key={course.rowId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  data-testid={`card-video-course-${course.rowId}`}
                >
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100 group flex flex-col h-full">
                    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-blue-900 to-indigo-900">
                      <img
                        src="https://i.pinimg.com/736x/18/75/01/18750180cc2f14a2a18493ae12b000cd.jpg"
                        alt={course.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <PlayCircle size={24} className="text-blue-700" />
                        </div>
                      </div>
                      <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        unlocked ? "bg-green-500 text-white" : "bg-gray-900/70 text-white"
                      }`}>
                        {unlocked ? "Unlocked" : <><Lock size={9} /> Locked</>}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">{course.name}</h3>
                      {course.description && course.description !== "Description" && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{course.description}</p>
                      )}
                      <div className="flex gap-2 mt-auto pt-3">
                        <Link
                          href={`/courses/${course.rowId}`}
                          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-semibold text-white tnc-brand-gradient hover:opacity-90 transition-opacity"
                          data-testid={`btn-view-videos-${course.rowId}`}
                        >
                          <PlayCircle size={13} /> Watch Videos <ChevronRight size={13} />
                        </Link>
                        {!unlocked && (
                          <Link
                            href="/buy"
                            className="flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border border-amber-500 text-amber-600 hover:bg-amber-50 transition-colors"
                            data-testid={`btn-buy-video-${course.rowId}`}
                          >
                            Buy
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-12 bg-blue-50 rounded-2xl p-5 border border-blue-100 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-gray-900 text-sm">Want all videos?</p>
            <p className="text-xs text-gray-500 mt-0.5">Enroll in a course to get full access to all video lectures</p>
          </div>
          <Link href="/buy" className="flex items-center gap-1 px-4 py-2 rounded-xl tnc-brand-gradient text-white text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
            Buy Now <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
