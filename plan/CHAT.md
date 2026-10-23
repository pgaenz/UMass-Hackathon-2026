# HistorAI — 1:1 Messaging (Chat) Plan

> Status: **approved for build.** Decisions confirmed by product owner (see §2).
> Scope: private 1:1 text messaging so Rivers can form real relationships — with other
> Rivers **and** with Drops — plus discovery, unread state, and a safety gate that runs
> **before** a message is delivered.
> Companion plans: [`PROFILES.md`](./PROFILES.md) · [`SAFETY.md`](./SAFETY.md) ·
> [`ROADMAP.md`](./ROADMAP.md). Tracker: [`README.md`](./README.md).

---

## 1. Product summary

The platform already connects generations through questions, answers and stories. This
feature adds **direct, private conversation** so people can go from reading about each
other to actually knowing each other — "for a loneli-less world."

- **Rivers** (older adults) are the hub of the network: they can message **anyone**.
- **Drops** (young people) can message **anyone**, including other Drops.
- A conversation is always exactly two distinct users; any signed-in pair is allowed.
- **1:1 only** in this iteration (no group rooms).
- **Safety before speed.** Every outbound message is screened server-side and hard-blocked
  if it looks like a scam, a contact-details leak, or abuse — *before it is stored*. A
  few-second poll is an acceptable delivery latency; we will not trade screening for
  instant delivery.

### Terminology (avoid the existing name collision)

`Conversation` / `data/conversations.json` **already means the AI voice interview**. Do not
reuse those names. For this feature:

| Concept | Code | UI label |
|---------|------|----------|
| A 1:1 private exchange | `ChatThread` / `thread` | **Messages** |
| One message in a thread | `ChatMessage` / `message` | message |
| "A River you can talk to" | directory entry | **Connect** |

---

## 2. Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Who can message whom | **Any signed-in user → any other user (Drop ↔ Drop allowed).** |
| 2 | Conversation size | **1:1 only.** Group/community rooms deferred. |
| 3 | Discovery | **Rivers directory (`/connect`) + "Message" button on public profiles.** Shared-interest hints shown. No connect-request/accept gate in v1. |
| 4 | Realtime | **Client polling (~4 s), paused when the tab is hidden.** No WebSockets. |
| 5 | Safety policy | **Screen every message before storing.** Hard-block scams/PII/abuse. Block + report + rate limit required. **Safety before speed.** |
| 6 | Voice messages | **Not in v1.** Reserved in the data model (`kind`) for a later release. |
| 7 | Feature name | UI = **"Messages"**. Code = `ChatThread` / `ChatMessage`. |
| 8 | Storage | Single **`data/chat.json`** using the shared `mutateJson` lock. Demo-scale only. |
| 9 | Visitors | **No chat access** — signed-in users only. |
| 10 | Age display | Age **band** + role only, never exact age (consistent with `toPublicUser`). |
| 11 | Read state | Simple "Seen" receipts. No typing indicators. |
| 12 | Attachments | None in v1 (no images, files, or links rendered as previews). |

---

## 3. Permission model

A thread is legal iff it has exactly two distinct, existing users. Any pair is allowed
(Drop ↔ Drop included); only self-messaging is rejected.

```ts
// lib/chat.ts
export function canMessage(a: Role, b: Role): boolean {
  return true;
}
```

| Sender ↓ / Recipient → | River | Drop |
|------------------------|:-----:|:----:|
| **River** | ✅ | ✅ |
| **Drop** | ✅ | ✅ |

- Enforced in the UI (button hidden for self/visitors) **and** authoritatively in every API
  handler and in `getOrCreateThread` (never trust the client).
- Blocking is per user and wins over the matrix: if either side has blocked the other, the
  thread is read-only and new messages are refused.
- Visitors have no `userId`, so they can never appear in a thread.

---

## 4. Target flows

