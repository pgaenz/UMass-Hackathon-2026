import { config } from "./config";
import { chat } from "./openai";
import { loadPrompt } from "./prompts";
import type {
  ReviewIssue,
  ReviewIssueType,
  ReviewResult,
  SafetyCategory,
  SafetyIssue,
  SafetyResult,
  SafetySeverity,
  StoryMetadata,
} from "./types";
import { deriveReviewVerdict, deriveSafetyVerdict } from "./verdicts";

const MAX_TRANSCRIPT_CHARS = 6_000;
const WRITE_TIMEOUT_MS = 60_000;
const REVIEW_TIMEOUT_MS = 45_000;
const SAFETY_TIMEOUT_MS = 30_000;

export interface ArticleDraft {
  article: string;
  metadata: StoryMetadata;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  // Be forgiving if the model wraps the object in stray prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Agent returned no JSON object");
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toDraft(parsed: Record<string, unknown>): ArticleDraft {
  const article = asString(parsed.article);
  if (!article) {
    throw new Error("Writing agent returned an empty article");
  }
  return {
    article,
    metadata: {
      topic: asString(parsed.topic),
      summary: asString(parsed.summary),
    },
  };
}

function transcriptBlock(transcript: string): string {
  return `ORIGINAL TRANSCRIPT (the senior's own words - the ONLY source of facts):\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`;
}

function contextBlock(conversationContext?: string | null): string {
  const trimmed = conversationContext?.trim();
  if (!trimmed) {
    return "";
  }
  return `INTERVIEW CONTEXT (the interviewer's questions and acknowledgments; use this ONLY to understand what each answer was responding to and to connect the article's paragraphs - never treat anything here as a fact about the senior):\n${trimmed.slice(0, MAX_TRANSCRIPT_CHARS)}`;
}

/**
 * Initial generation: turn the senior's answer into a faithful, youthful article.
 * The writing_agent owns topic/summary too, so intake no longer needs its own call.
 */
export async function writeArticle(
  transcript: string,
  conversationContext?: string | null,
): Promise<ArticleDraft> {
  const system = await loadPrompt("writing_agent");
  const user = [transcriptBlock(transcript), contextBlock(conversationContext)]
    .filter(Boolean)
    .join("\n\n");
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: config.writingModel, temperature: 0, timeoutMs: WRITE_TIMEOUT_MS },
  );
  return toDraft(parseJsonObject(raw));
}

/**
 * Re-creation: rewrite the current article using the original answer, the review
 * agent's feedback and any feedback the senior gave. Never adds facts.
 */
