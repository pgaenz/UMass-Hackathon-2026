"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Get-or-create entry point. The server enforces the permission matrix, so this
 * button is only rendered when `canMessage` already passes.
 */
export function MessageButton({
  participantId,
  label = "Message",
  variant = "primary",
  size = "md",
}: {
  participantId: string;
  label?: string;
  variant?: "primary" | "brand" | "secondary" | "ghost";
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { thread?: { id?: string }; error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(data?.error ?? "Could not open the conversation.");
      }

      const threadId = data?.thread?.id;
      if (!threadId) throw new Error("Could not open the conversation.");
      router.push(`/messages/${threadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} size={size} onClick={handleClick} disabled={loading}>
        {loading ? "Opening…" : label}
      </Button>
      {error ? (
        <span role="alert" className="text-sm font-medium text-coral">
          {error}
        </span>
      ) : null}
    </span>
  );
}