```
Public profile (/profile/[id])            /connect  (Rivers directory)
        │  [ Message ]                            │  [ Message ]
        └───────────────┬─────────────────────────┘
                        ▼
             POST /api/chat/threads { participantId }
                        │  (get-or-create by pairKey; permission checked)
                        ▼
                  /messages/[threadId]
        ┌───────────────────────────────────────────┐
        │  thread history (poll every ~4 s)          │
        │  composer → POST .../messages              │
        │        │                                    │
        │        ▼                                    │
        │   screenMessage()  ── block ──► inline      │
        │        │ allow                              │
        │        ▼                                    │
        │   persisted + returned (optimistic UI)      │
        └───────────────────────────────────────────┘
                        │
                        ▼
              /messages  inbox  +  header unread badge
```

---

## 5. Data model

### New file: `data/chat.json`

```jsonc
{
  "threads": [
    {
      "id": "t-<uuid>",
      "participantIds": ["u-a", "u-b"],   // exactly 2, sorted ascending
      "pairKey": "u-a|u-b",               // unique — prevents duplicate threads
      "status": "active",                  // "active" | "archived"
      "messages": [
        {
          "id": "m-<uuid>",
          "senderId": "u-a",
          "kind": "text",                  // "text" now; "voice" reserved for later
          "body": "Hello — I read your story about the garden.",
          "safety": { "verdict": "allow", "flags": [] },
          "readBy": ["u-a"],
          "createdAt": "2026-10-22T18:25:04.622Z",
          "deletedAt": null
        }
      ],
      "createdAt": "2026-10-22T18:20:00.000Z",
      "updatedAt": "2026-10-22T18:25:04.622Z",
      "lastMessageAt": "2026-10-22T18:25:04.622Z"   // denormalized for inbox sort
    }
  ],
  "blocks": [
    { "blockerId": "u-a", "blockedId": "u-b", "createdAt": "2026-10-22T18:30:00.000Z" }
  ]
}
```

Normalization rules (mirror `lib/conversations.ts`): missing arrays default to `[]`;
participant ids are sorted; `pairKey` is derived, never trusted from input; `readBy`
defaults to `[senderId]`.

### New types in `lib/types.ts`

```ts
export type ChatThreadStatus = "active" | "archived";
export type ChatSafetyVerdict = "allow" | "block";

export interface ChatSafety {
  verdict: ChatSafetyVerdict;
  flags: string[];                 // e.g. ["scam:wire", "pii:phone", "link"]
}

export interface ChatMessage {
  id: string;
  senderId: string;
  kind: "text";                    // future: "voice"
  body: string;
  safety: ChatSafety;
  readBy: string[];
  createdAt: string;
  deletedAt: string | null;
}

export interface ChatThread {
  id: string;
  participantIds: [string, string];
  pairKey: string;
  status: ChatThreadStatus;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface ChatBlock {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

// ---- wire shapes ----
export interface ThreadSummary {
  threadId: string;
  other: { id: string; name: string; role: Role; ageBand: AgeBand };
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ChatMessageView {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface SendMessageRequest {
  body: string;
}
```

---

## 6. `lib/chat.ts` (mirrors `lib/questions.ts` / `lib/conversations.ts`)

All reads/writes go through the shared per-file lock (`mutateJson`) so concurrent sends
cannot clobber each other.

```ts
getThread(id): Promise<ChatThread | null>
getOrCreateThread(a: User, b: User): Promise<ChatThread>          // enforces canMessage
listThreadsForUser(userId): Promise<ThreadSummary[]>              // newest first
getThreadMessages(threadId, viewerId, afterId?): Promise<ChatMessageView[]>
appendMessage(threadId, senderId, body, safety): Promise<ChatMessage>
markThreadRead(threadId, userId): Promise<number>                 // returns unread after
countUnread(userId): Promise<number>
isBlocked(a: string, b: string): Promise<boolean>
blockUser(blockerId, blockedId): Promise<void>
```