export async function reviseArticle(input: {
  transcript: string;
  conversationContext?: string | null;
  article: string;
  review: ReviewResult | null;
  safety?: SafetyResult | null;
  feedback: string[];
}): Promise<ArticleDraft> {
  const system = await loadPrompt("revision_agent");

  const reviewText = input.review
    ? JSON.stringify({
        score: input.review.score,
        verdict: input.review.verdict,
        summary: input.review.summary,
        issues: input.review.issues,
      })
    : "(none)";

  const safetyText =
    input.safety && input.safety.issues.length > 0
      ? JSON.stringify({
          verdict: input.safety.verdict,
          summary: input.safety.summary,
          issues: input.safety.issues,
        })
      : "(none)";

  const seniorFeedback = input.feedback
    .map((entry) => `- ${entry}`)
    .join("\n")
    .trim() || "- (none)";

  const user = [
    transcriptBlock(input.transcript),
    contextBlock(input.conversationContext),
    `CURRENT ARTICLE:\n${input.article}`,
    `REVIEW AGENT FEEDBACK:\n${reviewText}`,
    `SAFETY AGENT FEEDBACK:\n${safetyText}`,
    `SENIOR FEEDBACK:\n${seniorFeedback}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: config.writingModel, temperature: 0, timeoutMs: WRITE_TIMEOUT_MS },
  );
  return toDraft(parseJsonObject(raw));
}

const ISSUE_TYPES: ReviewIssueType[] = ["invented_fact", "distortion", "tone", "clarity"];

function toIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const issues: ReviewIssue[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const type = asString(record.type) as ReviewIssueType;
    const detail = asString(record.detail);
    if (!ISSUE_TYPES.includes(type) || !detail) {
      continue;
    }
    const excerpt = asString(record.excerpt);
    issues.push(excerpt ? { type, detail, excerpt } : { type, detail });
  }
  return issues;
}

/**
 * Independent review. The verdict is derived server-side (not trusted from the
 * model): pass only when the score is high AND nothing was invented or distorted.
 */
export async function reviewArticle(input: {
  transcript: string;
  article: string;
}): Promise<ReviewResult> {
  const system = await loadPrompt("review_agent");
  const raw = await chat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `${transcriptBlock(input.transcript)}\n\nGENERATED ARTICLE:\n${input.article}`,
      },
    ],
    { model: config.reviewModel, temperature: 0, timeoutMs: REVIEW_TIMEOUT_MS },
  );

  const parsed = parseJsonObject(raw);
  const numeric = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
  const score = Number.isFinite(numeric) ? Math.min(5, Math.max(1, Math.round(numeric))) : 1;

  const issues = toIssues(parsed.issues);
  const verdict = deriveReviewVerdict(score, issues);

  const summary =
    asString(parsed.summary) ||
    (verdict === "pass"
      ? "The story is faithful to your answer."
      : "Some parts need another look.");

  return { score, verdict, summary, issues, createdAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Safety agent (family-friendly / non-graphic / non-instructional gate)
// ---------------------------------------------------------------------------

const SAFETY_CATEGORIES: SafetyCategory[] = [
  "profanity",
  "sexual",
  "violence",
  "hate",
  "harassment",
  "self_harm",
  "illegal_instructions",
  "graphic",
  "pii",
  "other",
];

const SAFETY_SEVERITIES: SafetySeverity[] = ["soft", "hard"];

function toSafetyIssues(value: unknown): SafetyIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const issues: SafetyIssue[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const category = asString(record.category) as SafetyCategory;
    const severity = asString(record.severity) as SafetySeverity;
    const detail = asString(record.detail);
    if (
      !SAFETY_CATEGORIES.includes(category) ||
      !SAFETY_SEVERITIES.includes(severity) ||
      !detail
    ) {
      continue;
    }
    const excerpt = asString(record.excerpt);
    issues.push(excerpt ? { category, severity, detail, excerpt } : { category, severity, detail });
  }
  return issues;
}

/**
 * Independent safety review. Runs BEFORE the grounding review: if the content is
 * not safe, there is no point checking whether it is faithful. The verdict is
 * derived server-side (not trusted from the model) so a hard issue always blocks.
 */
export async function checkSafety(input: {
  content: string;
  kind: "article" | "question" | "bio" | "name";
  context?: string | null;
}): Promise<SafetyResult> {
  const system = await loadPrompt("safety_agent");

  const parts = [
    `CONTENT KIND: ${input.kind}`,
    `CONTENT TO JUDGE:\n${input.content}`,
  ];
  const context = input.context?.trim();
  if (context) {
    parts.push(
      `CONTEXT (original transcript; do NOT judge this, use it only to tell a faithful retelling from an instruction):\n${context.slice(0, MAX_TRANSCRIPT_CHARS)}`,
    );
  }

  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: parts.join("\n\n") },
    ],
    { temperature: 0, timeoutMs: SAFETY_TIMEOUT_MS },
  );

  const parsed = parseJsonObject(raw);
  const issues = toSafetyIssues(parsed.issues);
  const verdict = deriveSafetyVerdict(issues);

  const summary =
    asString(parsed.summary) ||
    (verdict === "allow"
      ? "This looks safe to publish."
      : "Some parts are not ready to publish yet.");

  return { verdict, issues, summary, createdAt: new Date().toISOString() };
}

/**
 * Cleans up a short piece of user text (a question or a bio) using the safety
 * agent's feedback. Used for soft issues so the author's text can still be
 * published. Returns an empty string when nothing safe remains.
 */
export async function rewriteForSafety(input: {
  content: string;
  kind: "question" | "bio";
  safety: SafetyResult;
}): Promise<string> {
  const system = await loadPrompt("safety_rewrite_agent");

  const issues = input.safety.issues
    .map(
      (issue) =>
        `- [${issue.category}/${issue.severity}] ${issue.detail}${
          issue.excerpt ? ` (excerpt: "${issue.excerpt}")` : ""
        }`,
    )
    .join("\n");

  const raw = await chat(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `KIND: ${input.kind}\n\nTEXT TO CLEAN:\n${input.content}\n\nSAFETY ISSUES TO FIX:\n${issues || "- (none)"}`,
      },
    ],
    { temperature: 0, timeoutMs: SAFETY_TIMEOUT_MS },
  );

  return raw
    .trim()
    .replace(/^```(?:[a-z]+)?/i, "")
    .replace(/```$/, "")
    .trim();
}
