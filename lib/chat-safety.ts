import { chat } from "./openai";
import { loadPrompt } from "./prompts";
import type { ChatSafety } from "./types";

/**
 * Pre-send screening for private messages (plan/CHAT.md §9).
 *
 * Layer 1 (always on, synchronous, no network) hard-blocks obvious scams, PII
 * leaks, links, abuse and crisis language. Layer 2 asks the model about the
 * cases the patterns miss.
 *
 * "Safety before speed": if the semantic layer errors or times out we do NOT
 * deliver the message. Flip `SEMANTIC_ENABLED` to false to trade that safety for
 * availability during a demo.
 */
const SEMANTIC_ENABLED = true;
const SEMANTIC_TIMEOUT_MS = 20_000;
const MAX_BODY_CHARS = 2_000;

interface Pattern {
  flag: string;
  re: RegExp;
}

// Order is not significant; all matches are collected and de-duplicated.
const PATTERNS: Pattern[] = [
  // --- crisis (routed to human-support resources, still not delivered) ---
  {
    flag: "crisis",
    re: /\b(kill myself|suicid(?:e|al)|end my life|want to die|self[- ]?harm|hurt myself)\b/i,
  },
  // --- PII ---
  { flag: "pii:ssn", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  {
    flag: "pii:phone",
    re: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
  },
  { flag: "pii:phone", re: /\+\d[\d\s().-]{7,}\d/ },
  { flag: "pii:email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  {
    flag: "pii:address",
    re: /\b\d{1,6}\s+[A-Za-z0-9.'-]+\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way|place|pl)\b/i,
  },
  { flag: "pii:bank", re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/i },
  { flag: "pii:bank", re: /\b(?:\d[ -]?){13,16}\b/ },
  { flag: "pii:bank", re: /\b(?:routing|account)\s+(?:number|no\.?|#)\b/i },
  // --- scams ---
  {
    flag: "scam:money",
    re: /\b(wire transfer|send money|gift card|itunes card|bitcoin|crypto(?:currency)?|venmo|zelle|cash app|western union|money order|investment opportunity|you(?:'ve| have) won|claim your (?:prize|winnings)|processing fee|inheritance)\b/i,
  },
  {
    flag: "scam:credential",
    re: /\b(password|passcode|verification code|one[- ]time code|otp|pin number|social security number|log ?in here|confirm your identity)\b/i,
  },
  {
    flag: "scam:urgency",
    re: /\b(act now|urgent|immediately|right away|before it'?s too late|don'?t tell anyone|keep (?:this|it) (?:a )?secret|limited time)\b/i,
  },
  { flag: "grooming", re: /\b(send (?:me )?(?:a |your )?(?:photo|picture)|meet (?:me )?(?:in person|alone)|don'?t tell your (?:parents|mom|dad|guardian)|our secret)\b/i },
  // --- links (no previews/attachments in v1) ---
  { flag: "link", re: /https?:\/\/\S+/i },
  { flag: "link", re: /\bwww\.[a-z0-9-]+\.[a-z]{2,}\b/i },
  // --- abuse ---
  {
    flag: "abuse",
    re: /\b(kill you|hurt you|i'?ll find you|you'?ll regret|worthless|hate you|shut up|fuck|shit|bitch|bastard|asshole|slut|whore|retard|faggot|nigger)\b/i,
  },
];

/** Runs the always-on regex layer and returns every flag that matched. */
export function scanMessage(body: string): string[] {
  const flags = new Set<string>();
  for (const pattern of PATTERNS) {
    if (pattern.re.test(body)) {
      flags.add(pattern.flag);
    }
  }
  return [...flags];
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Chat safety agent returned no JSON object");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

async function semanticScreen(body: string): Promise<ChatSafety> {
  const system = await loadPrompt("chat_safety_agent");
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: body.slice(0, MAX_BODY_CHARS) },
    ],
    { temperature: 0, timeoutMs: SEMANTIC_TIMEOUT_MS },
  );

  const parsed = parseJsonObject(raw);
  const verdict = parsed.verdict === "block" ? "block" : "allow";
  const flags = Array.isArray(parsed.flags)
    ? parsed.flags.filter((flag): flag is string => typeof flag === "string").slice(0, 10)
    : [];

  if (verdict === "block") {
    return { verdict, flags: flags.length > 0 ? flags : ["unsafe"] };
  }
  return { verdict: "allow", flags: [] };
}

/**
 * Screens a message before it is persisted. A `block` verdict means the caller
 * must reject the message and store nothing.
 */
export async function screenMessage(body: string): Promise<ChatSafety> {
  const fastFlags = scanMessage(body);
  if (fastFlags.length > 0) {
    return { verdict: "block", flags: fastFlags };
  }

  if (!SEMANTIC_ENABLED) {
    return { verdict: "allow", flags: [] };
  }

  try {
    return await semanticScreen(body);
  } catch {
    // Fail-safe: unverifiable content is not delivered.
    return { verdict: "block", flags: ["unverified"] };
  }
}

// ---------------------------------------------------------------------------
// Per-process rate limit (plan/CHAT.md §9.4). Resets when the server restarts.
// ---------------------------------------------------------------------------

const MAX_PER_MINUTE = 20;
const MAX_PER_DAY = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const windows = new Map<string, number[]>();

/** Records a send and returns false when the user is over a limit. */
export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (windows.get(userId) ?? []).filter((stamp) => stamp > now - DAY_MS);
  const lastMinute = recent.filter((stamp) => stamp > now - 60_000);

  if (lastMinute.length >= MAX_PER_MINUTE || recent.length >= MAX_PER_DAY) {
    windows.set(userId, recent);
    return false;
  }

  recent.push(now);
  windows.set(userId, recent);
  return true;
}

/** Human-readable reason for a 429 response, or null when allowed. */
export function rateLimitReason(userId: string): string | null {
  if (checkRateLimit(userId)) return null;
  return "You are sending messages too quickly. Please wait a moment and try again.";
}
