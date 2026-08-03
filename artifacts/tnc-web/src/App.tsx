import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BannedScreen from "@/components/BannedScreen";
import { getTelegramUser, readyTelegramApp, expandTelegramApp, isTelegramWebApp, openExternalLink } from "@/lib/telegram";

import HomePage from "@/pages/home";
import CoursesPage from "@/pages/courses";
import CourseDetailPage from "@/pages/course-detail";
import VideosPage from "@/pages/videos";
import EnotesPage from "@/pages/enotes";
import AdminPage from "@/pages/admin";
import WatchPage from "@/pages/watch";
import PdfViewerPage from "@/pages/pdf-viewer";
import NotFound from "@/pages/not-found";

const TEST_SERIES_URL = "https://test-sagar-jet.vercel.app/tnc-tests";

// Redirect component — immediately opens the external test series and goes back
function TestSeriesRedirect() {
  useEffect(() => {
    openExternalLink(TEST_SERIES_URL);
  }, []);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function TelegramGate() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
      style={{ background: "linear-gradient(135deg, #1a237e 0%, #283593 50%, #1565c0 100%)" }}
    >
      <div style={{ fontSize: 64, marginBottom: 24 }}>📱</div>
      <h1 className="text-2xl font-black text-white mb-3">Open in Telegram</h1>
      <p className="text-white/70 text-sm max-w-xs leading-relaxed">
        TNC Nursing Classes is only available through the Telegram bot. Please open the app using the button in the bot.
      </p>
      <div className="mt-8 px-5 py-2 rounded-xl bg-white/10 border border-white/20 text-white/50 text-xs">
        Direct browser access is not supported
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/courses" component={CoursesPage} />
      <Route path="/courses/:courseId" component={CourseDetailPage} />
      <Route path="/videos" component={VideosPage} />
      <Route path="/enotes" component={EnotesPage} />
      <Route path="/quiz" component={TestSeriesRedirect} />
      <Route path="/quiz/:examId" component={TestSeriesRedirect} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/watch/:sessionId" component={WatchPage} />
      <Route path="/pdf/:sessionId" component={PdfViewerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Inner app — only rendered when inside Telegram
function AppInner() {
  const [banned, setBanned] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    readyTelegramApp();
    expandTelegramApp();

    const tgUser = getTelegramUser();
    if (!tgUser) return;

    setChecking(true);

    fetch(`${BASE}/api/bot/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: tgUser.id,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      }),
    })
      .then((r) => r.json())
      .then((data: { banned?: boolean }) => {
        if (data.banned) setBanned(true);
      })
      .catch(() => {
        // If check fails, allow access rather than blocking
      })
      .finally(() => setChecking(false));
  }, []);

  if (banned) return <BannedScreen />;
  if (checking) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  // Block direct browser access — only works inside Telegram Mini App
  if (!isTelegramWebApp()) {
    return <TelegramGate />;
  }
  return <AppInner />;
}

export default App;
