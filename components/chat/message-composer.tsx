"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export interface SendResult {
  ok: boolean;
  error?: string;
  crisis?: boolean;
}

/**
 * Composer with Enter-to-send / Shift+Enter newline. The parent owns delivery
 * (optimistic append + screening); this only manages the draft and the inline
 * reason a message was refused. The draft is preserved on failure so nothing is
 * lost.
 */
export function MessageComposer({
  onSend,
  recipientName,
}: {
  onSend: (body: string) => Promise<SendResult>;
  recipientName: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setCrisis(false);
    const result = await onSend(trimmed);
    if (result.ok) {
      setText("");
    } else {
      setError(result.error ?? "We could not send that message.");
      setCrisis(Boolean(result.crisis));
    }
    setSending(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="message-body" className="sr-only">
        Write a message to {recipientName}
      </label>
      <textarea
        id="message-body"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        maxLength={2000}
        placeholder={`Write to ${recipientName}…`}
        className="w-full rounded-2xl border-2 border-seaglass bg-white/80 p-4 text-lg leading-relaxed text-ink focus:border-brand"
      />

      <p className="text-sm text-ink/60">
        Never share bank details, passwords, or your home address.
      </p>

      {error ? (
        <p
          role="alert"
          className={
            crisis
              ? "rounded-xl border-2 border-coral bg-coral/10 p-3 text-base font-medium text-ink"
              : "text-base font-medium text-coral"
          }
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink/50">Enter to send · Shift+Enter for a new line</span>
        <Button type="submit" disabled={sending || !text.trim()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
