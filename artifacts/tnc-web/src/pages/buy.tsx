import { useGetCourses, useGetPromoStatus, useGetUserPurchases, useCreatePurchase, getGetUserPurchasesQueryKey, getGetCoursesQueryKey } from "@/lib/api-client";
import { ShoppingCart, CheckCircle, Lock, ArrowRight, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import Layout from "@/components/Layout";
import { getUser } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const RAZORPAY_KEY = "rzp_live_in5lCZ8NOaheGp";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as Record<string, unknown>).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const COURSE_PRICES: Record<string, number> = {};

function getPriceForCourse(courseId: string, courseName: string): number {
  if (COURSE_PRICES[courseId]) return COURSE_PRICES[courseId];
  const name = courseName.toLowerCase();
  if (name.includes("live") || name.includes("batch")) return 2999;
  if (name.includes("series") || name.includes("daily")) return 1499;
  if (name.includes("complete") || name.includes("full")) return 3999;
  return 1999;
}

export default function BuyPage() {
  const user = getUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: courses, isLoading } = useGetCourses();
  const { data: promo } = useGetPromoStatus();
  const { data: purchases } = useGetUserPurchases(user?.userId ?? "", {
    query: { enabled: !!user, queryKey: getGetUserPurchasesQueryKey(user?.userId ?? "") },
  });

  const createPurchase = useCreatePurchase();

  const purchasedIds = new Set((purchases ?? []).map((p) => p.courseId));

  async function handleBuy(courseRowId: string, courseName: string) {
    if (!user) {
      toast({ title: "Login required", description: "Please login to purchase a course", variant: "destructive" });
      setLocation("/login");
      return;
    }

    const price = getPriceForCourse(courseRowId, courseName);
    const loaded = await loadRazorpay();

    if (!loaded) {
      toast({ title: "Payment failed", description: "Unable to load payment gateway. Check your connection.", variant: "destructive" });
      return;
    }

    const options = {
      key: RAZORPAY_KEY,
      amount: price * 100, // paise
      currency: "INR",
      name: "TNC Nursing Classes",
      description: courseName,
      handler: (response: { razorpay_payment_id: string }) => {
        createPurchase.mutate(
          {
            data: {
              userId: user.userId,
              courseId: courseRowId,
              courseName,
              amount: price,
              paymentId: response.razorpay_payment_id,
            },
          },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetUserPurchasesQueryKey(user.userId) });
              toast({ title: "Purchase successful!", description: `You now have access to ${courseName}` });
            },
            onError: () => {
              toast({ title: "Payment received", description: "Please contact support if access is not granted.", variant: "destructive" });
            },
          }
        );
      },
      prefill: {
        name: user.name,
        contact: user.mobile,
        email: user.email ?? undefined,
      },
      theme: { color: "#2546b0" },
      modal: { escape: true },
    };

    const rzp = new ((window as unknown as Record<string, unknown>).Razorpay as new (o: unknown) => { open: () => void })(options);
    rzp.open();
  }

  return (
    <Layout>
      {/* Header */}
      <div className="tnc-brand-gradient text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-black mb-1">Buy Courses</h1>
          <p className="text-white/70 text-sm">Invest in your nursing career with structured exam preparation</p>
        </div>
      </div>

      {/* Promo banner */}
      {promo?.enabled && (
        <div className="tnc-amber-gradient text-white px-4 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Sparkles size={20} />
            <div>
              <div className="font-bold text-sm">Promotional Mode Active — All Content is Free!</div>
              <div className="text-xs text-white/80">
                No purchase needed right now.{promo.expiresAt && ` Offer ends ${new Date(promo.expiresAt).toLocaleDateString("en-IN")}.`}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Login prompt */}
        {!user && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-semibold text-blue-900 text-sm">Login to purchase courses</p>
              <p className="text-xs text-blue-600 mt-0.5">Your purchases will be saved to your account</p>
            </div>
            <div className="flex gap-2">
              <Link href="/login" className="px-4 py-2 rounded-lg border border-blue-600 text-blue-600 text-sm font-medium" data-testid="btn-login-buy">Login</Link>
              <Link href="/register" className="px-4 py-2 rounded-lg tnc-brand-gradient text-white text-sm font-semibold" data-testid="btn-register-buy">Register Free</Link>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border">
                <div className="h-44 skeleton" />
                <div className="p-4 space-y-2">
                  <div className="h-5 skeleton rounded w-3/4" />
                  <div className="h-4 skeleton rounded w-1/2" />
                  <div className="h-10 skeleton rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(courses ?? []).map((course, i) => {
              const alreadyPurchased = purchasedIds.has(course.rowId);
              const price = getPriceForCourse(course.rowId, course.name);

              return (
                <motion.div
                  key={course.rowId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col group hover:shadow-lg transition-shadow"
                  data-testid={`card-buy-${course.rowId}`}
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
                    <img
                      src="https://i.pinimg.com/736x/18/75/01/18750180cc2f14a2a18493ae12b000cd.jpg"
                      alt={course.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {alreadyPurchased && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-white text-xs font-semibold">
                        <CheckCircle size={11} /> Purchased
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1 line-clamp-2">{course.name}</h3>

                    {!promo?.enabled && (
                      <div className="flex items-baseline gap-1 mt-1 mb-3">
                        <span className="text-2xl font-black text-blue-700">₹{price.toLocaleString("en-IN")}</span>
                        <span className="text-xs text-gray-400 line-through">₹{(price * 1.5).toLocaleString("en-IN")}</span>
                      </div>
                    )}

                    <div className="mt-auto pt-2">
                      {alreadyPurchased ? (
                        <Link
                          href={`/courses/${course.rowId}`}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-50 text-green-700 border border-green-200 text-sm font-semibold"
                          data-testid={`btn-access-${course.rowId}`}
                        >
                          <CheckCircle size={16} /> Access Course
                        </Link>
                      ) : promo?.enabled ? (
                        <Link
                          href={`/courses/${course.rowId}`}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl tnc-amber-gradient text-gray-900 text-sm font-bold"
                          data-testid={`btn-free-access-${course.rowId}`}
                        >
                          <Sparkles size={14} /> Access Free
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleBuy(course.rowId, course.name)}
                          disabled={createPurchase.isPending}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl tnc-brand-gradient text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                          data-testid={`btn-buy-course-${course.rowId}`}
                        >
                          <ShoppingCart size={14} />
                          Buy for ₹{price.toLocaleString("en-IN")}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Trust signals */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { title: "Secure Payments", desc: "Powered by Razorpay with 100% payment security" },
            { title: "Instant Access", desc: "Get immediate access to all course content after payment" },
            { title: "No Expiry", desc: "Lifetime access to all purchased course materials" },
          ].map((item) => (
            <div key={item.title} className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100" data-testid={`trust-${item.title.replace(/ /g, "-").toLowerCase()}`}>
              <div className="font-bold text-blue-900 text-sm mb-1">{item.title}</div>
              <p className="text-xs text-blue-700/70">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
