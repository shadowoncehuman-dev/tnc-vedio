import { useState, useEffect, useCallback } from "react";
import { useAdminLogin, useGetAdminStats, useGetAdminUsers, useTogglePromo, useGetPromoStatus, getGetAdminStatsQueryKey, getGetAdminUsersQueryKey, getGetPromoStatusQueryKey } from "@/lib/api-client";
import { Shield, Users, BookOpen, Video, ShoppingCart, Search, LogOut, ToggleLeft, ToggleRight, RefreshCw, Calendar, Plus, Minus, Clock, Bot, Ban, CheckCircle } from "lucide-react";
import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "wouter";

const ADMIN_TOKEN_HEADER = "admin_tnc_2024_secure_token";
const QUICK_DAYS = [7, 14, 30, 60, 90];
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const adminLogin = useAdminLogin();
  const { toast } = useToast();

  const schema = z.object({ password: z.string().min(1, "Password required") });
  const form = useForm<{ password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  function onSubmit(values: { password: string }) {
    adminLogin.mutate(
      { data: { password: values.password } },
      {
        onSuccess: (res) => {
          setAdminToken((res as { token: string }).token);
          onLogin();
          toast({ title: "Admin logged in", description: "Welcome to the admin panel" });
        },
        onError: () => {
          toast({ title: "Access denied", description: "Invalid admin password", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="min-h-screen tnc-hero-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 flex items-center justify-center mx-auto mb-4 border-2 border-yellow-400/40">
            <Shield size={32} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Admin Panel</h1>
          <p className="text-white/60 text-sm mt-1">Restricted access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Enter admin password" data-testid="input-admin-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full tnc-brand-gradient text-white font-semibold" disabled={adminLogin.isPending} data-testid="btn-admin-login">
                {adminLogin.isPending ? "Verifying..." : "Login"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">Back to site</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, note }: { icon: React.ElementType; label: string; value: string | number; color: string; note?: string }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
      data-testid={`stat-card-${label.replace(/ /g, "-").toLowerCase()}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="text-2xl font-black text-gray-900">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-sm text-gray-500 font-medium mt-0.5">{label}</div>
      {note && <div className="text-xs text-gray-400 mt-1">{note}</div>}
    </motion.div>
  );
}

function PromoManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: promo, refetch } = useGetPromoStatus();
  const togglePromo = useTogglePromo();
  const [customDays, setCustomDays] = useState(30);
  const [extending, setExtending] = useState(false);

  async function handleTogglePromo(enabled: boolean, days = customDays) {
    togglePromo.mutate(
      { data: { enabled, durationDays: days, adminToken: ADMIN_TOKEN_HEADER } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getGetPromoStatusQueryKey() });
          refetch();
          toast({
            title: (res as { enabled: boolean }).enabled ? `Free period enabled for ${days} days` : "Free period disabled",
            description: (res as { message: string }).message,
          });
        },
        onError: () => toast({ title: "Failed to update promo", variant: "destructive" }),
      }
    );
  }

  async function handleExtend(days: number) {
    setExtending(true);
    try {
      const resp = await fetch(`${BASE}/api/promo/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationDays: days, adminToken: ADMIN_TOKEN_HEADER }),
      });
      const data = await resp.json() as { message: string; expiresAt: string };
      queryClient.invalidateQueries({ queryKey: getGetPromoStatusQueryKey() });
      refetch();
      toast({ title: `Extended by ${days} days`, description: data.message });
    } catch {
      toast({ title: "Extension failed", variant: "destructive" });
    } finally {
      setExtending(false);
    }
  }

  const expiresDate = promo?.expiresAt ? new Date(promo.expiresAt) : null;
  const daysRemaining = expiresDate
    ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" />
            Free Period Manager
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {promo?.enabled
              ? `Active — expires ${expiresDate?.toLocaleDateString("en-IN")} (${daysRemaining} days left)`
              : "Inactive — users must purchase courses"}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
          promo?.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          {promo?.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {promo?.enabled ? "ON" : "OFF"}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">Duration (days):</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_DAYS.map((d) => (
            <button key={d} onClick={() => setCustomDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                customDays === d ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
              }`}
            >{d}d</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCustomDays((d) => Math.max(1, d - 1))}
            className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <Minus size={14} />
          </button>
          <input type="number" min={1} max={365} value={customDays}
            onChange={(e) => setCustomDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
            className="w-16 text-center border rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => setCustomDays((d) => Math.min(365, d + 1))}
            className="w-8 h-8 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-50">
            <Plus size={14} />
          </button>
          <span className="text-sm text-gray-400">days</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!promo?.enabled ? (
          <button onClick={() => handleTogglePromo(true, customDays)} disabled={togglePromo.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl tnc-amber-gradient text-gray-900 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            data-testid="btn-enable-promo">
            <ToggleRight size={16} /> Enable Free Period ({customDays}d)
          </button>
        ) : (
          <>
            <button onClick={() => handleExtend(customDays)} disabled={extending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
              data-testid="btn-extend-promo">
              <Clock size={16} /> {extending ? "Extending..." : `Extend by ${customDays}d`}
            </button>
            <button onClick={() => handleTogglePromo(false)} disabled={togglePromo.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-60"
              data-testid="btn-disable-promo">
              <ToggleLeft size={16} /> Disable
            </button>
          </>
        )}
      </div>

      {promo?.enabled && expiresDate && (
        <div className="bg-green-50 rounded-xl p-3 text-xs text-green-800 border border-green-100">
          <strong>Free period is active.</strong> All content unlocked until{" "}
          <strong>{expiresDate.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>
          {" "}({daysRemaining} days remaining).
        </div>
      )}
    </div>
  );
}

interface BotUserItem {
  id: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  firstSeen: string;
  lastSeen: string;
}

function BotUsersPanel() {
  const { toast } = useToast();
  const [users, setUsers] = useState<BotUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [banned, setBanned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/bot/users?page=${p}&limit=20`, {
        headers: { "x-admin-token": ADMIN_TOKEN_HEADER },
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json() as { users: BotUserItem[]; total: number; banned: number };
      setUsers(data.users);
      setTotal(data.total);
      setBanned(data.banned ?? 0);
    } catch {
      toast({ title: "Failed to load bot users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { fetchUsers(page); }, [page]);

  async function handleBan(telegramId: string, currentlyBanned: boolean) {
    setActionLoading(telegramId);
    const endpoint = currentlyBanned ? "unban" : "ban";
    try {
      const resp = await fetch(`${BASE}/api/bot/users/${telegramId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN_HEADER },
        body: JSON.stringify({ reason: "Banned by admin via panel" }),
      });
      if (!resp.ok) throw new Error("Failed");
      toast({ title: currentlyBanned ? "User unbanned" : "User banned" });
      fetchUsers(page);
    } catch {
      toast({ title: `Failed to ${endpoint} user`, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-black text-gray-900">Telegram Bot Users</h3>
            <p className="text-xs text-gray-400">{total} total · {banned} banned</p>
          </div>
        </div>
        <button onClick={() => fetchUsers(page)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 skeleton rounded" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          <Bot size={32} className="mx-auto text-gray-200 mb-2" />
          No bot users yet — users appear here when they open the Telegram Mini App
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Telegram ID</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.telegramId} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                        {(u.firstName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-xs">
                          {u.firstName}{u.lastName ? " " + u.lastName : ""}
                        </div>
                        {u.username && <div className="text-xs text-gray-400">@{u.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.telegramId}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {u.firstSeen ? String(u.firstSeen).split("T")[0] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.isBanned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {u.isBanned ? <><Ban size={10} /> Banned</> : <><CheckCircle size={10} /> Active</>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleBan(u.telegramId, u.isBanned)}
                      disabled={actionLoading === u.telegramId}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                        u.isBanned
                          ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                          : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      }`}
                    >
                      {actionLoading === u.telegramId ? "…" : u.isBanned ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="px-5 py-3 border-t flex items-center justify-between">
          <span className="text-xs text-gray-500">Page {page} of {totalPages} ({total} users)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 rounded-lg border text-xs font-medium disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border text-xs font-medium disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "bot-users">("overview");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetAdminStats();
  const { data: usersData, isLoading: usersLoading } = useGetAdminUsers(
    { page, limit: 20, search },
    { query: { queryKey: getGetAdminUsersQueryKey({ page, limit: 20, search }) } }
  );

  function handleLogout() {
    clearAdminToken();
    window.location.reload();
  }

  const totalPages = Math.ceil((usersData?.total ?? 0) / 20);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Header */}
      <div className="tnc-brand-gradient text-white px-4 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Shield size={18} />
          </div>
          <div>
            <div className="font-black text-base">Admin Panel</div>
            <div className="text-white/60 text-xs">TNC Nursing Classes</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-white/60 hover:text-white text-xs transition-colors px-2" data-testid="btn-admin-site">View Site</Link>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors" data-testid="btn-admin-logout">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b px-4">
        <div className="max-w-6xl mx-auto flex gap-1 pt-3">
          {([
            { id: "overview", label: "Overview", icon: Shield },
            { id: "bot-users", label: "Bot Users", icon: Bot },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors ${
                activeTab === id
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {activeTab === "bot-users" ? (
          <BotUsersPanel />
        ) : (
          <>
            {/* Stats */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-gray-900">Overview</h2>
                <button
                  onClick={() => { refetchStats(); toast({ title: "Stats refreshed" }); }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
              {statsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 skeleton rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Students" value={stats?.totalUsers ?? 0} color="bg-blue-600" />
                  <StatCard icon={BookOpen} label="Courses" value={stats?.totalCourses ?? 0} color="bg-indigo-600" />
                  <StatCard icon={Video} label="Video Sessions" value={(stats?.totalSessions ?? 59806).toLocaleString()} color="bg-purple-600" note="From live CRM" />
                  <StatCard icon={ShoppingCart} label="Purchases" value={stats?.totalPurchases ?? 0} color="bg-amber-500" />
                </div>
              )}
            </div>

            {/* Free Period Manager */}
            <PromoManager />

            {/* Users table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-black text-gray-900">
                  All Students
                  <span className="ml-2 text-sm font-normal text-gray-400">({usersData?.total ?? 0} total)</span>
                </h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search students..."
                      className="pl-8 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      data-testid="input-search-users"
                    />
                  </div>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey({}) })}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    data-testid="btn-refresh-users"
                    title="Refresh users"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {usersLoading ? (
                  <div className="space-y-2 p-4">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 skeleton rounded" />)}
                  </div>
                ) : !usersData?.users.length ? (
                  <div className="py-12 text-center text-gray-500 text-sm">No students found</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-3">#</th>
                        <th className="text-left px-4 py-3">Name</th>
                        <th className="text-left px-4 py-3">Mobile</th>
                        <th className="text-left px-4 py-3">College</th>
                        <th className="text-left px-4 py-3">State</th>
                        <th className="text-left px-4 py-3">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.users.map((user, i) => (
                        <tr key={user.rowId} className="border-t border-gray-50 hover:bg-blue-50/30 transition-colors" data-testid={`row-user-${user.rowId}`}>
                          <td className="px-4 py-3 text-gray-400 text-xs">{(page - 1) * 20 + i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{user.name}</div>
                            {user.email && <div className="text-xs text-gray-400">{user.email}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">{user.mobile}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-32">{user.college ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{user.state ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{user.createdAt ? String(user.createdAt).split("T")[0] : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-3 border-t flex items-center justify-between">
                  <span className="text-xs text-gray-500">Page {page} of {totalPages} ({usersData?.total ?? 0} students)</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1 rounded-lg border text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      data-testid="btn-prev-page">Previous</button>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1 rounded-lg border text-xs font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
                      data-testid="btn-next-page">Next</button>
                  </div>
                </div>
              )}
            </div>

            {/* Recent users from stats */}
            {stats?.recentUsers && stats.recentUsers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h3 className="font-black text-gray-900">Recently Registered</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.recentUsers.map((u) => (
                    <div key={u.rowId} className="flex items-center gap-3 px-5 py-3" data-testid={`recent-user-${u.rowId}`}>
                      <div className="w-8 h-8 rounded-full tnc-brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(u.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{u.name || "Unknown"}</div>
                        <div className="text-xs text-gray-400">{u.mobile}{u.state ? ` · ${u.state}` : ""}</div>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">{u.createdAt ? String(u.createdAt).split("T")[0] : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!getAdminToken());
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;
  return <AdminDashboard />;
}
