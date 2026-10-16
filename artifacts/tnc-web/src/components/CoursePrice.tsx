export default function CoursePrice({ price }: { price?: string | number | null }) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={`Original price ₹${amount.toLocaleString("en-IN")}; free for you by Zxkai`}>
      <span className="text-xs font-medium text-gray-400 line-through">₹{amount.toLocaleString("en-IN")}</span>
      <span className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Free for you by Zxkai</span>
    </div>
  );
}