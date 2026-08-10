import { useEffect, useState } from "react";
import { Trophy, Medal, Clock3 } from "lucide-react";
import Layout from "@/components/Layout";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface LeaderboardRow {
  telegramId: string;
  firstName: string;
  username: string | null;
  seconds: number;
}

function formatStudyTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/bot/study/leaderboard`)
      .then((response) => response.ok ? response.json() as Promise<LeaderboardRow[]> : [])
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="tnc-hero-gradient text-white px-4 py-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
            <Trophy size={28} className="text-yellow-300" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black">Study Leaderboard</h1>
            <p className="text-white/70 text-sm mt-1">Celebrate consistent study time with the TNC community.</p>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-16 skeleton rounded-2xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
            <Trophy size={42} className="mx-auto text-gray-200 mb-3" />
            <p className="font-semibold">No study activity yet</p>
            <p className="text-sm text-gray-400 mt-1">Start a lesson and your time will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {rows.map((row, index) => (
              <div key={row.telegramId} className="flex items-center gap-3 px-5 py-4 border-b last:border-0 border-gray-50">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                  index === 0 ? "bg-yellow-100 text-yellow-700" : index === 1 ? "bg-gray-100 text-gray-600" : index === 2 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-600"
                }`}>
                  {index < 3 ? <Medal size={17} /> : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{row.firstName || "Student"}</p>
                  {row.username && <p className="text-xs text-gray-400">@{row.username}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-blue-700">
                  <Clock3 size={15} />
                  {formatStudyTime(row.seconds)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}