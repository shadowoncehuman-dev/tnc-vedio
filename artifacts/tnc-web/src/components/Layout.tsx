import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Video, FileText, Home, LogOut, Shield, Menu, X, ChevronRight, Brain, Trophy, Maximize2, Minimize2, MessageCircle } from "lucide-react";
import { getUser, isAdmin, clearAdminToken } from "@/lib/auth";
import { openExternalLink } from "@/lib/telegram";
import { getTelegramUser } from "@/lib/telegram";
import { AdSlot } from "@/components/Ads";

interface LayoutProps {
  children: React.ReactNode;
}

const TEST_SERIES_URL = "https://test-sagar-jet.vercel.app/tnc-tests";

type NavItem =
  | { path: string; label: string; icon: React.ElementType; external?: undefined }
  | { path: string; label: string; icon: React.ElementType; external: string };

const navItems: NavItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/videos", label: "Videos", icon: Video },
  { path: "/quiz", label: "Quiz", icon: Brain, external: TEST_SERIES_URL },
  { path: "/enotes", label: "E-Notes", icon: FileText },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/courses", label: "Courses", icon: BookOpen },
];

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const VISITOR_NAME_KEY = "tnc_visitor_name";
const VISITOR_ID_KEY = "tnc_visitor_id";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function VisitorGreeting() {
  const user = getUser();
  const telegramUser = getTelegramUser();
  const [name, setName] = useState(user?.name || telegramUser?.first_name || localStorage.getItem(VISITOR_NAME_KEY) || "");
  const [draftName, setDraftName] = useState(name);
  const [waifuUrl, setWaifuUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(VISITOR_ID_KEY)) {
      localStorage.setItem(VISITOR_ID_KEY, crypto.randomUUID());
    }
    if (name) localStorage.setItem(VISITOR_NAME_KEY, name);

    fetch("https://api.waifu.im/images?IncludedTags=waifu&IsNsfw=False&PageSize=1", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() as Promise<{ items?: Array<{ url?: string }> }> : null)
      .then((data) => {
        const url = data?.items?.[0]?.url;
        if (url?.startsWith("https://")) setWaifuUrl(url);
      })
      .catch(() => undefined);
  }, [name]);

  function saveName() {
    const value = draftName.trim().slice(0, 80);
    if (value) setName(value);
  }

  if (!name) {
    return (
      <section className="mx-auto my-4 flex max-w-5xl flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between" data-testid="visitor-name-prompt">
        <div>
          <p className="font-semibold text-gray-900">What should we call you?</p>
          <p className="text-xs text-gray-500">We use your name to personalize your study welcome.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveName(); }} placeholder="Your name" className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 sm:w-48" />
          <button onClick={saveName} disabled={!draftName.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Continue</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto my-4 flex max-w-5xl items-center gap-3 px-4" data-testid="visitor-greeting">
      {waifuUrl && <img src={waifuUrl} alt="Friendly study companion" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />}
      <div>
        <p className="text-lg font-black text-gray-900">{getGreeting()}, {name}.</p>
        <p className="text-sm text-gray-500">Ready for a focused study session?</p>
      </div>
    </section>
  );
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const admin = isAdmin();
  const showAds = location !== "/" && !/^\/(watch|videos|pdf|quiz)(\/|$)/.test(location);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const target = document.documentElement;
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      }
    } catch {
      // Ignore unsupported or blocked fullscreen requests.
    }
  }

  function handleAdminLogout() {
    clearAdminToken();
    setLocation("/");
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Desktop Top Nav */}
      <header className="tnc-brand-gradient shadow-lg sticky top-0 z-50 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src={`${BASE}/logo.svg`}
                alt="TNC"
                className="w-10 h-10 rounded-xl object-contain"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = "none";
                  const parent = t.parentElement;
                  if (parent) {
                    const div = document.createElement("div");
                    div.className = "w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-white text-lg";
                    div.textContent = "T";
                    parent.insertBefore(div, t);
                  }
                }}
              />
              <div className="text-white">
                <div className="font-bold text-base leading-none">TNC Nursing</div>
                <div className="text-xs text-white/70 font-medium">Classes</div>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon, external }) => {
                const active = !external && (location === path || (path !== "/" && location.startsWith(path)));
                const baseClass = `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-white/20 text-white" : "text-white/80 hover:text-white hover:bg-white/10"
                }`;
                if (external) {
                  return (
                    <button
                      key={path}
                      onClick={() => openExternalLink(external)}
                      className={baseClass}
                      data-testid={`nav-${label.toLowerCase()}`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                }
                return (
                  <Link key={path} href={path} className={baseClass} data-testid={`nav-${label.toLowerCase()}`}>
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Admin link */}
            <div className="flex items-center gap-2">
              {admin ? (
                <>
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-400/20 text-yellow-200 hover:bg-yellow-400/30 transition-colors border border-yellow-400/30"
                    data-testid="nav-admin"
                  >
                    <Shield size={14} />
                    Admin
                  </Link>
                  <button
                    onClick={handleAdminLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    data-testid="btn-logout"
                  >
                    <LogOut size={14} />
                    Logout
                  </button>
                </>
              ) : (
                <a
                  href="https://t.me/testsagarbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  data-testid="nav-support"
                >
                  <MessageCircle size={14} />
                  Support
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="tnc-brand-gradient shadow-lg sticky top-0 z-50 md:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={`${BASE}/logo.svg`}
              alt="TNC"
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-white font-bold text-sm">TNC Nursing</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-white p-1.5 rounded-lg bg-white/15"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              data-testid="btn-fullscreen"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            {admin && (
              <Link href="/admin" className="text-yellow-300 text-xs font-semibold px-2 py-1 rounded-lg bg-yellow-400/15">
                Admin
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white p-1"
              data-testid="btn-mobile-menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-white shadow-xl border-b z-50 py-2">
            {navItems.map(({ path, label, icon: Icon, external }) => {
              if (external) {
                return (
                  <button
                    key={path}
                    onClick={() => { openExternalLink(external); setMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    data-testid={`mobile-nav-${label.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      {label}
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </button>
                );
              }
              return (
                <Link
                  key={path}
                  href={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  data-testid={`mobile-nav-${label.toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    {label}
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              );
            })}
            {admin && (
              <div className="border-t mt-2 pt-2 px-4 space-y-1">
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-1 py-2 text-sm font-semibold text-yellow-600"
                >
                  <Shield size={16} />
                  Admin Panel
                </Link>
                <button
                  onClick={handleAdminLogout}
                  className="w-full flex items-center gap-2 px-1 py-2 text-sm text-red-600 font-medium"
                  data-testid="mobile-btn-logout"
                >
                  <LogOut size={16} />
                  Logout Admin
                </button>
              </div>
            )}
            {/* Support link */}
            <div className="border-t mt-2 pt-2 px-4">
              <a
                href="https://t.me/testsagarbot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <MessageCircle size={16} />
                Contact Admin / Support
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <VisitorGreeting />
        {children}
        {showAds && (
          <div className="pb-8 pt-2">
            <div className="hidden lg:block"><AdSlot size="728x90" /></div>
            <div className="lg:hidden"><AdSlot size="320x50" /></div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 flex" style={{ backgroundColor: "hsl(var(--card))" }}>
        {navItems.map(({ path, label, icon: Icon, external }) => {
          const active = !external && (location === path || (path !== "/" && location.startsWith(path)));
          const baseClass = `flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
            active ? "text-blue-600" : "text-gray-500"
          }`;
          if (external) {
            return (
              <button
                key={path}
                onClick={() => openExternalLink(external)}
                className={baseClass}
                data-testid={`tab-${label.toLowerCase()}`}
              >
                <Brain size={20} strokeWidth={1.8} />
                <span className="mt-0.5 text-[10px]">{label}</span>
              </button>
            );
          }
          return (
            <Link
              key={path}
              href={path}
              className={baseClass}
              data-testid={`tab-${label.toLowerCase()}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="mt-0.5 text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom padding for mobile tabs */}
      <div className="md:hidden h-16" />
    </div>
  );
}
