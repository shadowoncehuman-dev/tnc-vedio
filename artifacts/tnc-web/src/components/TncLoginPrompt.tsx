import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { AlertCircle, LockKeyhole, Phone, X } from "lucide-react";
import { ApiError, customFetch } from "@/lib/api-client/custom-fetch";

interface TncSessionStatus {
  available: boolean;
  expiresAt: string | null;
  reason?: "missing" | "expired" | null;
}

function requestBody<T>(url: string, body: Record<string, string>): Promise<T> {
  return customFetch<T>(url, { method: "POST", body: JSON.stringify(body) });
}

function errorDetails(error: unknown): { message: string; code?: string } {
  if (error instanceof ApiError && error.data && typeof error.data === "object") {
    const data = error.data as Record<string, unknown>;
    return {
      message: typeof data.error === "string" ? data.error : error.message,
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }
  return { message: error instanceof Error ? error.message : "TNC login failed" };
}

export default function TncLoginPrompt({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [deviceConflict, setDeviceConflict] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const sessionQuery = useQuery({
    queryKey: ["tnc-shared-session"],
    queryFn: () => customFetch<TncSessionStatus>("/api/tnc/auth/session"),
    enabled,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (enabled && sessionQuery.data?.available === false) setOpen(true);
  }, [enabled, sessionQuery.data]);

  useEffect(() => {
    if (!enabled) return;
    const requireLoginWithReason = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      setOpen(true);
      setErrorMessage(reason === "expired"
        ? "The shared TNC session expired. Sign in again to continue."
        : "Sign in with a TNC Nursing account. This shared session will serve visitors until it expires.");
      void queryClient.setQueryData(["tnc-shared-session"], { available: false, expiresAt: null });
    };
    window.addEventListener("tnc-session-required", requireLoginWithReason);
    return () => window.removeEventListener("tnc-session-required", requireLoginWithReason);
  }, [enabled, queryClient]);

  async function completeLogin() {
    setOpen(false);
    setDeviceConflict(false);
    setOtpSent(false);
    setPassword("");
    setOtp("");
    setErrorMessage("");
    setNotice("");
    queryClient.setQueryData<TncSessionStatus>(["tnc-shared-session"], { available: true, expiresAt: null });
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const error = query.state.error;
        return error instanceof ApiError && error.status === 428 &&
          error.data !== null && typeof error.data === "object" &&
          (error.data as Record<string, unknown>).code === "TNC_LOGIN_REQUIRED";
      },
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      await requestBody("/api/tnc/auth/login", { mobile: mobile.trim(), password });
      await completeLogin();
    } catch (error) {
      const details = errorDetails(error);
      if (details.code === "TNC_DEVICE_CONFLICT") setDeviceConflict(true);
      setErrorMessage(details.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      const response = await requestBody<{ msg?: string }>("/api/tnc/auth/send-otp", { mobile: mobile.trim() });
      setOtpSent(true);
      setNotice(response.msg ?? "OTP sent successfully.");
    } catch (error) {
      setErrorMessage(errorDetails(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      await requestBody("/api/tnc/auth/reset-device", { mobile: mobile.trim(), password, otp: otp.trim() });
      await completeLogin();
    } catch (error) {
      setErrorMessage(errorDetails(error).message);
    } finally {
      setBusy(false);
    }
  }

  if ((!enabled && !open) || (!open && !sessionQuery.isError)) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="tnc-login-title">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close login dialog">
          <X size={18} />
        </button>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><LockKeyhole size={19} /></div>
        <h2 id="tnc-login-title" className="text-xl font-bold text-gray-900">TNC student login</h2>
        <p className="mt-1 pr-5 text-sm text-gray-500">Sign in with your TNC Nursing account to load courses and test series.</p>
        <form onSubmit={deviceConflict && otpSent ? resetDevice : login} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-gray-700" htmlFor="tnc-mobile">Mobile number</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="tnc-mobile" required inputMode="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="10-digit mobile number" />
          </div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="tnc-password">Password</label>
          <input id="tnc-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="TNC account password" />
          {deviceConflict && otpSent && (
            <>
              <label className="block text-sm font-medium text-gray-700" htmlFor="tnc-otp">Verification code</label>
              <input id="tnc-otp" required inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Enter the OTP" />
            </>
          )}
          {errorMessage && <p className="flex items-start gap-2 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{errorMessage}</p>}
          {notice && <p className="text-sm text-green-700" role="status">{notice}</p>}
          <button type="submit" disabled={busy || (deviceConflict && !otpSent)} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
            {busy ? "Please wait..." : deviceConflict && otpSent ? "Verify and reset device" : "Sign in"}
          </button>
          {deviceConflict && !otpSent && (
            <button type="button" onClick={sendOtp} disabled={busy || !mobile.trim()} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Send verification code
            </button>
          )}
          {deviceConflict && otpSent && (
            <button type="button" onClick={sendOtp} disabled={busy} className="w-full text-sm font-medium text-blue-700 hover:underline disabled:opacity-50">
              Resend code
            </button>
          )}
        </form>
        {sessionQuery.isError && <p className="mt-3 text-xs text-amber-700">Shared sign-in status could not be checked. A successful login will retry the connection.</p>}
      </div>
    </div>
  );
}