"use client";

import { useEffect, useState } from "react";

/** Polled unread count for the header "Messages" nav item. */
export function UnreadBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/chat/unread");
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (active && typeof data.count === "number") {
          setCount(data.count);
        }
      } catch {
        // Offline / transient error: keep the last known count.
      }
    }

    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span
      className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-sunset px-1.5 text-xs font-bold text-ocean"
      aria-label={`${count} unread ${count === 1 ? "message" : "messages"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
