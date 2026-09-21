import { Component, type ErrorInfo, type ReactNode, useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BannedScreen from "@/components/BannedScreen";
import PageLoader from "@/components/PageLoader";
import SecurityGuard from "@/components/SecurityGuard";
import { getTelegramInitData, getTelegramUser, readyTelegramApp, expandTelegramApp, isTelegramWebApp, openExternalLink } from "@/lib/telegram";

import HomePage from "@/pages/home";
import CoursesPage from "@/pages/courses";
import CourseDetailPage from "@/pages/course-detail";
import SubjectDetailPage from "@/pages/subject-detail";
import VideosPage from "@/pages/videos";
import EnotesPage from "@/pages/enotes";
import AdminPage from "@/pages/admin";
import WatchPage from "@/pages/watch";
import PdfViewerPage from "@/pages/pdf-viewer";
import NotFound from "@/pages/not-found";
import LeaderboardPage from "@/pages/leaderboard";

const TEST_SERIES_URL = "https://test.tncnursing.site/tnc-tests";

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

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 px-4 py-20 text-center">
          <h1 className="text-xl font-black text-gray-900">This page could not be loaded</h1>
          <p className="mt-2 text-sm text-gray-500">Please try again or return to your courses.</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <a href={`${BASE}/courses`} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
              Back to courses
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/courses" component={CoursesPage} />
      <Route path="/courses/:courseId/subjects/:subjectId" component={SubjectDetailPage} />
      <Route path="/courses/:courseId" component={CourseDetailPage} />
      <Route path="/videos" component={VideosPage} />
      <Route path="/enotes" component={EnotesPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
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
    const initData = getTelegramInitData();

    if (tgUser) {
      fetch(`${BASE}/api/bot/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: tgUser.id,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          initData,
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

  // Security guard - runs on every page load
  // This component handles keyboard blocking, devtools detection, and request blocking
  // It renders null but sets up all security measures in useEffect

  if (checking) return <PageLoader />;
  if (banned) return <BannedScreen />;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SecurityGuard />
        <AppErrorBoundary>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AppErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
