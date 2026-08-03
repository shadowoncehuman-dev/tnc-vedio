import { ShieldX } from "lucide-react";

export default function BannedScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-[9999] p-8"
      style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)" }}>
      <div className="text-center max-w-sm">
        <div className="w-24 h-24 rounded-full bg-red-100 border-4 border-red-300 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <ShieldX size={48} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-red-900 mb-3">You Are Blocked</h1>
        <p className="text-red-700 font-semibold text-lg mb-2">You can't access this platform.</p>
        <p className="text-red-500 text-sm mt-4 leading-relaxed">
          Your account has been blocked by an administrator.<br />
          If you believe this is a mistake, please contact support.
        </p>
        <div className="mt-8 px-5 py-3 rounded-2xl bg-red-100 border border-red-200 text-xs text-red-600">
          🚫 Access Denied
        </div>
      </div>
    </div>
  );
}
