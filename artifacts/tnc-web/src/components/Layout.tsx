import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Video, FileText, Home, LogOut, Shield, Menu, X, ChevronRight, Brain, Trophy, Maximize2, Minimize2, MessageCircle, Send, UserRound } from "lucide-react";
import { getUser, isAdmin, clearAdminToken } from "@/lib/auth";
import { openExternalLink } from "@/lib/telegram";
import { getTelegramUser } from "@/lib/telegram";
import { AdSlot } from "@/components/Ads";

interface LayoutProps {
  children: React.ReactNode;
}

const TEST_SERIES_URL = "https://test.tncnursing.site/tnc-tests";
const SUPPORT_URL = "https://t.me/testsagarbot";
const CHANNEL_URL = "https://t.me/tnc_test_series_free";

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

function ResponsiveAd() {
  const [size, setSize] = useState<"468x60" | "320x50" | "728x90">("320x50");

  useEffect(() => {
    const sync = () => {
      setSize(window.matchMedia("(min-width: 1024px)").matches ? "728x90" : window.matchMedia("(min-width: 768px)").matches ? "468x60" : "320x50");
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return <AdSlot size={size} />;
}

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
    if (value) {
      setName(value);
      window.dispatchEvent(new CustomEvent("tnc-visitor-name-updated", { detail: value }));
    }
  }

  return (
    <>
      {name && (
        <section className="mx-auto my-5 flex max-w-6xl items-center gap-3 px-4" data-testid="visitor-greeting">
          {waifuUrl && <img src={waifuUrl} alt="Friendly study companion" className="h-12 w-12 rounded-full border-2 border-[hsl(var(--secondary))] object-cover" loading="lazy" />}
          <div>
            <p className="text-lg font-black text-gray-900">{getGreeting()}, {name}.</p>
            <p className="text-sm text-gray-500">Ready for a focused study session?</p>
          </div>
        </section>
      )}
      {!name && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-labelledby="visitor-name-title" data-testid="visitor-name-modal">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"><UserRound size={23} /></div>
            <h2 id="visitor-name-title" className="text-center text-xl font-black text-gray-900">Welcome to TNC Nursing</h2>
            <p className="mt-2 text-center text-sm text-gray-500">Enter your name to continue. We use it for your study greeting and leaderboard.</p>
            <form onSubmit={(event) => { event.preventDefault(); saveName(); }} className="mt-5 space-y-3">
              <input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Enter your name" maxLength={80} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" data-testid="input-visitor-name" />
              <button type="submit" disabled={!draftName.trim()} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50" data-testid="btn-save-visitor-name">Continue</button>
            </form>
          </div>
        </div>
      )}
    </>
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
      <header className="sticky top-0 z-50 hidden border-b border-white/10 bg-[hsl(var(--primary))] shadow-lg md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src={`${BASE}/l1.jpg`}
                alt="TNC"
                className="w-10 h-10 rounded-xl object-cover"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  if (t.src.endsWith("/l1.jpg")) {
                    t.src = `${BASE}/logo.svg`;
                    t.className = "w-10 h-10 object-contain";
                    return;
                  }
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
                <div className="font-black text-base leading-none tracking-tight">TNC / NURSING</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/60">Study desk</div>
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
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  data-testid="nav-support"
                >
                  <MessageCircle size={14} />
                  Support
                </a>
              )}
              <a
                href={CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/15 text-white hover:bg-white/25 transition-colors"
                data-testid="nav-join-channel"
              >
                <Send size={14} />
                Join Channel
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(var(--primary))] shadow-lg md:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={`${BASE}/l1.jpg`}
              alt="TNC"
              className="w-8 h-8 rounded-lg object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.endsWith("/l1.jpg")) {
                  target.src = `${BASE}/logo.svg`;
                  target.className = "w-8 h-8 object-contain";
                } else {
                  target.style.display = "none";
                }
              }}
            />
            <span className="text-white font-black text-sm tracking-tight">TNC / NURSING</span>
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
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <MessageCircle size={16} />
                Contact Admin / Support
              </a>
              <a
                href={CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                data-testid="mobile-join-channel"
              >
                <Send size={16} />
                Join Channel for Updates
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="study-grid flex-1">
        <VisitorGreeting />
        {children}
        {showAds && (
          <div className="pb-8 pt-2">
            <ResponsiveAd />
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
