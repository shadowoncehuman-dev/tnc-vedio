import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BannedScreen from "@/components/BannedScreen";
import { getTelegramUser, readyTelegramApp, expandTelegramApp } from "@/lib/telegram";

import HomePage from "@/pages/home";
import CoursesPage from "@/pages/courses";
import CourseDetailPage from "@/pages/course-detail";
import VideosPage from "@/pages/videos";
import EnotesPage from "@/pages/enotes";
import BuyPage from "@/pages/buy";
import AdminPage from "@/pages/admin";
import WatchPage from "@/pages/watch";
import PdfViewerPage from "@/pages/pdf-viewer";
import QuizPage from "@/pages/quiz";
import QuizTakePage from "@/pages/quiz-take";
import NotFound from "@/pages/not-found";

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
      <Route path="/quiz" component={QuizPage} />
      <Route path="/quiz/:examId" component={QuizTakePage} />
      <Route path="/buy" component={BuyPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/watch/:sessionId" component={WatchPage} />
      <Route path="/pdf/:sessionId" component={PdfViewerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [banned, setBanned] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    readyTelegramApp();
    expandTelegramApp();

    const tgUser = getTelegramUser();
    if (!tgUser) return; // Not opened from Telegram, skip ban check

    setChecking(true);

    // Register Telegram user + check ban status
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
  // Show nothing briefly while ban check runs (< 1s)
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

export default App;
