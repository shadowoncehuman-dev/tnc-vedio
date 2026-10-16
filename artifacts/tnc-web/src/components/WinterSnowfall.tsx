import type { CSSProperties } from "react";

const flakes = [
  { left: 4, delay: 5, duration: 24, size: 8, opacity: 0.34, drift: 22, twist: 190 },
  { left: 12, delay: 13, duration: 31, size: 13, opacity: 0.52, drift: -36, twist: 250 },
  { left: 20, delay: 2, duration: 27, size: 7, opacity: 0.3, drift: 28, twist: 160 },
  { left: 29, delay: 9, duration: 34, size: 16, opacity: 0.48, drift: -24, twist: 280 },
  { left: 39, delay: 17, duration: 26, size: 9, opacity: 0.36, drift: 34, twist: 210 },
  { left: 48, delay: 1, duration: 32, size: 12, opacity: 0.44, drift: -32, twist: 230 },
  { left: 57, delay: 12, duration: 29, size: 8, opacity: 0.32, drift: 20, twist: 170 },
  { left: 66, delay: 7, duration: 35, size: 15, opacity: 0.5, drift: -28, twist: 300 },
  { left: 75, delay: 15, duration: 25, size: 10, opacity: 0.38, drift: 30, twist: 200 },
  { left: 84, delay: 4, duration: 33, size: 7, opacity: 0.28, drift: -22, twist: 150 },
  { left: 93, delay: 19, duration: 28, size: 14, opacity: 0.46, drift: 26, twist: 260 },
];

export default function WinterSnowfall({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <div className="winter-snowfall" aria-hidden="true">
      {flakes.map((flake, index) => (
        <span
          key={index}
          className="winter-snowfall__flake"
          style={{
            left: `${flake.left}%`,
            animationDelay: `-${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
            fontSize: `${flake.size}px`,
            "--flake-opacity": flake.opacity,
            "--flake-drift": `${flake.drift}px`,
            "--flake-twist": `${flake.twist}deg`,
          } as CSSProperties}
        >
          ❄
        </span>
      ))}
    </div>
  );
}