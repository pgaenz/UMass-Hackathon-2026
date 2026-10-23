// Layer 1 of private-message screening: fast, synchronous, no network.
//
// Extracted from `chat-safety.ts` so the evaluation harness can test the exact
// production patterns without needing an API key or any LLM call.
// Layer 2 (semantic screening) still lives in `chat-safety.ts`.

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
