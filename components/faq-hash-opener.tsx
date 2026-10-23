"use client";

import { useEffect } from "react";

/**
 * Native <details> elements do not open themselves when a URL points at one of
 * their ids. Support links such as /help#privacy should reveal the answer, so
 * open the targeted entry on load and on later hash changes.
 */
export function FaqHashOpener() {
  useEffect(() => {
    function openTarget() {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      const target = document.getElementById(id);
      if (target instanceof HTMLDetailsElement) {
        // The header sticks to the top and can wrap to two or three rows, so
        // reserve its real height instead of a fixed scroll margin.
        const header = document.querySelector("header");
        const offset = Math.ceil((header?.getBoundingClientRect().height ?? 0) + 16);
        target.style.scrollMarginTop = `${offset}px`;
        target.open = true;

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({
          block: "start",
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }
    }

    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);

  return null;
}
