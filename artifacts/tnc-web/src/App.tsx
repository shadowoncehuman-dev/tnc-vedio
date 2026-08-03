import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BannedScreen from "@/components/BannedScreen";
import PageLoader from "@/components/PageLoader";
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

function App() {
  const [banned, setBanned] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If inside Telegram, do Telegram-specific setup
    if (isTelegramWebApp()) {
      readyTelegramApp();
      expandTelegramApp();
    }

    const tgUser = getTelegramUser();

    if (tgUser) {
      // Register/check ban status for Telegram users
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
          // If check fails, allow access
        })
        .finally(() => setChecking(false));
    } else {
      // Non-Telegram browser — skip registration, go straight to app
      setChecking(false);
    }
  }, []);

  if (checking) return <PageLoader />;
  if (banned) return <BannedScreen />;

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

export default App;
