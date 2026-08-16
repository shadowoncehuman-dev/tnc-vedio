import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Video, FileText, Home, LogOut, Shield, Menu, X, ChevronRight, Brain, Trophy, Maximize2, Minimize2, MessageCircle } from "lucide-react";
import { isAdmin, clearAdminToken } from "@/lib/auth";
import { openExternalLink } from "@/lib/telegram";

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

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const admin = isAdmin();

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
        {children}
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
