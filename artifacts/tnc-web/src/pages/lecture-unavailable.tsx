import { Link } from "wouter";
import { CloudOff } from "lucide-react";

export default function LectureUnavailablePage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-6 text-slate-900"
      style={{
        background:
          "radial-gradient(circle at top left, #eef2ff 0%, transparent 35%), radial-gradient(circle at bottom right, #e0f2fe 0%, transparent 35%), #f8fafc",
      }}
    >
      <section className="w-full max-w-[560px] rounded-[28px] border border-slate-200 bg-white/90 px-5 py-9 text-center shadow-[0_25px_70px_rgba(15,23,42,0.10),0_4px_12px_rgba(15,23,42,0.04)] backdrop-blur-[15px] sm:px-8 sm:py-11">
        <div
          aria-hidden="true"
          className="mx-auto mb-[22px] flex h-[175px] w-[175px] items-center justify-center rounded-full bg-indigo-50 text-indigo-500 sm:h-[210px] sm:w-[210px]"
        >
          <CloudOff size={92} strokeWidth={1.4} />
        </div>

        <div
          role="status"
          className="mb-[15px] inline-flex items-center gap-2 rounded-full bg-orange-50 px-[13px] py-[7px] text-xs font-bold text-orange-700"
        >
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-orange-500" />
          Service Temporarily Unavailable
        </div>

        <h1 className="mb-[15px] text-[31px] font-extrabold leading-[1.15] tracking-[-1px] sm:text-[43px]">
          Oops! Something went wrong.
        </h1>

        <p className="mx-auto mb-[22px] max-w-[440px] text-[15px] leading-[1.7] text-slate-500 sm:text-base">
          We couldn&apos;t connect to the service right now. The API connection appears to be unavailable or the server
          didn&apos;t return the expected response.
        </p>

        <div className="mx-auto mb-[26px] rounded-[14px] border border-slate-200 bg-slate-50 p-[15px] text-left">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-slate-700">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_4px_#fee2e2]"
            />
            API Connection Issue
          </div>
          <div className="break-all font-mono text-[13px] text-slate-500">crm.tncnursing.in</div>
          <p className="mt-[7px] text-xs text-slate-400">
            The requested API could not be reached or its response could not be fetched successfully.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-[13px] bg-indigo-600 px-[23px] py-[13px] text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.22)] transition hover:-translate-y-0.5 hover:bg-indigo-700"
          >
            ↻ Try Again
          </button>
          <Link
            href="/"
            className="rounded-[13px] bg-slate-100 px-[23px] py-[13px] text-[15px] font-bold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-200"
          >
            ← Go Home
          </Link>
        </div>

        <p className="mt-7 text-xs leading-relaxed text-slate-400">
          This is usually a temporary server or network issue. Please try again in a few moments.
        </p>
      </section>
    </main>
  );
}
