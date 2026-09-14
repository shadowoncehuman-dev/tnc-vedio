import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface StudyEmptyStateProps {
  title: string;
  message?: string;
  compact?: boolean;
}

export default function StudyEmptyState({ title, message = "Check back soon", compact = false }: StudyEmptyStateProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://api.waifu.im/images?IncludedTags=waifu&IsNsfw=False&PageSize=1", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() as Promise<{ items?: Array<{ url?: string }> }> : null)
      .then((data) => {
        const url = data?.items?.[0]?.url;
        if (url?.startsWith("https://")) setImageUrl(url);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className={`mx-auto flex max-w-xl flex-col items-center text-center ${compact ? "py-12" : "py-20"}`} data-testid="study-empty-state">
      <div className="relative mb-6">
        <div className="absolute -inset-2 border border-[hsl(var(--secondary))]" />
        {imageUrl ? (
          <img src={imageUrl} alt="Friendly study companion" className={`${compact ? "h-28 w-28" : "h-40 w-40"} relative object-cover`} loading="lazy" />
        ) : (
          <div className={`${compact ? "h-28 w-28" : "h-40 w-40"} relative animate-pulse bg-[hsl(var(--muted))]`} />
        )}
        <div className="absolute -bottom-3 -right-3 flex h-9 w-9 items-center justify-center bg-[hsl(var(--primary))] text-[hsl(var(--secondary))]">
          <Sparkles size={16} />
        </div>
      </div>
      <p className="display-serif text-2xl text-[hsl(var(--foreground))]">{title}</p>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
    </div>
  );
}