`listThreadsForUser` resolves the other participant through `getPublicUserMap` (one pass,
same as the feed) so names/age bands render without N+1 reads.

---

## 7. API contract (`app/api/chat/…`)

All handlers: `export const runtime = "nodejs"`, guarded with `authorize(["river", "drop"])`,
and every handler re-checks thread membership + permission server-side. Errors use the
existing `{ "error": string }` shape.

### `GET /api/chat/threads`
Inbox for the signed-in user.
- **200** `{ "threads": ThreadSummary[] }`

### `POST /api/chat/threads`
Get-or-create a thread with `participantId`.
- **Body** `{ "participantId": "u-…" }`
- **201** `{ "thread": ChatThread }` (created) · **200** `{ "thread": ChatThread }` (existing)
- **Errors** `400` missing/self id · `403` not permitted · `404` unknown user · `401` no session

### `GET /api/chat/threads/[id]/messages?after=<messageId>`
Fetch thread history; with `after`, only messages newer than that id (poll delta).
- **200** `{ "threadId": string, "other": AuthorRef, "messages": ChatMessageView[] }`
- **Errors** `403` not a participant · `404` unknown thread

### `POST /api/chat/threads/[id]/messages`
Send a message. **Screens first, stores only if allowed.**
- **Body** `SendMessageRequest` `{ "body": "…" }`
- **201** `{ "message": ChatMessageView }`
- **422** `{ "error": string, "flags": string[] }` — safety block (nothing persisted)
- **429** `{ "error": string }` — rate limited
- **403** not a participant / blocked · `404` unknown thread

### `POST /api/chat/threads/[id]/read`
Mark the thread read for the current user.
- **200** `{ "unreadCount": number }` — unread for this user afterwards (usually 0)

### `POST /api/chat/threads/[id]/block`
Block the other participant (also archives the thread for the blocker).
- **200** `{ "ok": true }`

### `GET /api/chat/unread`
Cheap badge endpoint for the header.
- **200** `{ "count": number }`

### Extend reporting
`lib/reports.ts` → `ReportTargetType` gains `"message" | "user"` so the existing
`ReportButton` can be reused in the thread view.

---

## 8. Realtime & delivery

- **In-thread:** poll `GET …/messages?after=<lastId>` every **~4 s** while the document is
  visible (`document.visibilityState === "visible"`); stop on unmount and when hidden.
- **Inbox & badge:** poll `GET /api/chat/unread` every **~15 s**.
- **Optimistic send:** append the message locally immediately; reconcile from the `201`
  response; on `422`/`429` remove it and show the reason inline.
- **No WebSockets / SSE** in v1. The JSON store has no change notifications, so an SSE
  endpoint would only poll the file server-side and add complexity without latency gains.

---

## 9. Safety & trust (safety before speed)

New module `lib/chat-safety.ts` exporting `screenMessage(body): ChatSafety`. It runs
**synchronously before persistence**; a blocked message is never written to
`data/chat.json`.

### 9.1 Fast hard-block layer (always on, no network)

Patterns that produce `verdict: "block"` with a flag:

| Flag | Catches |
|------|---------|
| `pii:phone` | phone numbers |
| `pii:email` | email addresses |
| `pii:address` | street-address / postal-code patterns |
| `pii:ssn` | SSN / national-id formats |
| `pii:bank` | IBAN / account / routing / card-number patterns |
| `scam:money` | "wire transfer", "send money", "gift card", "bitcoin/crypto", "Venmo/Zelle" |
| `scam:credential` | "password", "verification code", "one-time code", "log in here" |
| `scam:urgency` | classic pressure phrasing ("act now", "urgent", "don't tell anyone") |
| `link` | raw URLs (no link previews/attachments in v1) |
| `abuse` | slurs / threats (shared word list) |

### 9.2 Semantic layer

Reuse `checkSafety()` from `lib/agents.ts` (or add a dedicated `prompts/chat_safety_agent.md`
tuned for message scams, contact-grooming, and elder exploitation) for cases the regexes
miss. Runs after the fast layer, so obvious scams never wait on the network.

