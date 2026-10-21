/**
 * Layered, drifting water waves used inside dark Ocean sections.
 * Each layer spans two path periods so the horizontal loop is seamless.
 * Motion is disabled via prefers-reduced-motion in globals.css.
 */
export function WaterLines({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <svg
        className="wave-layer wave-layer--a absolute bottom-8 left-0 h-36 text-seaglass"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        fill="none"
        opacity="0.3"
      >
        <path
          d="M0 90 Q 150 20 300 90 T 600 90 T 900 90 T 1200 90 T 1500 90 T 1800 90 T 2100 90 T 2400 90 L 2400 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>

      <svg
        className="wave-layer wave-layer--b absolute bottom-0 left-0 h-44 text-accent"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        fill="none"
        opacity="0.22"
      >
        <path
          d="M0 110 Q 150 40 300 110 T 600 110 T 900 110 T 1200 110 T 1500 110 T 1800 110 T 2100 110 T 2400 110 L 2400 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>

      <svg
        className="wave-layer wave-layer--c absolute -bottom-4 left-0 h-52 text-seaglass"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        fill="none"
        opacity="0.16"
      >
        <path
          d="M0 130 Q 150 60 300 130 T 600 130 T 900 130 T 1200 130 T 1500 130 T 1800 130 T 2100 130 T 2400 130 L 2400 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
