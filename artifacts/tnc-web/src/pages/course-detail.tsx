import { useParams, Link } from "wouter";
import { useGetCourses, useGetPromoStatus, useGetUserPurchases, getGetUserPurchasesQueryKey } from "@/lib/api-client";
import { ArrowLeft, Heart, ChevronRight, BookOpen, Lock } from "lucide-react";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toggleFavorite, isFavorite } from "@/lib/streak";
import StudyEmptyState from "@/components/StudyEmptyState";

type Subject = {
  rowId: string;
  name: string;
  description?: string;
  videoCount: number;
  pdfCount: number;
  totalCount: number;
};

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const user = getUser();
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    if (courseId) setIsFav(isFavorite("courses", courseId));
  }, [courseId]);

  const { data: courses, isLoading: coursesLoading } = useGetCourses();
  const course = (Array.isArray(courses) ? courses : []).find((c) => c.rowId === courseId);

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const response = await fetch(`/api/subjects?courseId=${encodeURIComponent(courseId ?? "")}`);
      if (!response.ok) throw new Error("Failed to load subjects");
      return response.json() as Promise<Subject[]>;
    },
  });
  const { data: promo } = useGetPromoStatus();
  const { data: purchases } = useGetUserPurchases(user?.userId ?? "", {
    query: { enabled: !!user, queryKey: getGetUserPurchasesQueryKey(user?.userId ?? "") },
  });
  const isCourseUnlocked = Boolean(promo?.enabled) || (Array.isArray(purchases) && purchases.some((purchase) => purchase.courseId === courseId));

  function handleFav() {
    if (!courseId) return;
    const next = toggleFavorite("courses", courseId);
    setIsFav(next);
  }

  if (coursesLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <div className="h-8 skeleton rounded w-1/2" />
          <div className="h-48 skeleton rounded-2xl" />
          <div className="h-4 skeleton rounded w-3/4" />
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-500 font-medium">Course not found</p>
          <Link href="/courses" className="text-blue-600 text-sm mt-2 inline-block">Back to courses</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <div className="tnc-hero-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/courses" className="flex items-center gap-1 text-white/70 hover:text-white text-sm w-fit" data-testid="link-back-courses">
              <ArrowLeft size={14} /> Back to Courses
            </Link>
            <button
              onClick={handleFav}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isFav ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              data-testid="btn-favorite-course"
            >
              <Heart size={13} className={isFav ? "fill-white" : ""} />
              {isFav ? "Saved" : "Save"}
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-48 h-32 md:h-36 rounded-xl overflow-hidden flex-shrink-0">
              <img src="https://i.pinimg.com/736x/14/cd/37/14cd3762b025549304c79af5e96d6b15.jpg" alt={course.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-black mb-2">{course.name}</h1>
              {course.description && course.description !== "Description" && (
                <p className="text-white/70 text-sm leading-relaxed mb-3">{course.description}</p>
              )}
              <p className="text-sm text-white/80">Browse the batch by subject and keep each subject&apos;s learning content together.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unlock banner */}
      {!isCourseUnlocked && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <Lock size={16} className="text-amber-500" />
              <span>Purchase this course to unlock all paid content. Free lessons are accessible below.</span>
            </div>
            <Link href="/buy" className="px-4 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors" data-testid="btn-unlock-buy">
              Buy Now
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {subjects.length === 0 ? (
          <StudyEmptyState title="No subjects available yet" />
        ) : (
          <div>
            <h2 className="mb-4 text-base font-black text-gray-900">Subjects</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {subjects.map((subject) => (
                <Link
                  key={subject.rowId}
                  href={`/courses/${courseId}/subjects/${subject.rowId}`}
                  className="group rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  data-testid={`subject-card-${subject.rowId}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BookOpen size={19} /></div>
                      <h3 className="font-bold text-gray-900">{subject.name}</h3>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 transition-colors group-hover:text-blue-600" />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{subject.videoCount} Videos</span>
                    <span>{subject.pdfCount} PDFs</span>
                    <span>{subject.totalCount} Items</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