- **Failure policy (fail-safe):** if the semantic check errors or times out, the message is
  **not delivered** and the sender sees "We couldn't verify this message — please try
  again." This is the deliberate "safety before speed" choice; it is a single tunable in
  `lib/chat-safety.ts` if it proves too strict in the demo.

### 9.3 Protection on both sides

Because River↔Drop is allowed, the gate must protect **both** directions:

- **Elderly users** from financial scams, impersonation, and pressure tactics (§9.1/9.2).
- **Young users** from contact exchange, meeting arrangements, and grooming patterns —
  covered by the `pii:*` and `scam:*` blocks plus explicit "meet in person / send a photo /
  keep this secret" heuristics.
- **Drop ↔ Drop is allowed by product decision**, so both directions rely on the `pii:*`,
  `scam:*`, and grooming hard-blocks plus block/report and rate limits.

### 9.4 Supporting controls

- **Block / report** on every thread (reuses `ReportButton`; new report target types).
- **Rate limit:** ~20 messages/min and ~200/day per user, in-memory per process
  (`Map<userId, timestamps>`), returning `429`.
- **Composer reminder:** a persistent, low-emphasis line — *"Never share bank details,
  passwords, or your home address."*
- **Crisis routing:** self-harm/crisis keywords show inline support resources (988 and
  equivalents) rather than a bare block; log for human follow-up.
- **Soft delete:** `deletedAt` is reserved so messages can be removed without breaking
  thread order (no deletion UI in v1).

---

## 10. UI, routes & components

| Route | Purpose |
|-------|---------|
| `/messages` | Inbox — threads with other person, last-message preview, time, unread badge; empty state → "Find someone to connect with". |
| `/messages/[threadId]` | Thread view + composer; block/report; safety reminder. |
| `/connect` | Directory of Rivers (name, age band, bio, interests, shared-interest count) with a "Message" action. |

**Entry points**

- Public profile `/profile/[id]` → **"Message"** button when `canMessage` passes and the
  viewer is signed in (visitors see nothing).
- `/connect` directory → per-River "Message".
- Header → new **"Messages"** nav item with unread badge, signed-in only
  (`components/site-header.tsx`).

**New components** (`components/chat/…`)

- `thread-list.tsx` — inbox rows.
- `message-thread.tsx` — history, `role="log"` + `aria-live="polite"`, auto-scroll.
- `message-composer.tsx` — textarea, Enter to send / Shift+Enter newline, block/error states.
- `message-button.tsx` — the get-or-create entry point.
- `unread-badge.tsx` — polled count for the header.
- `connect-directory.tsx` — directory list + interest filter + shared-interest chips.

**Accessibility** (project baseline already applies: 18 px root, text-size toggle, serif
headings, AA contrast, `ripple`/`glass`/`shadow-water` styling)

- Large tap targets and ≥ 1.5 line-height in bubbles.
- New messages announced via `aria-live`; focus stays in the composer after send.
- All controls keyboard reachable; visible focus rings; labeled inputs.
- "Seen" is text, not color-only.

---

## 11. Build order

| Phase | Outcome | Touches |
|-------|---------|---------|
| **P1** | `data/chat.json` shape + types + `lib/chat.ts` (with `canMessage`, `pairKey`, lock) + seed one River↔River thread | Data + lib |
| **P2** | `lib/chat-safety.ts` (regex hard-block + semantic pass + fail-safe) | lib |
| **P3** | API routes: threads (GET/POST), messages (GET/POST), read, block, unread; extend report targets | `app/api/chat/*`, `lib/reports.ts` |
| **P4** | `/messages` inbox + `/messages/[threadId]` thread + composer + polling + optimistic send | app + components |
| **P5** | `/connect` directory + profile "Message" button + header nav item with unread badge | app + components + header |
| **P6** | Block/report wiring, rate limit, crisis resources, a11y pass | components + lib |
| **P7** | Demo seed (a realistic thread), end-to-end test, `npm run build`, visual pass | data + QA |

