/**
 * Ambient, fixed water backdrop shown behind every page: soft currents plus
 * layered SVG waves that drift horizontally on a slow loop. Purely decorative.
 *
 * Each wave spans two identical periods (viewBox 2400 wide, path period 600)
 * so translating the layer by -50% loops seamlessly. Opacity stays at 5-10%.
 */
export function PageBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Soft currents drifting behind the content */}
      <div className="absolute -left-32 -top-28 h-96 w-96 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute -right-36 top-1/3 h-[30rem] w-[30rem] rounded-full bg-seaglass/20 blur-3xl" />
      <div className="absolute bottom-10 -left-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      {/* Layered wave bands */}
      <svg
        className="wave-layer wave-layer--a absolute left-0 top-20 h-56 text-brand"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        fill="none"
        opacity="0.07"
      >
        <path
          d="M0 100 Q 150 30 300 100 T 600 100 T 900 100 T 1200 100 T 1500 100 T 1800 100 T 2100 100 T 2400 100 L 2400 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>

      <svg
        className="wave-layer wave-layer--b absolute left-0 top-1/2 h-64 text-accent"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        fill="none"
        opacity="0.05"
      >
        <path
          d="M0 120 Q 150 50 300 120 T 600 120 T 900 120 T 1200 120 T 1500 120 T 1800 120 T 2100 120 T 2400 120 L 2400 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>

      <svg
        className="wave-layer wave-layer--c absolute bottom-0 left-0 h-72 text-seaglass"
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
        fill="none"
        opacity="0.09"
      >
        <path
          d="M0 90 Q 150 20 300 90 T 600 90 T 900 90 T 1200 90 T 1500 90 T 1800 90 T 2100 90 T 2400 90 L 2400 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
