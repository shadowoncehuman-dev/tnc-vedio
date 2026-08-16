import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useGetSliders, useGetCourses, useGetPromoStatus } from "@/lib/api-client";
import { BookOpen, Video, FileText, Award, ChevronLeft, ChevronRight, ArrowRight, CheckCircle, Star, Flame, Brain, Zap } from "lucide-react";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { getStreakData } from "@/lib/streak";
import { getUser } from "@/lib/auth";
import { openExternalLink } from "@/lib/telegram";

function SliderCarousel() {
  const { data: sliders, isLoading } = useGetSliders();
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const items = Array.isArray(sliders) ? sliders : [];

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % Math.max(items.length, 1));
  }, [items.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(next, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length, next]);

  if (isLoading) return <div className="w-full h-52 md:h-80 skeleton rounded-none" />;
  if (!items.length) return null;

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "16/6" }}>
      {items.map((slide, i) => (
        <div
          key={slide.rowId}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
        >
          <img
            src={slide.imageUrl}
            alt={slide.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-6 text-white">
            <p className="text-sm md:text-base font-semibold drop-shadow">{slide.name}</p>
          </div>
        </div>
      ))}
      {items.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 right-4 flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-5" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PromoBar() {
  const { data: promo } = useGetPromoStatus();
  if (!promo?.enabled) return null;
  return (
    <div className="tnc-amber-gradient text-white text-center py-2.5 px-4 text-sm font-semibold tracking-wide" data-testid="promo-bar">
      🎉 All content unlocked — Promotional mode active!
      {promo.expiresAt && (
        <span className="ml-2 text-xs font-normal opacity-90">
          (Expires {new Date(promo.expiresAt).toLocaleDateString("en-IN")})
        </span>
      )}
    </div>
  );
}

function StreakWidget() {
  const [streak, setStreak] = useState<ReturnType<typeof getStreakData> | null>(null);
  const user = getUser();

  useEffect(() => {
    setStreak(getStreakData());
  }, []);

  if (!user || !streak) return null;

  const { currentStreak, longestStreak, todayVideos, todayQuizzes } = streak;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 my-4 max-w-5xl md:mx-auto"
    >
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Flame size={28} className="text-white" />
            </div>
            <div>
              <div className="text-3xl font-black">{currentStreak} <span className="text-lg font-semibold">day streak</span></div>
              <div className="text-white/80 text-sm mt-0.5">
                {currentStreak === 0
                  ? "Start studying today to begin your streak!"
                  : currentStreak === 1
                    ? "Great start! Come back tomorrow to continue 🔥"
                    : `${currentStreak} days strong! Keep it up 💪`}
              </div>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-black">{todayVideos}</div>
              <div className="text-white/70">videos today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black">{todayQuizzes}</div>
              <div className="text-white/70">quizzes today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black">{longestStreak}</div>
              <div className="text-white/70">best streak</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Link
            href="/videos"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors"
          >
            <Video size={14} /> Watch a video
          </Link>
          <button
            onClick={() => openExternalLink("https://test-sagar-jet.vercel.app/tnc-tests")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors"
          >
            <Brain size={14} /> Take a quiz
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CourseCard({ course }: { course: { id: number; rowId: string; name: string; description: string; imageUrl?: string | null; createdAt?: string } }) {
  const isNew = course.createdAt
    ? (Date.now() - new Date(course.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 30
    : false;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100 group"
    >
      <div className="h-40 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 relative">
        <img
          src="https://i.pinimg.com/736x/18/75/01/18750180cc2f14a2a18493ae12b000cd.jpg"
          alt={course.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {isNew && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Zap size={9} /> NEW
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">{course.name}</h3>
        {course.description && course.description !== "" && course.description !== "Description" && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          <Link
            href={`/courses/${course.rowId}`}
            className="flex-1 text-center py-2 px-3 rounded-lg text-xs font-semibold text-white tnc-brand-gradient hover:opacity-90 transition-opacity"
          >
            View Course
          </Link>
          <Link
            href="/buy"
            className="flex-1 text-center py-2 px-3 rounded-lg text-xs font-semibold border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Enroll
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const { data: courses, isLoading: coursesLoading } = useGetCourses();

  const features = [
    { icon: Video, title: "HD Video Lectures", desc: "Comprehensive video sessions by expert faculty" },
    { icon: FileText, title: "Digital E-Notes", desc: "Well-structured PDF notes for offline study" },
    { icon: Award, title: "NORCET Focused", desc: "Specially designed for AIIMS, NORCET & CHO exams" },
    { icon: CheckCircle, title: "Live Doubt Sessions", desc: "Interactive live batches with real-time support" },
  ];

  const exams = ["NORCET", "AIIMS Nursing", "ESIC Nursing", "CHO (Community Health)", "DSSSB", "RUHS", "State Nursing Exams"];

  const courseList = Array.isArray(courses) ? courses : [];

  return (
    <Layout>
      <PromoBar />
      <SliderCarousel />
      <StreakWidget />

      {/* Hero CTA */}
      <section className="tnc-hero-gradient text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold mb-4 tracking-wide uppercase">
              India's Premier Nursing Exam Prep
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">
              Crack NORCET & AIIMS<br />
              <span className="text-yellow-300">with Confidence</span>
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              Join thousands of nursing students who cleared government nursing exams with TNC's structured video lectures, e-notes, and expert guidance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/courses"
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors shadow-lg"
                data-testid="hero-btn-courses"
              >
                Explore Courses <ArrowRight size={16} />
              </Link>
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-yellow-400 text-gray-900 font-bold text-sm hover:bg-yellow-300 transition-colors shadow-lg"
                data-testid="hero-btn-register"
              >
                Join Free Now <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b py-8">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "1,50,000+", label: "Students Enrolled" },
            { value: `${courseList.length || "90"}+`, label: "Courses" },
            { value: "59,000+", label: "Video Lectures" },
            { value: "6,700+", label: "Mock Tests" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-blue-700">{stat.value}</div>
              <div className="text-xs text-gray-500 font-medium mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-12 px-4" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">Why Choose TNC?</h2>
            <p className="text-gray-500 text-sm">Everything you need to crack your nursing exam</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center"
              >
                <div className="w-12 h-12 rounded-xl tnc-brand-gradient flex items-center justify-center mx-auto mb-3">
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Preview — newest first, skip loading flicker */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Latest Courses</h2>
              <p className="text-sm text-gray-500 mt-1">Freshest batches added recently</p>
            </div>
            <Link
              href="/courses"
              className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              data-testid="link-all-courses"
            >
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {coursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                  <div className="h-40 skeleton" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 skeleton rounded w-3/4" />
                    <div className="h-3 skeleton rounded w-full" />
                    <div className="h-8 skeleton rounded mt-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courseList.slice(0, 6).map((course) => (
                <CourseCard key={course.rowId} course={course} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Exam coverage */}
      <section className="py-12 px-4 tnc-hero-gradient text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black mb-2">Exams We Cover</h2>
          <p className="text-white/70 text-sm mb-8">Comprehensive preparation for all major nursing recruitment exams</p>
          <div className="flex flex-wrap justify-center gap-3">
            {exams.map((exam) => (
              <div
                key={exam}
                className="px-4 py-2 rounded-full bg-white/15 border border-white/20 text-sm font-semibold backdrop-blur-sm"
              >
                {exam}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-black text-gray-900 text-center mb-8">Toppers Speak</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: "Priya S.", exam: "AIIMS Nursing 2023", quote: "TNC's structured notes and video lectures helped me score top rank in AIIMS Nursing exam." },
              { name: "Rahul M.", exam: "NORCET 2023", quote: "The faculty explains complex topics in simple terms. Best investment for nursing exam prep!" },
              { name: "Anjali K.", exam: "CHO 2023", quote: "E-notes are brilliant — concise, well-organized, and exam-focused. Cleared CHO in first attempt!" },
            ].map((t) => (
              <div key={t.name} className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <div className="flex gap-0.5 mb-3">
                  {[1,2,3,4,5].map((s) => <Star key={s} size={14} className="fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm text-gray-700 italic leading-relaxed mb-3">"{t.quote}"</p>
                <div>
                  <div className="text-sm font-bold text-gray-900">{t.name}</div>
                  <div className="text-xs text-blue-600 font-medium">{t.exam}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="tnc-brand-gradient text-white py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <div className="font-black text-lg mb-2">TNC Nursing Classes</div>
              <p className="text-white/70 text-sm leading-relaxed">
                India's trusted platform for nursing competitive exam preparation. Helping students achieve their dreams since 2019.
              </p>
            </div>
            <div>
              <div className="font-bold mb-3">Quick Links</div>
              <div className="space-y-1.5">
                {[
                  { path: "/", label: "Home" },
                  { path: "/courses", label: "Courses" },
                  { path: "/videos", label: "Videos" },
                  { path: "/enotes", label: "E-Notes" },
                ].map(({ path, label }) => (
                  <Link key={path} href={path} className="block text-white/70 hover:text-white text-sm transition-colors">
                    {label}
                  </Link>
                ))}
                <button
                  onClick={() => openExternalLink("https://test-sagar-jet.vercel.app/tnc-tests")}
                  className="block text-white/70 hover:text-white text-sm transition-colors text-left"
                >
                  Mock Tests
                </button>
              </div>
            </div>
            <div>
              <div className="font-bold mb-3">Contact</div>
              <p className="text-white/70 text-sm">For support and queries, reach us through our Telegram group or email.</p>
            </div>
          </div>
          <div className="border-t border-white/20 pt-4 text-center text-xs text-white/50">
            © 2024 TNC Nursing Classes. All rights reserved.
          </div>
        </div>
      </footer>
    </Layout>
  );
}