---

## 12. Acceptance criteria

- **AC-CHAT-1** — Any signed-in user can start a thread with any other user (Drop↔Drop
  included); self-messaging returns `400` and the button is never shown.
- **AC-CHAT-2** — Opening a thread twice never creates a duplicate (guaranteed by `pairKey`).
- **AC-CHAT-3** — A scam message ("wire transfer…") and a PII message (phone/email/SSN) are
  **rejected with `422` and never written** to `data/chat.json`.
- **AC-CHAT-4** — A normal message is stored, returned, and appears for the other user within
  one poll interval (~4 s).
- **AC-CHAT-5** — Unread counts are correct in the inbox and header badge, and clear on read.
- **AC-CHAT-6** — A blocked user's messages can no longer be sent to the blocker.
- **AC-CHAT-7** — Visitors cannot reach `/messages` or any `/api/chat/*` route (`401`/redirect).
- **AC-CHAT-8** — Exact age is never returned by any chat endpoint; only the age band.
- **AC-CHAT-9** — The thread view works with keyboard only and announces new messages.
- **AC-CHAT-10** — Rate limiting returns `429` after the per-minute threshold.
- **AC-CHAT-11** — `npm run build` passes and no existing feature (AI interview, feed,
  profiles) is affected.

---

## 13. Out of scope (deferred)

- Group / community rooms ("Currents").
- Voice messages and read-aloud TTS (data model reserves `kind: "voice"`).
- Attachments, image uploads, link previews.
- Typing indicators, presence/online status.
- Push, email, or SMS notifications.
- WebSockets / SSE realtime.
- Message editing; full delete UI.
- Migration to a real database (Supabase `threads`/`messages` per the archived vision).
- Guardian-consent workflow for 13–17 (see §14).

---

## 14. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Minors (13–17) messaging adults 1:1 | Permission matrix allows it by decision; mitigate with PII/grooming hard-blocks, block/report, and rate limits. **Guardian-consent is an open product/legal item before any non-demo launch.** |
| Minors (13–17) messaging each other 1:1 | Allowed by product decision (Drop↔Drop); mitigate with the same pre-send screening, block/report, and rate limits. **Guardian-consent is an open product/legal item before any non-demo launch.** |
| Scams targeting elderly | Synchronous pre-send screening (regex + semantic), fail-safe on error, composer warning, block/report. |
| False positives blocking legitimate messages | Flags are surfaced to the sender; pattern list is centralized in `lib/chat-safety.ts` and tunable; semantic layer can be softened without code changes elsewhere. |
| Whole-file rewrite per message + growth | Demo-scale accepted; `pairKey` and per-thread arrays keep reads cheap; documented migration path to a DB. |
| Polling load | ~4 s only while the thread is visible; badge poll is a cheap count; stops when hidden. |
| LLM safety latency / outage | Regex fast-path handles obvious cases; semantic layer runs after; outage fails safe (block + retry), tunable if demo-hostile. |
| Name collision with AI `Conversation` | Strict `Chat*` / `thread` / `message` naming; UI label "Messages". |

---

## 15. Open questions (do not block P1–P4)

1. **Guardian consent for 13–17** in River↔Drop threads — product/legal decision required
   before launch beyond the demo.
2. **Semantic-layer outage policy** — keep fail-safe block, or allow-with-flag? (Default:
   fail-safe block, per "safety before speed".)
3. **Should `/connect` list Drops too**, or only Rivers? (Default: Rivers only, since they
   are the hub; Drops are reachable via profiles.)
4. **Retention / deletion** — how long are messages kept, and does "delete" remove content
   for both sides? (Default: keep until a deletion UI is designed.)
5. **Read receipts** — keep simple "Seen", or hide entirely for privacy? (Default: "Seen".)
