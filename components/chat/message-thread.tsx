"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MessageComposer, type SendResult } from "@/components/chat/message-composer";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import type { ChatMessageView, OtherParticipant } from "@/lib/types";

const POLL_MS = 4_000;

function mergeById(
  current: ChatMessageView[],
  incoming: ChatMessageView[],
): ChatMessageView[] {
  const map = new Map<string, ChatMessageView>();
  for (const message of current) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Thread history with polling and optimistic send.
 * `role="log"` + `aria-live="polite"` announce incoming messages to screen
 * readers. Polling pauses while the tab is hidden.
 */
export function MessageThread({
  threadId,
  other,
  viewerId,
  initialMessages,
  initialCanSend,
}: {
  threadId: string;
  other: OtherParticipant;
  viewerId: string;
  initialMessages: ChatMessageView[];
  initialCanSend: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [canSend, setCanSend] = useState(initialCanSend);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(initialMessages.at(-1)?.id ?? null);

  async function markRead() {
    try {
      await fetch(`/api/chat/threads/${threadId}/read`, { method: "POST" });
    } catch {
      // A failed receipt is harmless; the next visit retries.
    }
  }

  useEffect(() => {
    async function poll() {
      if (document.visibilityState !== "visible") return;
      const after = lastIdRef.current;
      try {
        const url = after
          ? `/api/chat/threads/${threadId}/messages?after=${encodeURIComponent(after)}`
          : `/api/chat/threads/${threadId}/messages`;
        const res = await fetch(url);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: ChatMessageView[];
          canSend?: boolean;
        };
        if (typeof data.canSend === "boolean") setCanSend(data.canSend);

        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((current) => mergeById(current, data.messages!));
          lastIdRef.current = data.messages.at(-1)!.id;
          if (data.messages.some((message) => !message.mine)) {
            // Receiving a message implies the other person has seen mine.
            setMessages((current) =>
              current.map((message) =>
                message.mine ? { ...message, seen: true } : message,
              ),
            );
            void markRead();
          }
        }
      } catch {
        // Network hiccup: try again on the next tick.
      }
    }

    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(body: string): Promise<SendResult> {
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessageView = {
      id: tempId,
      senderId: viewerId,
      body,
      createdAt: new Date().toISOString(),
      mine: true,
      seen: false,
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: ChatMessageView; error?: string; crisis?: boolean }
        | null;

      if (!res.ok) {
        setMessages((current) => current.filter((message) => message.id !== tempId));
        return {
          ok: false,
          error: data?.error ?? "We could not send that message.",
          crisis: Boolean(data?.crisis),
        };
      }

      if (data?.message) {
        setMessages((current) =>
          mergeById(
            current.filter((message) => message.id !== tempId),
            [data.message!],
          ),
        );
        lastIdRef.current = data.message.id;
      }
      return { ok: true };
    } catch {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      return { ok: false, error: "We could not send that message. Please try again." };
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${other.name}`}
        className="flex max-h-[60vh] min-h-64 flex-col gap-3 overflow-y-auto rounded-2xl glass shadow-water p-5"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-lg text-ink/70">
            This is the beginning of your conversation with {other.name}.
          </p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={cn("flex", message.mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 shadow-water",
                  message.mine
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm bg-white/85 text-ink",
                )}
              >
                <p className="whitespace-pre-wrap text-lg leading-relaxed">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-right text-sm",
                    message.mine ? "text-white/75" : "text-ink/80",
                  )}
                  suppressHydrationWarning
                >
                  {formatTime(message.createdAt)}
                  {message.mine ? (message.seen ? " · Seen" : " · Sent") : ""}
                </p>
              </div>
            </article>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <MessageComposer onSend={send} recipientName={other.name} />
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-seaglass p-5 text-lg text-ink/70">
          This conversation is closed. You can no longer send messages here.
        </p>
      )}
    </div>
  );
}
