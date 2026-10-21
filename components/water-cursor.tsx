"use client";

import { useEffect, useRef } from "react";

/** Tip of the cursor droplet sits at (14, 1.5) inside the 28x36 viewBox. */
const CURSOR_TIP_X = 14;
const CURSOR_TIP_Y = 2;
const DROP_LIFETIME_MS = 1000;

function dropletMarkup(color: string): string {
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="M12 1.5c0 0 8.6 10.6 8.6 15.7a8.6 8.6 0 1 1-17.2 0C3.4 12.1 12 1.5 12 1.5Z" fill="${color}"/></svg>`;
}

/**
 * Themed pointer: a blue pointed water-drop that trails the mouse, plus tiny
 * droplets that splash downward and fade out on each click.
 *
 * Only active for fine pointers and when the user has not asked for reduced
 * motion — otherwise the native cursor is left untouched.
 */
export function WaterCursor() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reducedMotion) return;

    const cursor = cursorRef.current;
    const layer = layerRef.current;
    if (!cursor || !layer) return;

    document.documentElement.classList.add("water-cursor-active");

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    const current = { x: target.x, y: target.y };
    let visible = false;
    let frame = 0;
    const timers: number[] = [];

    const render = () => {
      current.x += (target.x - current.x) * 0.4;
      current.y += (target.y - current.y) * 0.4;
      cursor.style.transform = `translate3d(${current.x - CURSOR_TIP_X}px, ${
        current.y - CURSOR_TIP_Y
      }px, 0)`;
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!visible) {
        visible = true;
        current.x = target.x;
        current.y = target.y;
        cursor.style.opacity = "1";
      }
    };

    const onLeave = () => {
      visible = false;
      cursor.style.opacity = "0";
    };

    const spawnDroplet = (x: number, y: number) => {
      if (!layer.isConnected) return;
      const droplet = document.createElement("span");
      droplet.className = "water-drop";
      const size = 5 + Math.random() * 6;
      droplet.style.width = `${size}px`;
      droplet.style.height = `${size}px`;
      droplet.style.left = `${x}px`;
      droplet.style.top = `${y}px`;
      droplet.innerHTML = dropletMarkup(Math.random() > 0.5 ? "#2f92b8" : "#7cc4de");
      layer.appendChild(droplet);

      if (typeof droplet.animate !== "function") {
        droplet.remove();
        return;
      }

      const driftX = (Math.random() - 0.5) * 90;
      const lift = 8 + Math.random() * 34;
      const fall = 140 + Math.random() * 190;
      const spin = (Math.random() - 0.5) * 90;

      const animation = droplet.animate(
        [
          { transform: "translate(-50%, -50%) translate(0, 0) scale(1)", opacity: 1 },
          {
            transform: `translate(-50%, -50%) translate(${driftX * 0.4}px, ${-lift}px) scale(0.95)`,
            opacity: 0.95,
            offset: 0.28,
          },
          {
            transform: `translate(-50%, -50%) translate(${driftX}px, ${fall}px) scale(0.55) rotate(${spin}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: DROP_LIFETIME_MS,
          easing: "cubic-bezier(.35,.02,.75,.5)",
          fill: "forwards",
        },
      );
      animation.onfinish = () => droplet.remove();
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const count = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i += 1) {
        timers.push(
          window.setTimeout(() => spawnDroplet(event.clientX, event.clientY), i * 35),
        );
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.documentElement.classList.remove("water-cursor-active");
      layer.replaceChildren();
    };
  }, []);

  return (
    <>
      <div ref={layerRef} className="water-drop-layer" aria-hidden="true" />
      <div ref={cursorRef} className="water-cursor" aria-hidden="true">
        <svg viewBox="0 0 28 36" width="28" height="36">
          <defs>
            <linearGradient id="water-cursor-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8fd3ea" />
              <stop offset="0.55" stopColor="#2f92b8" />
              <stop offset="1" stopColor="#1f6693" />
            </linearGradient>
          </defs>
          <path
            d="M14 1.5C14 1.5 25 15.5 25 23.5A11 11 0 1 1 3 23.5C3 15.5 14 1.5 14 1.5Z"
            fill="url(#water-cursor-fill)"
            stroke="#ffffff"
            strokeWidth="1.4"
          />
          <ellipse cx="9.5" cy="22" rx="2.2" ry="3.6" fill="rgba(255,255,255,0.75)" />
        </svg>
      </div>
    </>
  );
}
