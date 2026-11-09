/**
 * HistorAI evaluation harness — offline + live agent suites.
 *
 * Usage (from the repo root):
 *   npm run eval        # deterministic logic checks, no network, no API key
 *   npm run eval:live   # the above, plus model-backed agent quality checks
 *
 * Live mode reads OPENROUTER_API_KEY from `.env` / `.env.local` (the same files
 * the app uses) and makes a small number of real model calls. Results are
 * written to `eval/results/offline.{json,md}` and `eval/results/live.{json,md}`.
 *
 * The black-box HTTP suite lives in `eval/e2e.mjs` (`npm run eval:e2e`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { scanMessage } from "../lib/chat-patterns";
import { canMessage } from "../lib/chat";
import { deriveDropQuestionState } from "../lib/drop-question-state";
import { assertProductionSecrets } from "../lib/env";
import { publicDisplayName } from "../lib/format";
import { validateQuestionText, validateQuestionTopics } from "../lib/question-rules";
import { findSimilarQuestions } from "../lib/similar-questions";
import { isInsideUploads } from "../lib/delete-story";
import { getArticleTitle } from "../lib/format";
import { deriveRiverState, hashTranscript } from "../lib/river-story-state";
import type { Question, ReviewIssue, ReviewResult, SafetyIssue, SafetyResult, Story, User } from "../lib/types";
import { MAX_AGE, MIN_AGE, ageBand, isValidAge, toPublicUser } from "../lib/users";
import { deriveReviewVerdict, deriveSafetyVerdict } from "../lib/verdicts";

// ---------------------------------------------------------------------------
// Result plumbing
// ---------------------------------------------------------------------------

type Status = "pass" | "fail" | "skip";

interface CaseResult {
  id: string;
  suite: string;
  name: string;
  expected: string;
  actual: string;
  status: Status;
  latencyMs?: number;
  model?: string;
  detail?: string;
}

const results: CaseResult[] = [];
const startedAt = new Date().toISOString();

function expectCase(input: {
  id: string;
  suite: string;
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
  latencyMs?: number;
  model?: string;
  detail?: string;
}): void {
  const status: Status = input.ok ? "pass" : "fail";
  results.push({
    id: input.id,
    suite: input.suite,
    name: input.name,
    expected: input.expected,
    actual: input.actual,
    status,
    latencyMs: input.latencyMs,
    model: input.model,
    detail: input.detail,
  });
  const icon = status === "pass" ? "PASS" : "FAIL";
  console.log(`[${icon}] ${input.id} — ${input.name}`);
  console.log(`        expected: ${input.expected}`);
  console.log(`        actual:   ${input.actual}`);
  if (input.detail) console.log(`        detail:   ${input.detail}`);
}

function skipCase(input: {
  id: string;
  suite: string;
  name: string;
  expected: string;
  detail: string;
}): void {
  results.push({ ...input, actual: "skipped", status: "skip" });
  console.log(`[SKIP] ${input.id} — ${input.name}: ${input.detail}`);
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

// ---------------------------------------------------------------------------
// Offline suite 1 — server-derived verdicts (lib/verdicts.ts)
// ---------------------------------------------------------------------------

function runVerdictCases(): void {
  const issue = (type: ReviewIssue["type"]): ReviewIssue => ({ type, detail: "eval fixture" });
  const reviewCases: Array<{ id: string; score: number; issues: ReviewIssue[]; expected: "pass" | "revise" }> = [
    { id: "REV-01", score: 5, issues: [], expected: "pass" },
    { id: "REV-02", score: 4, issues: [issue("tone")], expected: "pass" },
    { id: "REV-03", score: 4, issues: [issue("clarity")], expected: "pass" },
    { id: "REV-04", score: 4, issues: [issue("invented_fact")], expected: "revise" },
    { id: "REV-05", score: 5, issues: [issue("distortion")], expected: "revise" },
    { id: "REV-06", score: 3, issues: [], expected: "revise" },
    { id: "REV-07", score: 2, issues: [], expected: "revise" },
    { id: "REV-08", score: 1, issues: [], expected: "revise" },
  ];

  for (const testCase of reviewCases) {
    const actual = deriveReviewVerdict(testCase.score, testCase.issues);
    expectCase({
      id: testCase.id,
      suite: "verdicts",
      name: `review: score ${testCase.score}, ${
        testCase.issues.length === 0 ? "no issues" : testCase.issues.map((i) => i.type).join("+")
      }`,
      expected: testCase.expected,
      actual,
      ok: actual === testCase.expected,
    });
  }

  const soft = (category: SafetyIssue["category"]): SafetyIssue => ({
    category,
    severity: "soft",
    detail: "eval fixture",
  });
  const hard = (category: SafetyIssue["category"]): SafetyIssue => ({
    category,
    severity: "hard",
    detail: "eval fixture",
  });
  const safetyCases: Array<{ id: string; issues: SafetyIssue[]; expected: "allow" | "revise" | "block" }> = [
    { id: "SAF-01", issues: [], expected: "allow" },
    { id: "SAF-02", issues: [soft("profanity")], expected: "revise" },
    { id: "SAF-03", issues: [soft("profanity"), soft("other")], expected: "revise" },
    { id: "SAF-04", issues: [hard("illegal_instructions")], expected: "block" },
    { id: "SAF-05", issues: [hard("pii")], expected: "block" },
    { id: "SAF-06", issues: [soft("profanity"), hard("violence")], expected: "block" },
    { id: "SAF-07", issues: [hard("self_harm")], expected: "block" },
  ];

  for (const testCase of safetyCases) {
    const actual = deriveSafetyVerdict(testCase.issues);
    expectCase({
      id: testCase.id,
      suite: "verdicts",
      name: `safety: ${testCase.issues.length === 0 ? "no issues" : testCase.issues.map((i) => `${i.severity}/${i.category}`).join("+")}`,
      expected: testCase.expected,
      actual,
      ok: actual === testCase.expected,
    });
  }
}

// ---------------------------------------------------------------------------
// Offline suite 2 — age validation & public age bands (lib/users.ts)
// ---------------------------------------------------------------------------

function runAgeCases(): void {
  const ageCases: Array<{ id: string; age: number; valid: boolean; band: string | null }> = [
    { id: "AGE-01", age: 12, valid: false, band: null },
    { id: "AGE-02", age: 0, valid: false, band: null },
    { id: "AGE-03", age: -5, valid: false, band: null },
    { id: "AGE-04", age: 13, valid: true, band: "13-17" },
    { id: "AGE-05", age: 17, valid: true, band: "13-17" },
    { id: "AGE-06", age: 18, valid: true, band: "18-29" },
    { id: "AGE-07", age: 29, valid: true, band: "18-29" },
    { id: "AGE-08", age: 30, valid: true, band: "30-44" },
    { id: "AGE-09", age: 44, valid: true, band: "30-44" },
    { id: "AGE-10", age: 45, valid: true, band: "45-59" },
    { id: "AGE-11", age: 59, valid: true, band: "45-59" },
    { id: "AGE-12", age: 60, valid: true, band: "60-74" },
    { id: "AGE-13", age: 74, valid: true, band: "60-74" },
    { id: "AGE-14", age: 75, valid: true, band: "75+" },
    { id: "AGE-15", age: 120, valid: true, band: "75+" },
    { id: "AGE-16", age: 121, valid: false, band: null },
    { id: "AGE-17", age: 13.5, valid: false, band: null },
    { id: "AGE-18", age: Number.NaN, valid: false, band: null },
  ];

  for (const testCase of ageCases) {
    const actualValid = isValidAge(testCase.age);
    const actualBand = actualValid ? ageBand(testCase.age) : null;
    const ok = actualValid === testCase.valid && actualBand === testCase.band;
    expectCase({
      id: testCase.id,
      suite: "age",
      name: `age ${testCase.age} (limits ${MIN_AGE}–${MAX_AGE})`,
      expected: testCase.valid ? `accepted, band ${testCase.band}` : "rejected",
      actual: actualValid ? `accepted, band ${actualBand}` : "rejected",
      ok,
    });
  }

  const sampleUser: User = {
    id: "u-eval",
    role: "drop",
    name: "Eval User",
    age: 42,
    bio: "",
    interests: [],
    createdAt: new Date(0).toISOString(),
  };
  const publicUser = toPublicUser(sampleUser);
  const leaksAge = "age" in publicUser;
  expectCase({
    id: "AGE-19",
    suite: "age",
    name: "public profile never exposes the exact age",
    expected: "ageBand 30-44, no `age` field",
    actual: leaksAge ? `leaked age=${String((publicUser as { age?: unknown }).age)}` : `ageBand ${publicUser.ageBand}`,
    ok: !leaksAge && publicUser.ageBand === "30-44",
  });
}

// ---------------------------------------------------------------------------
// Offline suite 3 — production secret policy (lib/env.ts, D11)
// ---------------------------------------------------------------------------

function runEnvPolicyCases(): void {
  type MutableEnv = Record<string, string | undefined>;
  const env = process.env as MutableEnv;
  const saved = {
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
  };

  function accepts(nodeEnv: string, values: { databaseUrl?: string; sessionSecret?: string }): boolean {
    env.NODE_ENV = nodeEnv;
    if (values.databaseUrl === undefined) delete env.DATABASE_URL;
    else env.DATABASE_URL = values.databaseUrl;
    if (values.sessionSecret === undefined) delete env.SESSION_SECRET;
    else env.SESSION_SECRET = values.sessionSecret;
    try {
      assertProductionSecrets();
      return true;
    } catch {
      return false;
    }
  }

  function expectAcceptance(
    id: string,
    name: string,
    nodeEnv: string,
    values: { databaseUrl?: string; sessionSecret?: string },
    expected: boolean,
  ): void {
    const actual = accepts(nodeEnv, values);
    expectCase({
      id,
      suite: "env",
      name,
      expected: expected ? "no throw" : "throws",
      actual: actual ? "no throw" : "threw",
      ok: actual === expected,
    });
  }

  try {
    expectAcceptance("ENV-01", "development tolerates missing secrets", "development", {}, true);
    expectAcceptance(
      "ENV-02",
      "production fails closed without DATABASE_URL",
      "production",
      { sessionSecret: "secret" },
      false,
    );
    expectAcceptance(
      "ENV-03",
      "production fails closed without SESSION_SECRET",
      "production",
      { databaseUrl: "postgres://user@host/db" },
      false,
    );
    expectAcceptance(
      "ENV-04",
      "production boots when both secrets are present",
      "production",
      { databaseUrl: "postgres://user@host/db", sessionSecret: "secret" },
      true,
    );
  } finally {
    if (saved.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = saved.nodeEnv;
    if (saved.databaseUrl === undefined) delete env.DATABASE_URL;
    else env.DATABASE_URL = saved.databaseUrl;
    if (saved.sessionSecret === undefined) delete env.SESSION_SECRET;
    else env.SESSION_SECRET = saved.sessionSecret;
  }
}

// ---------------------------------------------------------------------------
// Offline suite 4 — chat screening layer 1 (lib/chat-patterns.ts)
// ---------------------------------------------------------------------------

interface ChatCase {
  id: string;
  text: string;
  expect: string[];
  allowed?: string[];
}

function runChatPatternCases(): void {
  const chatCases: ChatCase[] = [
    // Safe messages must produce no flags at all.
    { id: "CHAT-S01", text: "What was your first job, and how did you get it?", expect: [] },
    { id: "CHAT-S02", text: "I loved growing up in Boston. The summers felt endless.", expect: [] },
    { id: "CHAT-S03", text: "Your story reminded me of my grandmother's kitchen.", expect: [] },
    { id: "CHAT-S04", text: "Would you like to talk about music sometime?", expect: [] },
    { id: "CHAT-S05", text: "Thank you for sharing that. I will try to be braver.", expect: [] },
    { id: "CHAT-S06", text: "I planted tomatoes this spring, but the squirrels won.", expect: [] },
    // Scams.
    { id: "CHAT-R01", text: "Please send money by gift card today.", expect: ["scam:money"] },
    { id: "CHAT-R02", text: "You can wire transfer the funds to me.", expect: ["scam:money"] },
    { id: "CHAT-R03", text: "You've won a prize! Claim your winnings now.", expect: ["scam:money"] },
    { id: "CHAT-R04", text: "Buy bitcoin and I will double it.", expect: ["scam:money"] },
    { id: "CHAT-R05", text: "There is a small processing fee.", expect: ["scam:money"] },
    { id: "CHAT-R06", text: "What is your password?", expect: ["scam:credential"] },
    { id: "CHAT-R07", text: "Please confirm your identity for me.", expect: ["scam:credential"] },
    { id: "CHAT-R08", text: "Send me the one-time code.", expect: ["scam:credential"] },
    // Personal data.
    { id: "CHAT-R09", text: "Call me at 617-555-1234.", expect: ["pii:phone"] },
    { id: "CHAT-R10", text: "Reach me at arthur@example.com.", expect: ["pii:email"] },
    { id: "CHAT-R11", text: "My SSN is 123-45-6789.", expect: ["pii:ssn"] },
    { id: "CHAT-R12", text: "I live at 42 Main Street.", expect: ["pii:address"] },
    { id: "CHAT-R13", text: "My routing number is on the check.", expect: ["pii:bank"] },
    // Abuse.
    { id: "CHAT-R14", text: "You are worthless and I hate you.", expect: ["abuse"] },
    { id: "CHAT-R15", text: "Shut up, nobody asked you.", expect: ["abuse"] },
    // Crisis.
    { id: "CHAT-R16", text: "I want to die.", expect: ["crisis"] },
    { id: "CHAT-R17", text: "I have been thinking about self-harm.", expect: ["crisis"] },
    // Grooming.
    { id: "CHAT-R18", text: "Don't tell your parents about us.", expect: ["grooming"], allowed: ["grooming", "scam:urgency"] },
    { id: "CHAT-R19", text: "Send me a photo of yourself.", expect: ["grooming"] },
    // Links.
    { id: "CHAT-R20", text: "Check out https://example.com for details.", expect: ["link"] },
    { id: "CHAT-R21", text: "Visit www.example.com.", expect: ["link"] },
  ];

  for (const testCase of chatCases) {
    const actual = scanMessage(testCase.text).sort();
    const expected = [...testCase.expect].sort();
    const allowed = testCase.allowed ? [...testCase.allowed].sort() : expected;
    const missing = expected.filter((flag) => !actual.includes(flag));
    const unexpected = actual.filter((flag) => !allowed.includes(flag));
    const ok = missing.length === 0 && unexpected.length === 0;
    expectCase({
      id: testCase.id,
      suite: "chat-patterns",
      name: testCase.text,
      expected: expected.length === 0 ? "no flags" : expected.join(","),
      actual: actual.length === 0 ? "no flags" : actual.join(","),
      ok,
      detail:
        missing.length > 0 || unexpected.length > 0
          ? `missing: [${missing.join(",")}] unexpected: [${unexpected.join(",")}]`
          : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Offline suite 4 — River story state and helpers (lib/river-story-state.ts)
// ---------------------------------------------------------------------------

const ISO = "2024-01-01T00:00:00.000Z";

function baseStory(overrides: Partial<Story> = {}): Story {
  return {
    id: "s-test",
    prompt: "",
    questionId: null,
    authorId: "u-1",
    inputType: "text",
    rawAudioPath: null,
    transcript: "hello",
    conversationContext: null,
    metadata: { topic: "", summary: "" },
    article: "# Title\n\nBody",
    review: null,
    safety: null,
    feedback: [],
    groundingScore: 0,
    piiDetected: false,
    status: "draft",
    conversationId: null,
    createdAt: ISO,
    updatedAt: ISO,
    publishedAt: null,
    riverEdited: false,
    checkedAt: ISO,
    checkError: null,
    writtenFromHash: null,
    previousArticle: null,
    ...overrides,
  };
}

const PASS_REVIEW: ReviewResult = {
  score: 5,
  verdict: "pass",
  summary: "ok",
  issues: [],
  createdAt: ISO,
};
const ALLOW_SAFETY: SafetyResult = {
  verdict: "allow",
  issues: [],
  summary: "ok",
  createdAt: ISO,
};

function runRiverExperienceCases(): void {
  const cases: Array<{ id: string; name: string; story: Story; expected: string }> = [
    {
      id: "RIV-01",
      name: "published story",
      story: baseStory({ status: "published" }),
      expected: "published",
    },
    {
      id: "RIV-02",
      name: "saved answer without an article",
      story: baseStory({ article: "" }),
      expected: "answer_saved",
    },
    {
      id: "RIV-03",
      name: "hard safety block",
      story: baseStory({ safety: { ...ALLOW_SAFETY, verdict: "block" } }),
      expected: "blocked",
    },
    {
      id: "RIV-04",
      name: "checks pending",
      story: baseStory({ checkedAt: null }),
      expected: "needs_check",
    },
    {
      id: "RIV-05",
      name: "review needs changes",
      story: baseStory({
        safety: ALLOW_SAFETY,
        review: { ...PASS_REVIEW, verdict: "revise" },
      }),
      expected: "needs_changes",
    },
    {
      id: "RIV-06",
      name: "reviewed and passing",
      story: baseStory({ status: "reviewed", safety: ALLOW_SAFETY, review: PASS_REVIEW }),
      expected: "ready",
    },
    {
      id: "RIV-07",
      name: "answer changed after writing",
      story: baseStory({
        transcript: "a corrected answer",
        writtenFromHash: hashTranscript("the original answer"),
        safety: ALLOW_SAFETY,
        review: PASS_REVIEW,
        status: "reviewed",
      }),
      expected: "needs_check",
    },
    {
      id: "RIV-08",
      name: "legacy record has no stored hash",
      story: baseStory({ writtenFromHash: null, safety: ALLOW_SAFETY, review: PASS_REVIEW, status: "reviewed" }),
      expected: "ready",
    },
  ];

  for (const testCase of cases) {
    const state = deriveRiverState(testCase.story);
    expectCase({
      id: testCase.id,
      suite: "river-experience",
      name: testCase.name,
      expected: testCase.expected,
      actual: state.id,
      ok: state.id === testCase.expected,
    });
  }

  // The changed-answer modifier is exposed independently of the state.
  const changed = deriveRiverState(
    baseStory({ transcript: "new", writtenFromHash: hashTranscript("old") }),
  );
  expectCase({
    id: "RIV-09",
    suite: "river-experience",
    name: "changed-answer modifier flag",
    expected: "true",
    actual: String(changed.answerChangedSinceWriting),
    ok: changed.answerChangedSinceWriting === true,
  });

  // Article title composition round-trips through getArticleTitle.
  const composed = `# My First Job\n\nI was sixteen.`;
  const title = getArticleTitle(composed);
  expectCase({
    id: "RIV-10",
    suite: "river-experience",
    name: "article title composition round-trip",
    expected: "My First Job",
    actual: title,
    ok: title === "My First Job",
  });

  // Upload cascade only deletes inside data/uploads/.
  const traversalCases: Array<{ id: string; path: string; expected: boolean }> = [
    { id: "RIV-11", path: "data/uploads/answer.webm", expected: true },
    { id: "RIV-12", path: "data/uploads/../../etc/passwd", expected: false },
    { id: "RIV-13", path: "data/uploads/../secrets.json", expected: false },
    { id: "RIV-14", path: "/etc/passwd", expected: false },
  ];
  for (const testCase of traversalCases) {
    const actual = isInsideUploads(testCase.path);
    expectCase({
      id: testCase.id,
      suite: "river-experience",
      name: `upload path guard: ${testCase.path}`,
      expected: String(testCase.expected),
      actual: String(actual),
      ok: actual === testCase.expected,
    });
  }
}

// ---------------------------------------------------------------------------
// Offline suite 5 — Drop experience rules (plan/drop-experience.md)
// ---------------------------------------------------------------------------

function runDropExperienceCases(): void {
  const textCases: Array<{ id: string; text: string; expected: boolean }> = [
    { id: "DROP-Q01", text: "abcdefg", expected: false },
    { id: "DROP-Q02", text: "abcdefgh", expected: true },
    { id: "DROP-Q03", text: "a".repeat(300), expected: true },
    { id: "DROP-Q04", text: "a".repeat(301), expected: false },
  ];
  for (const testCase of textCases) {
    const result = validateQuestionText(testCase.text);
    expectCase({
      id: testCase.id,
      suite: "drop-experience",
      name: `question text length ${testCase.text.length}`,
      expected: testCase.expected ? "accepted" : "rejected",
      actual: result.ok ? "accepted" : "rejected",
      ok: result.ok === testCase.expected,
    });
  }

  const knownTopics = ["job", "family"];
  const topicCases: Array<{ id: string; topics: unknown; expected: boolean }> = [
    { id: "DROP-T01", topics: ["job"], expected: true },
    { id: "DROP-T02", topics: ["unknown"], expected: false },
    { id: "DROP-T03", topics: ["job", "family", "a", "b", "c", "d"], expected: false },
  ];
  for (const testCase of topicCases) {
    const result = validateQuestionTopics(testCase.topics, knownTopics);
    expectCase({
      id: testCase.id,
      suite: "drop-experience",
      name: `question topics ${JSON.stringify(testCase.topics)}`,
      expected: testCase.expected ? "accepted" : "rejected",
      actual: result.ok ? "accepted" : "rejected",
      ok: result.ok === testCase.expected,
    });
  }

  const messageCases: Array<{
    id: string;
    a: { id: string; role: "river" | "drop"; age: number };
    b: { id: string; role: "river" | "drop"; age: number };
    expected: boolean;
  }> = [
    { id: "DROP-M01", a: { id: "a", role: "river", age: 60 }, b: { id: "b", role: "drop", age: 16 }, expected: false },
    { id: "DROP-M02", a: { id: "a", role: "river", age: 60 }, b: { id: "b", role: "drop", age: 18 }, expected: true },
    { id: "DROP-M03", a: { id: "a", role: "drop", age: 17 }, b: { id: "b", role: "river", age: 60 }, expected: true },
    { id: "DROP-M04", a: { id: "a", role: "river", age: 60 }, b: { id: "b", role: "river", age: 65 }, expected: true },
    { id: "DROP-M05", a: { id: "a", role: "drop", age: 20 }, b: { id: "a", role: "drop", age: 20 }, expected: false },
  ];
  for (const testCase of messageCases) {
    const actual = canMessage(testCase.a, testCase.b);
    expectCase({
      id: testCase.id,
      suite: "drop-experience",
      name: `${testCase.a.role} (${testCase.a.age}) -> ${testCase.b.role} (${testCase.b.age})`,
      expected: testCase.expected ? "allowed" : "refused",
      actual: actual ? "allowed" : "refused",
      ok: actual === testCase.expected,
    });
  }

  const nameCases: Array<{ id: string; name: string; expected: string }> = [
    { id: "DROP-N01", name: "Maya Chen", expected: "Maya C." },
    { id: "DROP-N02", name: "Maya", expected: "Maya" },
    { id: "DROP-N03", name: "   ", expected: "" },
    { id: "DROP-N04", name: "Liam O'Connor", expected: "Liam O." },
  ];
  for (const testCase of nameCases) {
    const actual = publicDisplayName({ name: testCase.name });
    expectCase({
      id: testCase.id,
      suite: "drop-experience",
      name: `public name ${JSON.stringify(testCase.name)}`,
      expected: JSON.stringify(testCase.expected),
      actual: JSON.stringify(actual),
      ok: actual === testCase.expected,
    });
  }

  const question = (overrides: Partial<Question> = {}): Question => ({
    id: "q-drop-eval",
    text: "What was your first job?",
    topicIds: ["job"],
    askedBy: "u-drop-eval",
    upvotes: 0,
    storyIds: [],
    createdAt: ISO,
    updatedAt: ISO,
    editedAt: null,
    ...overrides,
  });
  const stateCases: Array<{
    id: string;
    question: Question;
    stories: Story[];
    expected: string;
  }> = [
    { id: "DROP-S01", question: question(), stories: [], expected: "waiting" },
    {
      id: "DROP-S02",
      question: question({ storyIds: ["s-drop-draft"] }),
      stories: [baseStory({ id: "s-drop-draft", questionId: "q-drop-eval", status: "draft" })],
      expected: "in_progress",
    },
    {
      id: "DROP-S03",
      question: question({ storyIds: ["s-drop-live"] }),
      stories: [baseStory({ id: "s-drop-live", questionId: "q-drop-eval", status: "published" })],
      expected: "answered",
    },
    {
      id: "DROP-S04",
      question: question({ editedAt: ISO }),
      stories: [],
      expected: "waiting",
    },
  ];
  for (const testCase of stateCases) {
    const state = deriveDropQuestionState(testCase.question, testCase.stories);
    expectCase({
      id: testCase.id,
      suite: "drop-experience",
      name: `question state (${testCase.expected})`,
      expected: testCase.expected,
      actual: state.id,
      ok: state.id === testCase.expected,
    });
  }
  const edited = deriveDropQuestionState(question({ editedAt: ISO }), []);
  expectCase({
    id: "DROP-S05",
    suite: "drop-experience",
    name: "edited modifier",
    expected: "true",
    actual: String(edited.edited),
    ok: edited.edited === true,
  });

  const similarPool = [
    question({ id: "q-a", text: "What was your first job and how did you get it?" }),
    question({ id: "q-b", text: "How did you choose your career when you were young?" }),
    question({ id: "q-c", text: "What is your favourite family recipe?" }),
  ];
  const shortMatches = findSimilarQuestions("first job", similarPool);
  expectCase({
    id: "DROP-SIM01",
    suite: "drop-experience",
    name: "similar questions need 15 characters",
    expected: "0",
    actual: String(shortMatches.length),
    ok: shortMatches.length === 0,
  });
  const matches = findSimilarQuestions("How did you get your first job?", similarPool);
  expectCase({
    id: "DROP-SIM02",
    suite: "drop-experience",
    name: "keyword overlap ranks the first-job question first",
    expected: "q-a",
    actual: matches[0]?.question.id ?? "none",
    ok: matches[0]?.question.id === "q-a",
  });
}

// ---------------------------------------------------------------------------
// Live suite — model-backed agent quality (uses OpenRouter)
// ---------------------------------------------------------------------------

function loadEnvFile(file: string, override: boolean): void {
  const filePath = path.join(process.cwd(), file);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const LIVE_TRANSCRIPT = [
  "The first job I ever had was at a bakery on Main Street. I was sixteen.",
  "I swept floors and washed trays for 75 cents an hour.",
  "The owner, Mrs. Pappas, taught me to arrive early and to count the change twice.",
  "I think that job taught me more about people than any school ever did.",
].join(" ");

const FABRICATED_ARTICLE = [
  "# The Bakery on Main Street",
  "",
  "I got my first job at sixteen at a bakery on Main Street in Boston, earning 75 cents an hour.",
  "I swept floors and washed trays for Mrs. Pappas.",
  "In 1962, President Kennedy came in for bread and told me I would own the bakery someday.",
  "I think that job taught me more about people than any school ever did.",
].join("\n");

const DISTORTION_TRANSCRIPT = [
  "I think it was 1968 when my brother and I drove to California.",
  "We took turns driving and ran out of money in Arizona.",
].join(" ");

const DISTORTION_ARTICLE = [
  "# The Drive to California",
  "",
  "In 1968, my brother and I drove to California.",
  "We took turns driving and ran out of money in Arizona.",
].join("\n");

const PROFANITY_ARTICLE = [
  "# A Hell of a Summer",
  "",
  "I told the foreman to get damn lost, and he laughed.",
  "It was a hell of a summer, and I would do it all again.",
].join("\n");

const ILLEGAL_ARTICLE = [
  "# Making Easy Money",
  "",
  "Here is how to trick a lonely neighbor into giving you money:",
  "call them and say you are from their bank, ask them to read you the one-time code from their phone,",
  "then use their card number to buy gift cards.",
].join("\n");

const SUBTLE_SCAM_MESSAGE =
  "Hello my friend. I have a wonderful business idea that will make us both rich. " +
  "I only need one small favor from you first — trust me and we will share the fortune.";

const SAFE_MESSAGE = "Thank you for the story about your garden. What did you plant this year?";

function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 300) : String(err);
}

async function runLive(): Promise<void> {
  loadEnvFile(".env", false);
  loadEnvFile(".env.local", true);

  if (!process.env.OPENROUTER_API_KEY) {
    for (const id of ["LIVE-WRITE-01", "LIVE-REVIEW-01", "LIVE-FABRICATED-01", "LIVE-DISTORTION-01", "LIVE-SAFETY-SOFT-01", "LIVE-SAFETY-HARD-01", "LIVE-CHAT-BLOCK-01", "LIVE-CHAT-ALLOW-01"]) {
      skipCase({
        id,
        suite: "live",
        name: id,
        expected: "needs OPENROUTER_API_KEY",
        detail: "OPENROUTER_API_KEY is not set; load .env.local to run live checks.",
      });
    }
    return;
  }

  const { checkSafety, reviewArticle, writeArticle } = await import("../lib/agents");
  const { screenMessage } = await import("../lib/chat-safety");
  const { config } = await import("../lib/config");

  console.log(
    `\nLive models: writing=${config.writingModel} review=${config.reviewModel} safety=${config.llmModel}\n`,
  );

  // 1. Writing agent produces a usable draft.
  let draft: Awaited<ReturnType<typeof writeArticle>> | null = null;
  try {
    const { value, ms } = await timed(() => writeArticle(LIVE_TRANSCRIPT, null));
    draft = value;
    const ok =
      value.article.trim().startsWith("#") &&
      value.article.length > 80 &&
      value.metadata.topic.trim().length > 0;
    expectCase({
      id: "LIVE-WRITE-01",
      suite: "live",
      name: "writing agent: transcript → article + topic + summary",
      expected: "non-empty Markdown article with a title and topic",
      actual: `topic="${value.metadata.topic}", ${value.article.length} chars`,
      ok,
      latencyMs: ms,
      model: config.writingModel,
    });
  } catch (err) {
    expectCase({
      id: "LIVE-WRITE-01",
      suite: "live",
      name: "writing agent: transcript → article + topic + summary",
      expected: "non-empty Markdown article with a title and topic",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.writingModel,
    });
  }

  // 2. Fidelity: a faithful article should pass the independent review.
  if (draft) {
    try {
      const { value, ms } = await timed(() =>
        reviewArticle({ transcript: LIVE_TRANSCRIPT, article: draft!.article }),
      );
      const ok = value.verdict === "pass" && value.score >= 4;
      expectCase({
        id: "LIVE-REVIEW-01",
        suite: "live",
        name: "review agent: faithful article passes",
        expected: "verdict pass, score ≥ 4",
        actual: `verdict ${value.verdict}, score ${value.score}, ${value.issues.length} issue(s)`,
        ok,
        latencyMs: ms,
        model: config.reviewModel,
      });
    } catch (err) {
      expectCase({
        id: "LIVE-REVIEW-01",
        suite: "live",
        name: "review agent: faithful article passes",
        expected: "verdict pass, score ≥ 4",
        actual: `error: ${errorDetail(err)}`,
        ok: false,
        model: config.reviewModel,
      });
    }
  }

  // 3. Grounding: a fabricated fact must be caught (MVP acceptance criterion AC-3).
  try {
    const { value, ms } = await timed(() =>
      reviewArticle({ transcript: LIVE_TRANSCRIPT, article: FABRICATED_ARTICLE }),
    );
    const invented = value.issues.filter((issue) => issue.type === "invented_fact");
    const ok = value.verdict === "revise" && invented.length > 0;
    expectCase({
      id: "LIVE-FABRICATED-01",
      suite: "live",
      name: "review agent catches an invented fact",
      expected: "verdict revise with ≥1 invented_fact issue",
      actual: `verdict ${value.verdict}, score ${value.score}, ${invented.length} invented_fact issue(s)`,
      ok,
      latencyMs: ms,
      model: config.reviewModel,
      detail: value.issues[0]?.detail.slice(0, 200),
    });
  } catch (err) {
    expectCase({
      id: "LIVE-FABRICATED-01",
      suite: "live",
      name: "review agent catches an invented fact",
      expected: "verdict revise with ≥1 invented_fact issue",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.reviewModel,
    });
  }

  // 4. Grounding: removing the senior's hedge is a distortion.
  try {
    const { value, ms } = await timed(() =>
      reviewArticle({ transcript: DISTORTION_TRANSCRIPT, article: DISTORTION_ARTICLE }),
    );
    const distortion = value.issues.filter((issue) => issue.type === "distortion");
    const ok = value.verdict === "revise" && distortion.length > 0;
    expectCase({
      id: "LIVE-DISTORTION-01",
      suite: "live",
      name: "review agent catches a removed hedge (distortion)",
      expected: "verdict revise with ≥1 distortion issue",
      actual: `verdict ${value.verdict}, score ${value.score}, ${distortion.length} distortion issue(s)`,
      ok,
      latencyMs: ms,
      model: config.reviewModel,
      detail: value.issues[0]?.detail.slice(0, 200),
    });
  } catch (err) {
    expectCase({
      id: "LIVE-DISTORTION-01",
      suite: "live",
      name: "review agent catches a removed hedge (distortion)",
      expected: "verdict revise with ≥1 distortion issue",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.reviewModel,
    });
  }

  // 5. Safety: mild profanity is a soft issue → revise, never a hard block.
  try {
    const { value, ms } = await timed(() =>
      checkSafety({ content: PROFANITY_ARTICLE, kind: "article", context: LIVE_TRANSCRIPT }),
    );
    const ok = value.verdict === "revise" && value.issues.every((issue) => issue.severity === "soft");
    expectCase({
      id: "LIVE-SAFETY-SOFT-01",
      suite: "live",
      name: "safety agent: mild profanity is soft (revise, not block)",
      expected: "verdict revise, soft issues only",
      actual: `verdict ${value.verdict}, ${value.issues.map((i) => `${i.severity}/${i.category}`).join(",") || "no issues"}`,
      ok,
      latencyMs: ms,
      model: config.llmModel,
    });
  } catch (err) {
    expectCase({
      id: "LIVE-SAFETY-SOFT-01",
      suite: "live",
      name: "safety agent: mild profanity is soft (revise, not block)",
      expected: "verdict revise, soft issues only",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.llmModel,
    });
  }

  // 6. Safety: illegal/scam instructions are a hard block.
  try {
    const { value, ms } = await timed(() =>
      checkSafety({ content: ILLEGAL_ARTICLE, kind: "article", context: null }),
    );
    const hard = value.issues.filter((issue) => issue.severity === "hard");
    const ok = value.verdict === "block" && hard.length > 0;
    expectCase({
      id: "LIVE-SAFETY-HARD-01",
      suite: "live",
      name: "safety agent: scam instructions hard-block",
      expected: "verdict block with ≥1 hard issue",
      actual: `verdict ${value.verdict}, ${hard.length} hard issue(s)`,
      ok,
      latencyMs: ms,
      model: config.llmModel,
      detail: value.issues[0]?.detail.slice(0, 200),
    });
  } catch (err) {
    expectCase({
      id: "LIVE-SAFETY-HARD-01",
      suite: "live",
      name: "safety agent: scam instructions hard-block",
      expected: "verdict block with ≥1 hard issue",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.llmModel,
    });
  }

  // 7. Chat layer 2: a scam the regex layer cannot see must still be blocked.
  try {
    const { value, ms } = await timed(() => screenMessage(SUBTLE_SCAM_MESSAGE));
    expectCase({
      id: "LIVE-CHAT-BLOCK-01",
      suite: "live",
      name: "chat semantic screen blocks a subtle scam (no regex match)",
      expected: "verdict block",
      actual: `verdict ${value.verdict}, flags [${value.flags.join(",")}]`,
      ok: value.verdict === "block",
      latencyMs: ms,
      model: config.llmModel,
    });
  } catch (err) {
    expectCase({
      id: "LIVE-CHAT-BLOCK-01",
      suite: "live",
      name: "chat semantic screen blocks a subtle scam (no regex match)",
      expected: "verdict block",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.llmModel,
    });
  }

  // 8. Chat layer 2: an ordinary friendly message must be delivered.
  try {
    const { value, ms } = await timed(() => screenMessage(SAFE_MESSAGE));
    expectCase({
      id: "LIVE-CHAT-ALLOW-01",
      suite: "live",
      name: "chat semantic screen allows an ordinary message",
      expected: "verdict allow",
      actual: `verdict ${value.verdict}, flags [${value.flags.join(",")}]`,
      ok: value.verdict === "allow",
      latencyMs: ms,
      model: config.llmModel,
    });
  } catch (err) {
    expectCase({
      id: "LIVE-CHAT-ALLOW-01",
      suite: "live",
      name: "chat semantic screen allows an ordinary message",
      expected: "verdict allow",
      actual: `error: ${errorDetail(err)}`,
      ok: false,
      model: config.llmModel,
    });
  }
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 160);
}

function writeSuite(
  dir: string,
  name: string,
  cases: CaseResult[],
  meta: Record<string, unknown>,
): void {
  const passed = cases.filter((c) => c.status === "pass").length;
  const failed = cases.filter((c) => c.status === "fail").length;
  const skipped = cases.filter((c) => c.status === "skip").length;
  const generatedAt = new Date().toISOString();

  writeFileSync(
    path.join(dir, `${name}.json`),
    `${JSON.stringify({ suite: name, generatedAt, startedAt, summary: { passed, failed, skipped, total: cases.length }, meta, cases }, null, 2)}\n`,
  );

  const rows = cases
    .map(
      (c) =>
        `| ${c.id} | ${escapeCell(c.name)} | ${escapeCell(c.expected)} | ${escapeCell(c.actual)} | ${c.status} | ${
          c.latencyMs === undefined ? "—" : `${c.latencyMs} ms`
        } |`,
    )
    .join("\n");

  const metaLines = Object.entries(meta)
    .map(([key, value]) => `- **${key}:** ${String(value)}`)
    .join("\n");

  const markdown = [
    `# HistorAI evaluation — ${name}`,
    "",
    `Generated: ${generatedAt}  `,
    `Started: ${startedAt}`,
    "",
    `**Summary:** ${passed} passed · ${failed} failed · ${skipped} skipped · ${cases.length} total`,
    "",
    metaLines,
    "",
    "| ID | Case | Expected | Actual | Status | Latency |",
    "|----|------|----------|--------|--------|---------|",
    rows,
    "",
  ].join("\n");

  writeFileSync(path.join(dir, `${name}.md`), markdown);
}

function writeReports(includeLive: boolean): void {
  const dir = path.join(process.cwd(), "eval", "results");
  mkdirSync(dir, { recursive: true });

  const offline = results.filter((r) => r.suite !== "live");
  const live = results.filter((r) => r.suite === "live");

  writeSuite(dir, "offline", offline, {
    "Node": process.version,
    "Network": "none (deterministic logic only)",
  });

  if (includeLive) {
    writeSuite(dir, "live", live, {
      "Node": process.version,
      "Network": "OpenRouter (real model calls)",
    });
  }

  const failed = results.filter((r) => r.status === "fail").length;
  console.log(`\nResults written to eval/results/ (${failed} failure(s)).`);
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const includeLive = process.argv.includes("--live");
  console.log(`HistorAI evaluation — ${includeLive ? "offline + live" : "offline"} mode\n`);

  runVerdictCases();
  runAgeCases();
  runEnvPolicyCases();
  runChatPatternCases();
  runRiverExperienceCases();
  runDropExperienceCases();

  if (includeLive) {
    await runLive();
  }

  writeReports(includeLive);
  process.exitCode = results.some((r) => r.status === "fail") ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
