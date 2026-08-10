import { useState } from "react";
import { useAdminLogin, useGetAdminStats, useTogglePromo, useGetPromoStatus, getGetPromoStatusQueryKey } from "@/lib/api-client";
import { Shield, Users, BookOpen, Video, ShoppingCart, LogOut, ToggleLeft, ToggleRight, RefreshCw, Calendar, Plus, Minus, Clock } from "lucide-react";
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
      { data: { enabled, durationDays: days, adminToken: getAdminToken() ?? "" } },
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
        body: JSON.stringify({ durationDays: days, adminToken: getAdminToken() ?? "" }),
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

function AdminDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetAdminStats();

  function handleLogout() {
    clearAdminToken();
    window.location.reload();
  }

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

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
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

        </>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!getAdminToken());
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;
  return <AdminDashboard />;
}
