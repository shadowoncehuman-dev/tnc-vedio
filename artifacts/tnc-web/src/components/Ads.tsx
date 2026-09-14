import { useEffect, useRef } from "react";

declare global {
  interface Window {
    atOptions?: Record<string, unknown>;
  }
}

type AdSize = "468x60" | "300x250" | "160x300" | "160x600" | "320x50" | "728x90" | "native";

const AD_CONFIG: Record<AdSize, { key?: string; width: number; height: number }> = {
  "468x60": { key: "f257f22c762ef81eba7b84d14dd13d31", width: 468, height: 60 },
  "300x250": { key: "0a999493c87b0aa1a40d48420cb27ac2", width: 300, height: 250 },
  "160x300": { key: "05e1a710432ac4152611e895cff016ea", width: 160, height: 300 },
  "160x600": { key: "4ee96287cdcb2aa8908c601eff5245b4", width: 160, height: 600 },
  "320x50": { key: "25fd768a04b6690344dd6c3bce36426d", width: 320, height: 50 },
  "728x90": { key: "27963cda814de8535fe45a138ce16b41", width: 728, height: 90 },
  native: { width: 1, height: 1 },
};

export function AdSlot({ size, className = "" }: { size: AdSize; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const config = AD_CONFIG[size];

  useEffect(() => {
    const container = containerRef.current;
    if (!container || (!config.key && size !== "native")) return;

    container.replaceChildren();
    if (size === "native") {
      const script = document.createElement("script");
      script.async = true;
      script.dataset.cfasync = "false";
      script.src = "https://welcomingexpulsion.com/cde86f5292eeaba7b798f237488b8f57/invoke.js";
      container.appendChild(script);
      const nativeContainer = document.createElement("div");
      nativeContainer.id = "container-cde86f5292eeaba7b798f237488b8f57";
      container.appendChild(nativeContainer);
      return () => container.replaceChildren();
    }

    window.atOptions = {
      key: config.key,
      format: "iframe",
      height: config.height,
      width: config.width,
      params: {},
    };
    const script = document.createElement("script");
    script.src = `https://welcomingexpulsion.com/${config.key}/invoke.js`;
    script.async = false;
    script.dataset.adSize = size;
    container.appendChild(script);
    return () => container.replaceChildren();
  }, [config, size]);

  return (
    <div className={`flex justify-center overflow-hidden ${className}`} aria-label="Advertisement">
      <div ref={containerRef} style={{ width: config.width, minHeight: config.height, maxWidth: "100%" }} />
    </div>
  );
}

export function ContentAd({ size }: { size: AdSize }) {
  return (
    <div className="mx-auto my-6 w-full max-w-3xl px-4" data-testid={`ad-${size}`}>
      <AdSlot size={size} />
    </div>
  );
}