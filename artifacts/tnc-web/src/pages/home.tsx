import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useGetSliders, useGetCourses } from "@/lib/api-client";
import { Video, FileText, Award, ChevronLeft, ChevronRight, ArrowRight, CheckCircle, Star, Flame, Brain, Zap, Sparkles, Stethoscope } from "lucide-react";
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
    <div className="relative mx-auto mt-2 w-full max-w-6xl overflow-hidden border-y border-[hsl(var(--border))] bg-black" style={{ aspectRatio: "16/6" }}>
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
      className="group overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[4px_4px_0_hsl(165_48%_24%_/_0.12)] transition-shadow hover:shadow-[7px_7px_0_hsl(71_68%_53%_/_0.7)]"
    >
      <div className="relative h-44 overflow-hidden bg-[hsl(var(--muted))]">
        <img
          src="https://i.pinimg.com/736x/18/75/01/18750180cc2f14a2a18493ae12b000cd.jpg"
          alt={course.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {isNew && (
          <div className="absolute left-3 top-3 flex items-center gap-0.5 bg-[hsl(var(--secondary))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--foreground))]">
            <Zap size={9} /> NEW
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">{course.name}</h3>
        {course.description && course.description !== "" && course.description !== "Description" && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          <Link
            href={`/courses/${course.rowId}`}
            className="flex-1 text-center py-2 px-3 text-xs font-semibold text-white tnc-brand-gradient hover:opacity-90 transition-opacity"
          >
            View Course
          </Link>
          <Link
            href="/buy"
            className="flex-1 text-center py-2 px-3 text-xs font-semibold border border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] transition-colors"
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
      <SliderCarousel />
      <StreakWidget />

      {/* Editorial hero */}
      <section className="tnc-hero-gradient overflow-hidden px-4 py-14 text-white md:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--secondary))]">
              <Sparkles size={14} /> The focused study desk
            </div>
            <h1 className="display-serif max-w-3xl text-5xl leading-[0.98] md:text-7xl">
              Make your next<br />
              <span className="text-[hsl(var(--secondary))]">attempt count.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              A calmer, sharper way to prepare for NORCET, AIIMS, CHO and the exams that move your nursing career forward.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/courses"
                className="flex items-center justify-center gap-2 bg-[hsl(var(--secondary))] px-7 py-3.5 text-sm font-bold text-[hsl(var(--foreground))] shadow-[5px_5px_0_hsl(10_78%_61%)] transition-transform hover:-translate-y-1"
                data-testid="hero-btn-courses"
              >
                Start with courses <ArrowRight size={16} />
              </Link>
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 border border-white/30 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                data-testid="hero-btn-register"
              >
                Meet the community <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }} className="relative mx-auto w-full max-w-md">
            <div className="absolute -right-3 -top-3 h-full w-full border border-[hsl(var(--secondary))]" />
            <div className="relative bg-[hsl(var(--card))] p-3 text-[hsl(var(--foreground))] editorial-shadow">
              <div className="relative h-64 overflow-hidden bg-[hsl(var(--muted))] md:h-80">
                <img src="https://i.pinimg.com/736x/18/75/01/18750180cc2f14a2a18493ae12b000cd.jpg" alt="Nursing study material" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--secondary))]"><Stethoscope size={14} /> Exam room ready</div>
                  <p className="display-serif text-2xl">Study less scattered. Remember more.</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-1 pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                <span>Video / notes / tests</span><span>01 — 03</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] py-7">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-0 divide-x divide-[hsl(var(--border))] px-4 md:grid-cols-4">
          {[
            { value: "1,50,000+", label: "Students Enrolled" },
            { value: `${courseList.length || "90"}+`, label: "Courses" },
            { value: "59,000+", label: "Video Lectures" },
            { value: "6,700+", label: "Mock Tests" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-black text-[hsl(var(--primary))] md:text-3xl">{stat.value}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16" style={{ backgroundColor: "hsl(var(--background))" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--accent))]">Your toolkit</p><h2 className="display-serif text-4xl text-[hsl(var(--foreground))]">Built for the long haul.</h2></div>
            <p className="max-w-xs text-sm text-[hsl(var(--muted-foreground))]">Everything you need to keep your preparation moving, even on ordinary days.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -4 }}
                className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-transform hover:-translate-y-1"
              >
                <div className="mb-8 flex h-11 w-11 items-center justify-center bg-[hsl(var(--primary))]">
                  <Icon size={21} className="text-[hsl(var(--secondary))]" />
                </div>
                <h3 className="mb-1 text-sm font-bold text-[hsl(var(--foreground))]">{title}</h3>
                <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Preview — newest first, skip loading flicker */}
      <section className="bg-[hsl(var(--card))] px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-7 flex items-end justify-between border-b border-[hsl(var(--border))] pb-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--accent))]">The library</p>
              <h2 className="display-serif text-4xl text-[hsl(var(--foreground))]">Choose your next win.</h2>
            </div>
            <Link
              href="/courses"
              className="hidden items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))] hover:underline sm:flex"
              data-testid="link-all-courses"
            >
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {coursesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
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
      <section className="tnc-hero-gradient px-4 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-xl"><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--secondary))]">Know the route</p><h2 className="display-serif text-4xl">One desk. Many destinations.</h2><p className="mt-3 text-sm leading-relaxed text-white/65">Build a focused plan for the exam that matters to you, then keep showing up.</p></div>
          <div className="flex flex-wrap gap-3">
            {exams.map((exam) => (
              <div
                key={exam}
                className="border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
              >
                {exam}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[hsl(var(--background))] px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between border-b border-[hsl(var(--border))] pb-5"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--accent))]">Field notes</p><h2 className="display-serif text-4xl text-[hsl(var(--foreground))]">Proof from the desk.</h2></div><span className="hidden text-xs font-bold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] sm:block">Student voices / 2023—24</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: "Priya S.", exam: "AIIMS Nursing 2023", quote: "TNC's structured notes and video lectures helped me score top rank in AIIMS Nursing exam." },
              { name: "Rahul M.", exam: "NORCET 2023", quote: "The faculty explains complex topics in simple terms. Best investment for nursing exam prep!" },
              { name: "Anjali K.", exam: "CHO 2023", quote: "E-notes are brilliant — concise, well-organized, and exam-focused. Cleared CHO in first attempt!" },
            ].map((t) => (
              <div key={t.name} className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
                <div className="flex gap-0.5 mb-3">
                  {[1,2,3,4,5].map((s) => <Star key={s} size={14} className="fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="display-serif mb-3 text-lg leading-relaxed text-[hsl(var(--foreground))]">"{t.quote}"</p>
                <div>
                  <div className="text-sm font-bold text-gray-900">{t.name}</div>
                  <div className="text-xs font-medium text-[hsl(var(--accent))]">{t.exam}</div>
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
