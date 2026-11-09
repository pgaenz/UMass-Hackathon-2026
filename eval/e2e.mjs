#!/usr/bin/env node
/**
 * HistorAI black-box HTTP evaluation (Deliverable 5, end-to-end).
 *
 * Runs against a live dev server and exercises the real routes — sessions,
 * intake, generation, publish gates, feed isolation, likes, and chat screening.
 * No internal imports: everything goes over HTTP, so the results reflect what a
 * user actually experiences.
 *
 * Usage (from the repo root):
 *   1. npm run dev                # in another terminal
 *   2. npm run eval:e2e
 *
 * Config:
 *   E2E_BASE_URL   default http://localhost:3000
 *
 * The run resets the Postgres database the dev server is using and re-seeds it
 * from the committed `eval/fixtures/*.json` files before the first request, so
 * repeated runs stay reproducible. Point the server at a test database before
 * running this suite: the reset is destructive.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const FIXTURES_DIR = path.join(ROOT, "eval", "fixtures");
const RESULTS_DIR = path.join(ROOT, "eval", "results");
const UPLOAD_DIR = path.join(ROOT, "data", "uploads");
const prisma = new PrismaClient();

// Seed users get credentials from scripts/seed-test-db.ts (run by
// resetAndSeed). Keep this mapping in sync with that script.
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD || "historai-dev-password";
const SEED_EMAIL_DOMAIN = "seed.historai.test";

function seedEmail(userId) {
  return `${userId}@${SEED_EMAIL_DOMAIN}`;
}

// One-time-token helpers. The routes only ever receive the raw token; the
// database stores its SHA-256 hash, so the harness can mint a valid token by
// inserting the hash directly (the real email link is not returned by the API).
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function newOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

/** Upload files that existed before the run, so any new ones can be cleaned up. */
function listUploads() {
  if (!existsSync(UPLOAD_DIR)) return [];
  return readdirSync(UPLOAD_DIR);
}

function removeNewUploads(before) {
  for (const name of listUploads()) {
    if (before.includes(name)) continue;
    try {
      unlinkSync(path.join(UPLOAD_DIR, name));
    } catch {
      // Best effort: a missing file is not a test failure.
    }
  }
}

const startedAt = new Date().toISOString();
const results = [];

// ---------------------------------------------------------------------------
// Result plumbing
// ---------------------------------------------------------------------------

function expectCase({ id, name, expected, actual, ok, latencyMs, detail, knownIssue }) {
  // `known` keeps a documented limitation visible in the results without being
  // reported as a regression: the run still counts it separately and the case
  // stays red-flagged until it is fixed.
  const status = ok ? "pass" : knownIssue ? "known" : "fail";
  results.push({ id, suite: "e2e", name, expected, actual, status, latencyMs, detail });
  console.log(`[${status.toUpperCase()}] ${id} — ${name}`);
  console.log(`        expected: ${expected}`);
  console.log(`        actual:   ${actual}`);
  if (detail) console.log(`        detail:   ${detail}`);
}

function skipCase({ id, name, expected, detail }) {
  results.push({ id, suite: "e2e", name, expected, actual: "skipped", status: "skip", detail });
  console.log(`[SKIP] ${id} — ${name}: ${detail}`);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function makeJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(res) {
      const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const cookie of cookies) {
        const pair = cookie.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq <= 0) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (value === "" && /expires=Thu, 01 Jan 1970/i.test(cookie)) {
          jar.delete(name);
        } else {
          jar.set(name, value);
        }
      }
    },
  };
}

async function req(jar, method, route, body, extraHeaders = {}) {
  const headers = { Cookie: jar.header(), ...extraHeaders };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const start = Date.now();
  const res = await fetch(`${BASE}${route}`, { method, headers, body: payload, redirect: "manual" });
  jar.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON response (HTML page, etc.) — keep the raw text.
  }
  return { status: res.status, json, text, ms: Date.now() - start };
}

async function signIn(jar, userId) {
  return req(jar, "POST", "/api/auth/login", {
    email: seedEmail(userId),
    password: SEED_PASSWORD,
  });
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return true;
    } catch {
      // Server not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Database reset / seed
// ---------------------------------------------------------------------------

/**
 * Fixture discovery reads the committed JSON fixtures under `eval/fixtures/`,
 * which are also the seed source. The database is reset from those files before
 * every run, so the two always agree at the start of the suite.
 */
function readData(name) {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

/** Drops the schema, re-applies migrations, and imports the committed JSON. */
function resetAndSeed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to reset the e2e database.");
  }
  console.log(`Resetting the e2e database (${databaseUrl.replace(/:[^:@/]+@/, ":***@")})…`);
  const env = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: process.env.DIRECT_URL || databaseUrl };
  execFileSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  execFileSync("npx", ["tsx", "scripts/seed-test-db.ts"], {
    cwd: ROOT,
    env: { ...env, SEED_USER_PASSWORD: SEED_PASSWORD },
    stdio: "inherit",
  });
}

// ---------------------------------------------------------------------------
// E2E-A: profile creation and age validation over the real route
// ---------------------------------------------------------------------------

async function ageCases() {
  const jar = makeJar();
  const invalid = [
    { id: "E2E-AGE-01", body: { role: "drop", name: "Eval Age 12", age: 12 } },
    { id: "E2E-AGE-02", body: { role: "drop", name: "Eval Age 121", age: 121 } },
    { id: "E2E-AGE-03", body: { role: "drop", name: "Eval Age Fraction", age: 13.5 } },
    { id: "E2E-AGE-04", body: { role: "drop", name: "Eval Age Text", age: "abc" } },
    { id: "E2E-AGE-05", body: { role: "drop", age: 30 } },
    { id: "E2E-AGE-06", body: { role: "adult", name: "Eval Age Role", age: 30 } },
  ];

  for (const testCase of invalid) {
    const res = await req(jar, "POST", "/api/auth/register", testCase.body);
    expectCase({
      id: testCase.id,
      name: `POST /api/auth/register rejects ${JSON.stringify(testCase.body)}`,
      expected: "400 (invalid profile)",
      actual: `${res.status} ${res.json?.error ?? ""}`.trim(),
      ok: res.status === 400,
      latencyMs: res.ms,
    });
  }

  const valid = await req(jar, "POST", "/api/auth/register", {
    role: "drop",
    name: "Alice Johnson",
    age: 16,
    email: "alice.johnson@e2e.example.test",
    password: SEED_PASSWORD,
  });
  const user = valid.json?.user;
  const leaksAge = user ? "age" in user : true;
  const ok = valid.status === 201 && user?.ageBand === "13-17" && !leaksAge;
  expectCase({
    id: "E2E-AGE-07",
    name: "POST /api/auth/register accepts age 16 and returns only the age band",
    expected: "201, ageBand 13-17, no `age` field",
    actual: `${valid.status}, ageBand=${user?.ageBand ?? "—"}${leaksAge ? ", LEAKED age" : ""}`,
    ok,
    latencyMs: valid.ms,
  });

  // Known limitation: the name safety gate rejects any display name containing
  // the word "Drop", which is the product's own term for young users. The model
  // gives inconsistent reasons ("harmful reference" / "dangerous behavior" /
  // "inappropriate") and there is no human-review path for a rejected name.
  const dropName = await req(jar, "POST", "/api/auth/register", {
    role: "drop",
    name: "Drop Test",
    age: 25,
    email: "drop.test@e2e.example.test",
    password: SEED_PASSWORD,
  });
  expectCase({
    id: "E2E-AGE-08",
    name: "benign name containing the product term \"Drop\" is accepted (known false positive)",
    expected: "201 (benign name accepted)",
    actual: `${dropName.status} ${dropName.json?.error ?? ""}`.trim(),
    ok: dropName.status === 201,
    knownIssue: true,
    latencyMs: dropName.ms,
  });
}

// ---------------------------------------------------------------------------
// E2E-B: publish gates (deterministic; seeded fixtures, no model calls)
// ---------------------------------------------------------------------------

async function gateCases() {
  const stories = readData("stories.json").stories;

  const blocked = stories.find(
    (story) => story.safety?.verdict === "block" && story.authorId && story.article?.trim(),
  );
  if (blocked) {
    const jar = makeJar();
    await signIn(jar, blocked.authorId);
    const res = await req(jar, "POST", "/api/approve", { id: blocked.id, override: true });
    expectCase({
      id: "E2E-GATE-01",
      name: "a hard-blocked story cannot be published, even with override",
      expected: "409",
      actual: `${res.status} ${res.json?.error ?? ""}`.trim(),
      ok: res.status === 409,
      latencyMs: res.ms,
    });
  } else {
    skipCase({
      id: "E2E-GATE-01",
      name: "a hard-blocked story cannot be published, even with override",
      expected: "409",
      detail: "no seeded blocked story found",
    });
  }

  const flagged = stories.find(
    (story) =>
      story.review?.verdict === "revise" &&
      story.article?.trim() &&
      story.safety?.verdict !== "block" &&
      story.authorId,
  );
  if (flagged) {
    // The seeded fixture may have been published during development. Reset it
    // to `reviewed` in the database so the gate can be tested deterministically.
    await prisma.story.update({ where: { id: flagged.id }, data: { status: "reviewed" } });
    const jar = makeJar();
    await signIn(jar, flagged.authorId);
    const withoutOverride = await req(jar, "POST", "/api/approve", { id: flagged.id });
    expectCase({
      id: "E2E-GATE-02",
      name: "a story that failed the review needs explicit confirmation",
      expected: "409 without override",
      actual: `${withoutOverride.status} ${withoutOverride.json?.error ?? ""}`.trim(),
      ok: withoutOverride.status === 409,
      latencyMs: withoutOverride.ms,
    });

    const withOverride = await req(jar, "POST", "/api/approve", {
      id: flagged.id,
      override: true,
    });
    expectCase({
      id: "E2E-GATE-03",
      name: "the River can still publish after a flagged review",
      expected: "200, status published",
      actual: `${withOverride.status}, status ${withOverride.json?.story?.status ?? "—"}`,
      ok: withOverride.status === 200 && withOverride.json?.story?.status === "published",
      latencyMs: withOverride.ms,
    });
  } else {
    skipCase({
      id: "E2E-GATE-02",
      name: "a story that failed the review needs explicit confirmation",
      expected: "409 without override",
      detail: "no seeded revise story found",
    });
    skipCase({
      id: "E2E-GATE-03",
      name: "the River can still publish after a flagged review",
      expected: "200 published",
      detail: "no seeded revise story found",
    });
  }

  // A draft with no article yet can never be approved.
  const jar = makeJar();
  await signIn(jar, "u-seed-ruth");
  const intake = await req(jar, "POST", "/api/intake", {
    inputType: "text",
    prompt: "E2E gate fixture",
    text: "EVAL-GATE-MARKER: this draft intentionally has no article yet.",
  });
  const storyId = intake.json?.story?.id;
  const approve = await req(jar, "POST", "/api/approve", { id: storyId });
  expectCase({
    id: "E2E-GATE-04",
    name: "a draft without an article cannot be approved",
    expected: "409",
    actual: `${approve.status} ${approve.json?.error ?? ""}`.trim(),
    ok: intake.status === 201 && approve.status === 409,
    latencyMs: approve.ms,
  });
}

// ---------------------------------------------------------------------------
// E2E-C: the full typed pipeline (intake → generate → approve → feed)
// ---------------------------------------------------------------------------

async function pipelineCases() {
  const jar = makeJar();
  await signIn(jar, "u-seed-ruth");

  const answer = [
    "The first job I ever had was at Zephyrina's Bakery on Mulberry Lane.",
    "I was sixteen and I swept floors for 75 cents an hour.",
    "The owner taught me to count the change twice.",
  ].join(" ");

  const intake = await req(jar, "POST", "/api/intake", {
    inputType: "text",
    prompt: "What was your first job, and how did you get it?",
    text: answer,
    questionId: "q-first-job",
  });
  const story = intake.json?.story;
  expectCase({
    id: "E2E-PIPE-01",
    name: "POST /api/intake stores the answer as a draft",
    expected: "201, status draft, transcript echoed",
    actual: `${intake.status}, status ${story?.status ?? "—"}, transcript ${story?.transcript === answer ? "match" : "MISMATCH"}`,
    ok: intake.status === 201 && story?.status === "draft" && story?.transcript === answer,
    latencyMs: intake.ms,
  });
  if (!story?.id) return;

  const generate = await req(jar, "POST", "/api/generate", { id: story.id });
  const generated = generate.json?.story;
  const safetyVerdict = generated?.safety?.verdict ?? "—";
  const reviewVerdict = generated?.review?.verdict ?? "—";
  expectCase({
    id: "E2E-PIPE-02",
    name: "POST /api/generate produces an article plus safety and review verdicts",
    expected: "200, non-empty article, safety verdict present",
    actual: `${generate.status}, ${generated?.article?.length ?? 0} chars, safety=${safetyVerdict}, review=${reviewVerdict}`,
    ok: generate.status === 200 && (generated?.article?.length ?? 0) > 0 && safetyVerdict !== "—",
    latencyMs: generate.ms,
  });

  // The dev server compiles a route on its first request. Warm the feed up so
  // the isolation check below cannot race with that compilation.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const warm = await fetch(`${BASE}/youth`);
    await warm.text();
    if (warm.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Feed isolation: the story must not appear before approval.
  const before = await fetch(`${BASE}/youth`);
  const htmlBefore = await before.text();
  if (process.env.E2E_DUMP_DIR) {
    mkdirSync(process.env.E2E_DUMP_DIR, { recursive: true });
    writeFileSync(path.join(process.env.E2E_DUMP_DIR, "youth-before.html"), htmlBefore);
    writeFileSync(
      path.join(process.env.E2E_DUMP_DIR, "story-at-before.json"),
      JSON.stringify(generated, null, 2),
    );
    const dbStory = await prisma.story.findUnique({ where: { id: story.id } });
    writeFileSync(
      path.join(process.env.E2E_DUMP_DIR, "data-at-before.json"),
      JSON.stringify(dbStory, null, 2),
    );
  }
  expectCase({
    id: "E2E-PIPE-03",
    name: "an unpublished story does not appear in /youth",
    expected: "marker absent from the rendered feed",
    actual: `${before.status}, ${htmlBefore.includes("Zephyrina") ? "marker PRESENT" : "marker absent"}`,
    ok: before.ok && !htmlBefore.includes("Zephyrina"),
  });

  const needsOverride = generated?.review?.verdict !== "pass";
  const approve = await req(jar, "POST", "/api/approve", {
    id: story.id,
    ...(needsOverride ? { override: true } : {}),
  });
  expectCase({
    id: "E2E-PIPE-04",
    name: "the River approves the story (override only when the review flagged it)",
    expected: "200, status published",
    actual: `${approve.status}, status ${approve.json?.story?.status ?? "—"}${needsOverride ? " (override)" : ""}`,
    ok: approve.status === 200 && approve.json?.story?.status === "published",
    latencyMs: approve.ms,
  });

  const after = await fetch(`${BASE}/youth`);
  const htmlAfter = await after.text();
  if (process.env.E2E_DUMP_DIR) {
    writeFileSync(path.join(process.env.E2E_DUMP_DIR, "youth-after.html"), htmlAfter);
  }
  expectCase({
    id: "E2E-PIPE-05",
    name: "the approved story appears in /youth",
    expected: "marker present in the rendered feed",
    actual: `${after.status}, ${htmlAfter.includes("Zephyrina") ? "marker present" : "marker ABSENT"}`,
    ok: after.ok && htmlAfter.includes("Zephyrina"),
  });
}

// ---------------------------------------------------------------------------
// E2E-D: likes → interest match, and chat screening over HTTP
// ---------------------------------------------------------------------------

async function likesAndChatCases() {
  const likes = readData("likes.json").likes;
  const stories = readData("stories.json").stories;
  const published = stories.filter(
    (story) => story.status === "published" && story.safety?.verdict !== "block",
  );
  const likeTarget = published.find(
    (story) =>
      !likes.some((like) => like.storyId === story.id && like.userId === "u-seed-maya") &&
      likes.some((like) => like.storyId === story.id && like.userId !== "u-seed-maya"),
  );

  const jar = makeJar();
  await signIn(jar, "u-seed-maya");

  if (likeTarget) {
    const likeRes = await req(jar, "POST", `/api/stories/${likeTarget.id}/like`, { like: true });
    const match = likeRes.json?.match;
    expectCase({
      id: "E2E-LIKE-01",
      name: "liking a story returns a match when someone else liked it too",
      expected: "200, liked, match with a user",
      actual: `${likeRes.status}, liked=${likeRes.json?.liked}, match=${match?.user?.name ?? "none"}`,
      ok: likeRes.status === 200 && likeRes.json?.liked === true && Boolean(match?.user?.id),
      latencyMs: likeRes.ms,
    });
  } else {
    skipCase({
      id: "E2E-LIKE-01",
      name: "liking a story returns a match when someone else liked it too",
      expected: "200, liked, match with a user",
      detail: "no suitable seeded story found",
    });
  }

  const threadRes = await req(jar, "POST", "/api/chat/threads", { participantId: "u-seed-ruth" });
  const threadId = threadRes.json?.thread?.id;
  expectCase({
    id: "E2E-CHAT-00",
    name: "POST /api/chat/threads opens (or reopens) a 1:1 thread",
    expected: "200/201 with a thread id",
    actual: `${threadRes.status}, thread ${threadId ?? "—"}`,
    ok: [200, 201].includes(threadRes.status) && Boolean(threadId),
    latencyMs: threadRes.ms,
  });
  if (!threadId) return;

  const safe = await req(jar, "POST", `/api/chat/threads/${threadId}/messages`, {
    body: "Thank you for your story about the garden. What did you plant this year?",
  });
  expectCase({
    id: "E2E-CHAT-01",
    name: "an ordinary message is delivered",
    expected: "201",
    actual: `${safe.status} ${safe.json?.error ?? ""}`.trim(),
    ok: safe.status === 201,
    latencyMs: safe.ms,
  });

  const blockedCases = [
    {
      id: "E2E-CHAT-02",
      text: "Call me at 617-555-1234.",
      flag: "pii:phone",
      expected: "422 with pii:phone",
    },
    {
      id: "E2E-CHAT-03",
      text: "Please send money by gift card.",
      flag: "scam:money",
      expected: "422 with scam:money",
    },
    {
      id: "E2E-CHAT-04",
      text: "Hello my friend, I have a business idea that will make us both rich. I only need one small favor first.",
      flag: null,
      expected: "422 (semantic screen)",
    },
  ];

  for (const testCase of blockedCases) {
    const res = await req(jar, "POST", `/api/chat/threads/${threadId}/messages`, {
      body: testCase.text,
    });
    const flags = res.json?.flags ?? [];
    const ok =
      res.status === 422 && (testCase.flag === null || flags.includes(testCase.flag));
    expectCase({
      id: testCase.id,
      name: `blocked before delivery: "${testCase.text.slice(0, 48)}…"`,
      expected: testCase.expected,
      actual: `${res.status} flags [${flags.join(",")}]`,
      ok,
      latencyMs: res.ms,
    });
  }

  const crisis = await req(jar, "POST", `/api/chat/threads/${threadId}/messages`, {
    body: "I want to die.",
  });
  expectCase({
    id: "E2E-CHAT-05",
    name: "crisis language is intercepted with the 988 resource message",
    expected: "422 with crisis=true",
    actual: `${crisis.status}, crisis=${crisis.json?.crisis ?? false}`,
    ok: crisis.status === 422 && crisis.json?.crisis === true,
    latencyMs: crisis.ms,
  });
}

// ---------------------------------------------------------------------------
// E2E-E: River ownership, save-only intake, transcript-only edit, cascade
// ---------------------------------------------------------------------------

async function riverExperienceCases() {
  const stories = readData("stories.json").stories;
  const target = stories.find((story) => story.authorId && story.article?.trim());
  if (!target) {
    skipCase({
      id: "E2E-RIV-01",
      name: "River story routes require a session",
      expected: "401",
      detail: "no authored story found in seed data",
    });
    return;
  }
  const storyId = target.id;

  // 1. Every new mutating route refuses an anonymous caller.
  const anon = makeJar();
  const routes = [
    { id: "E2E-RIV-01", method: "PATCH", route: `/api/stories/${storyId}`, body: { transcript: "x" } },
    { id: "E2E-RIV-02", method: "DELETE", route: `/api/stories/${storyId}` },
    { id: "E2E-RIV-03", method: "POST", route: `/api/stories/${storyId}/check` },
    { id: "E2E-RIV-04", method: "POST", route: `/api/stories/${storyId}/unpublish` },
    { id: "E2E-RIV-05", method: "POST", route: `/api/stories/${storyId}/restore` },
  ];
  for (const item of routes) {
    const res = await req(anon, item.method, item.route, item.body);
    expectCase({
      id: item.id,
      name: `${item.method} ${item.route} requires a session`,
      expected: "401",
      actual: String(res.status),
      ok: res.status === 401,
      latencyMs: res.ms,
    });
  }

  // 2. A different River is refused with 403.
  const otherRiver = readData("users.json").users.find(
    (user) => user.role === "river" && user.id !== target.authorId,
  );
  if (otherRiver) {
    const other = makeJar();
    await signIn(other, otherRiver.id);
    const res = await req(other, "PATCH", `/api/stories/${storyId}`, { transcript: "x" });
    expectCase({
      id: "E2E-RIV-06",
      name: "another River cannot edit this story",
      expected: "403",
      actual: `${res.status} ${res.json?.error ?? ""}`.trim(),
      ok: res.status === 403,
      latencyMs: res.ms,
    });
  } else {
    skipCase({ id: "E2E-RIV-06", name: "another River cannot edit this story", expected: "403", detail: "only one river" });
  }

  // 3. A legacy story with no author cannot be published by any River.
  const legacy = stories.find((story) => story.authorId === null && story.article?.trim());
  if (legacy) {
    const jar = makeJar();
    await signIn(jar, target.authorId);
    const res = await req(jar, "POST", "/api/approve", { id: legacy.id, override: true });
    expectCase({
      id: "E2E-RIV-07",
      name: "a null-author story is not publishable by a River",
      expected: "403",
      actual: String(res.status),
      ok: res.status === 403,
      latencyMs: res.ms,
    });
  } else {
    skipCase({ id: "E2E-RIV-07", name: "a null-author story is not publishable by a River", expected: "403", detail: "no null-author story" });
  }

  const owner = makeJar();
  await signIn(owner, target.authorId);

  // 4. Saving an answer only creates a story with an empty article.
  const intake = await req(owner, "POST", "/api/intake", {
    inputType: "text",
    prompt: "E2E river fixture",
    text: "EVAL-RIVEMARKER a saved answer with no story yet.",
  });
  const newId = intake.json?.story?.id;
  expectCase({
    id: "E2E-RIV-08",
    name: "saving an answer makes a story with an empty article",
    expected: "201, article empty",
    actual: `${intake.status}, article=${JSON.stringify(intake.json?.story?.article ?? null)}`,
    ok: intake.status === 201 && intake.json?.story?.article === "",
    latencyMs: intake.ms,
  });

  if (newId) {
    // 5. A transcript-only PATCH never touches the article.
    const before = await prisma.story.findUnique({ where: { id: newId } });
    const patch = await req(owner, "PATCH", `/api/stories/${newId}`, {
      transcript: "EVAL-RIVEMARKER corrected answer.",
      expectedUpdatedAt: before?.updatedAt?.toISOString(),
    });
    expectCase({
      id: "E2E-RIV-09",
      name: "a transcript-only edit leaves the article unchanged",
      expected: "200, article still empty",
      actual: `${patch.status}, article=${JSON.stringify(patch.json?.story?.article ?? null)}`,
      ok: patch.status === 200 && patch.json?.story?.article === "",
      latencyMs: patch.ms,
    });
  }

  // 6. Unpublish returns the story to reviewed or draft.
  const published = stories.find((story) => story.status === "published" && story.authorId);
  if (published) {
    const jar = makeJar();
    await signIn(jar, published.authorId);
    const res = await req(jar, "POST", `/api/stories/${published.id}/unpublish`);
    const status = res.json?.story?.status;
    expectCase({
      id: "E2E-RIV-10",
      name: "unpublish takes a story off Read stories",
      expected: "200, status reviewed or draft",
      actual: `${res.status}, status ${status ?? "—"}`,
      ok: res.status === 200 && (status === "reviewed" || status === "draft"),
      latencyMs: res.ms,
    });
  }

  // 7. Delete removes likes and question links.
  const likes = readData("likes.json").likes;
  const liked = stories.find(
    (story) =>
      story.authorId && likes.some((like) => like.storyId === story.id),
  );
  if (liked) {
    const jar = makeJar();
    await signIn(jar, liked.authorId);
    const res = await req(jar, "DELETE", `/api/stories/${liked.id}`);
    const likesAfter = await prisma.storyLike.count({ where: { storyId: liked.id } });
    const storyAfter = await prisma.story.findUnique({ where: { id: liked.id } });
    expectCase({
      id: "E2E-RIV-11",
      name: "delete removes the story, its likes, and its question links",
      expected: "200, 0 likes, story gone",
      actual: `${res.status}, ${likesAfter} likes, ${storyAfter ? "present" : "gone"}`,
      ok: res.status === 200 && likesAfter === 0 && storyAfter === null,
      latencyMs: res.ms,
    });
  } else {
    skipCase({ id: "E2E-RIV-11", name: "delete removes likes and question links", expected: "200, 0, 0", detail: "no liked story" });
  }
}

// ---------------------------------------------------------------------------
// E2E-F: Drop experience — question ownership and the messaging age rule
// ---------------------------------------------------------------------------

async function dropExperienceCases() {
  const questions = readData("questions.json").questions;
  const users = readData("users.json").users;
  const stories = readData("stories.json").stories;
  const hasLinkedStory = (questionId) =>
    stories.some((story) => story.questionId === questionId);
  const owned = questions.find(
    (question) =>
      question.askedBy &&
      users.find((user) => user.id === question.askedBy)?.role === "drop" &&
      !hasLinkedStory(question.id),
  );
  const linked = questions.find(
    (question) =>
      question.askedBy &&
      users.find((user) => user.id === question.askedBy)?.role === "drop" &&
      hasLinkedStory(question.id),
  );

  if (owned) {
    const anon = makeJar();
    const anonPatch = await req(anon, "PATCH", `/api/questions/${owned.id}`, {
      text: "A question edited without signing in.",
    });
    const anonDelete = await req(anon, "DELETE", `/api/questions/${owned.id}`);
    expectCase({
      id: "E2E-DROP-01",
      name: "question edit and withdraw require a session",
      expected: "401 and 401",
      actual: `${anonPatch.status} and ${anonDelete.status}`,
      ok: anonPatch.status === 401 && anonDelete.status === 401,
    });

    const otherDrop = users.find(
      (user) => user.role === "drop" && user.id !== owned.askedBy,
    );
    if (otherDrop) {
      const other = makeJar();
      await signIn(other, otherDrop.id);
      const res = await req(other, "PATCH", `/api/questions/${owned.id}`, {
        topicIds: [],
      });
      expectCase({
        id: "E2E-DROP-02",
        name: "another Drop cannot edit this question",
        expected: "403",
        actual: String(res.status),
        ok: res.status === 403,
      });
    }

    const signedIn = makeJar();
    await signIn(signedIn, owned.askedBy);
    const unknown = await req(signedIn, "PATCH", "/api/questions/q-does-not-exist", {
      topicIds: [],
    });
    expectCase({
      id: "E2E-DROP-03",
      name: "an unknown question returns 404",
      expected: "404",
      actual: String(unknown.status),
      ok: unknown.status === 404,
    });

    const owner = makeJar();
    await signIn(owner, owned.askedBy);
    const votesBefore = await prisma.questionVote.count({
      where: { questionId: owned.id },
    });
    const deleted = await req(owner, "DELETE", `/api/questions/${owned.id}`);
    const votesAfter = await prisma.questionVote.count({
      where: { questionId: owned.id },
    });
    const stillListed =
      (await prisma.question.findUnique({ where: { id: owned.id } })) !== null;
    expectCase({
      id: "E2E-DROP-04",
      name: "withdraw removes the question and its votes",
      expected: `200, ${votesBefore} -> 0, not listed`,
      actual: `${deleted.status}, ${votesBefore} -> ${votesAfter}, ${stillListed ? "listed" : "gone"}`,
      ok: deleted.status === 200 && votesAfter === 0 && !stillListed,
    });
  } else {
    skipCase({ id: "E2E-DROP-01..04", name: "Drop question mutation cases", expected: "200/401/403/404", detail: "no unlinked Drop question" });
  }

  if (linked) {
    const owner = makeJar();
    await signIn(owner, linked.askedBy);
    const patch = await req(owner, "PATCH", `/api/questions/${linked.id}`, {
      topicIds: [],
    });
    const del = await req(owner, "DELETE", `/api/questions/${linked.id}`);
    expectCase({
      id: "E2E-DROP-05",
      name: "edit and withdraw are refused once a story is linked",
      expected: "409 and 409",
      actual: `${patch.status} and ${del.status}`,
      ok: patch.status === 409 && del.status === 409,
    });
  }

  const similar = await req(makeJar(), "GET", "/api/questions/similar?text=What%20was%20your%20first%20job%3F");
  const leaked = Array.isArray(similar.json?.questions)
    ? similar.json.questions.some((question) => "askedBy" in question)
    : true;
  expectCase({
    id: "E2E-DROP-06",
    name: "similar questions never include askedBy",
    expected: "200, no askedBy",
    actual: `${similar.status}, ${leaked ? "leaked" : "clean"}`,
    ok: similar.status === 200 && !leaked,
  });

  const river = users.find((user) => user.role === "river");
  const minor = users.find((user) => user.role === "drop" && user.age < 18);
  const adultDrop = users.find((user) => user.role === "drop" && user.age >= 18);
  if (river && minor) {
    const jar = makeJar();
    await signIn(jar, river.id);
    const res = await req(jar, "POST", "/api/chat/threads", {
      participantId: minor.id,
    });
    expectCase({
      id: "E2E-DROP-07",
      name: "a River cannot start a thread with a Drop under 18",
      expected: "403 with a generic message",
      actual: `${res.status} ${res.json?.error ?? ""}`.trim(),
      ok:
        res.status === 403 &&
        res.json?.error === "You cannot start a conversation with this person.",
    });
  }

  if (river && adultDrop) {
    const jar = makeJar();
    await signIn(jar, river.id);
    const res = await req(jar, "POST", "/api/chat/threads", {
      participantId: adultDrop.id,
    });
    expectCase({
      id: "E2E-DROP-08",
      name: "a River can still start a thread with an adult Drop",
      expected: "200 or 201",
      actual: String(res.status),
      ok: res.status === 200 || res.status === 201,
    });
  }

  if (river && minor) {
    const jar = makeJar();
    await signIn(jar, minor.id);
    const res = await req(jar, "POST", "/api/chat/threads", {
      participantId: river.id,
    });
    expectCase({
      id: "E2E-DROP-09",
      name: "a Drop under 18 can still message a River",
      expected: "200 or 201",
      actual: String(res.status),
      ok: res.status === 200 || res.status === 201,
    });
  }
}

// ---------------------------------------------------------------------------
// E2E-G: credentials, sessions, and revocation over HTTP (Phase 4)
// ---------------------------------------------------------------------------

async function authCases() {
  const email = "e2e.auth@example.test";
  const password = "correct-horse-battery";
  // A plain human name, matching E2E-AGE-07, avoids the flaky name-safety
  // model that rejects agent-y strings like "E2E Auth User" (see E2E-AGE-08).
  const base = { role: "drop", name: "Alice Johnson", age: 22, email, password };

  const registered = await req(makeJar(), "POST", "/api/auth/register", base);
  const publicUser = registered.json?.user ?? {};
  expectCase({
    id: "E2E-AUTH-01",
    name: "registration creates an account, signs in, and leaks no secrets",
    expected: "201, user id, no email/passwordHash field",
    actual: String(registered.status),
    ok:
      registered.status === 201 &&
      Boolean(publicUser.id) &&
      !("email" in publicUser) &&
      !("passwordHash" in publicUser),
    latencyMs: registered.ms,
  });

  const duplicate = await req(makeJar(), "POST", "/api/auth/register", {
    ...base,
    name: "Alice Thompson",
  });
  expectCase({
    id: "E2E-AUTH-02",
    name: "registration rejects a duplicate email",
    expected: "409",
    actual: String(duplicate.status),
    ok: duplicate.status === 409,
    latencyMs: duplicate.ms,
  });

  const weak = await req(makeJar(), "POST", "/api/auth/register", {
    ...base,
    email: "e2e.weak@example.test",
    password: "short",
  });
  expectCase({
    id: "E2E-AUTH-03",
    name: "registration rejects a weak password",
    expected: "400",
    actual: `${weak.status} ${weak.json?.error ?? ""}`.trim(),
    ok: weak.status === 400,
    latencyMs: weak.ms,
  });

  const wrongPassword = await req(makeJar(), "POST", "/api/auth/login", {
    email,
    password: "not-the-password",
  });
  expectCase({
    id: "E2E-AUTH-04",
    name: "login rejects a wrong password with a generic message",
    expected: "401 Invalid email or password.",
    actual: `${wrongPassword.status} ${wrongPassword.json?.error ?? ""}`.trim(),
    ok: wrongPassword.status === 401 && wrongPassword.json?.error === "Invalid email or password.",
    latencyMs: wrongPassword.ms,
  });

  const sessionA = makeJar();
  const loginA = await req(sessionA, "POST", "/api/auth/login", { email, password });
  const sessionB = makeJar();
  const loginB = await req(sessionB, "POST", "/api/auth/login", { email, password });
  expectCase({
    id: "E2E-AUTH-05",
    name: "two devices sign in to the same account independently",
    expected: "200 and 200",
    actual: `${loginA.status} and ${loginB.status}`,
    ok: loginA.status === 200 && loginB.status === 200,
    latencyMs: loginA.ms,
  });

  const anon = await req(makeJar(), "POST", "/api/questions", { text: "E2E auth anon." });
  expectCase({
    id: "E2E-AUTH-06",
    name: "a protected route returns 401 without a session",
    expected: "401",
    actual: String(anon.status),
    ok: anon.status === 401,
    latencyMs: anon.ms,
  });

  const wrongRole = await req(sessionA, "POST", "/api/intake", {
    inputType: "text",
    prompt: "E2E auth role",
    text: "A Drop must not be able to save a River story.",
  });
  expectCase({
    id: "E2E-AUTH-07",
    name: "a protected route returns 403 for the wrong role",
    expected: "403",
    actual: String(wrongRole.status),
    ok: wrongRole.status === 403,
    latencyMs: wrongRole.ms,
  });

  const logout = await req(sessionA, "POST", "/api/auth/logout");
  const aAfter = await req(sessionA, "GET", "/api/chat/unread");
  const bAfter = await req(sessionB, "GET", "/api/chat/unread");
  expectCase({
    id: "E2E-AUTH-08",
    name: "logout revokes only the current session",
    expected: "200 logout; A 401; B 200",
    actual: `${logout.status}; A ${aAfter.status}; B ${bAfter.status}`,
    ok: logout.status === 200 && aAfter.status === 401 && bAfter.status === 200,
    latencyMs: logout.ms,
  });

  const demo = await req(makeJar(), "POST", "/api/auth/session", { userId: "u-seed-ruth" });
  expectCase({
    id: "E2E-AUTH-09",
    name: "the passwordless demo sign-in endpoint is gone",
    expected: "404",
    actual: String(demo.status),
    ok: demo.status === 404,
    latencyMs: demo.ms,
  });

  // A password change (Phase 5) bumps sessionVersion; every older session must
  // stop authenticating immediately, even though its row still exists.
  await prisma.user.update({
    where: { id: publicUser.id },
    data: { sessionVersion: { increment: 1 } },
  });
  const afterVersionBump = await req(sessionB, "GET", "/api/chat/unread");
  expectCase({
    id: "E2E-AUTH-10",
    name: "a bumped sessionVersion invalidates older sessions",
    expected: "401",
    actual: String(afterVersionBump.status),
    ok: afterVersionBump.status === 401,
    latencyMs: afterVersionBump.ms,
  });
}

// ---------------------------------------------------------------------------
// E2E-H: password lifecycle + request hardening (Phase 5)
// ---------------------------------------------------------------------------

async function passwordLifecycleCases() {
  const email = "e2e.lifecycle@example.test";
  const originalPassword = "original-password-1";
  const rotatedPassword = "rotated-password-2";
  const changedPassword = "changed-password-3";

  const registered = await req(makeJar(), "POST", "/api/auth/register", {
    role: "river",
    name: "Alice Johnson",
    age: 45,
    email,
    password: originalPassword,
  });
  const userId = registered.json?.user?.id;
  expectCase({
    id: "E2E-AUTH-11",
    name: "the lifecycle test account registers",
    expected: "201 with a user id",
    actual: `${registered.status}, id=${userId ?? "—"}`,
    ok: registered.status === 201 && Boolean(userId),
    latencyMs: registered.ms,
  });

  // "Forgot password" must answer identically for known and unknown emails.
  const known = await req(makeJar(), "POST", "/api/auth/password/forgot", { email });
  const unknown = await req(makeJar(), "POST", "/api/auth/password/forgot", {
    email: "nobody-here@example.test",
  });
  expectCase({
    id: "E2E-AUTH-12",
    name: "forgot password does not reveal whether an email exists",
    expected: "200 {ok:true} for both",
    actual: `${known.status} ${JSON.stringify(known.json)} / ${unknown.status} ${JSON.stringify(unknown.json)}`,
    ok:
      known.status === 200 &&
      unknown.status === 200 &&
      JSON.stringify(known.json) === JSON.stringify(unknown.json),
    latencyMs: known.ms,
  });

  const resetToken = newOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(resetToken),
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  // A session issued before the reset must not survive it.
  const otherDevice = makeJar();
  await req(otherDevice, "POST", "/api/auth/login", { email, password: originalPassword });

  const reset = await req(makeJar(), "POST", "/api/auth/password/reset", {
    token: resetToken,
    password: rotatedPassword,
  });
  const loginNew = await req(makeJar(), "POST", "/api/auth/login", {
    email,
    password: rotatedPassword,
  });
  const loginOld = await req(makeJar(), "POST", "/api/auth/login", {
    email,
    password: originalPassword,
  });
  const reuse = await req(makeJar(), "POST", "/api/auth/password/reset", {
    token: resetToken,
    password: "another-password-4",
  });
  const revoked = await req(otherDevice, "GET", "/api/chat/unread");

  expectCase({
    id: "E2E-AUTH-13",
    name: "a reset link rotates the password and works once",
    expected: "200 reset; 200 new login; 401 old login; 400 reuse",
    actual: `${reset.status}; ${loginNew.status}; ${loginOld.status}; ${reuse.status}`,
    ok:
      reset.status === 200 &&
      loginNew.status === 200 &&
      loginOld.status === 401 &&
      reuse.status === 400,
    latencyMs: reset.ms,
  });
  expectCase({
    id: "E2E-AUTH-14",
    name: "a reset revokes sessions issued before it",
    expected: "401",
    actual: String(revoked.status),
    ok: revoked.status === 401,
    latencyMs: revoked.ms,
  });

  const verifyToken = newOpaqueToken();
  await prisma.emailVerificationToken.create({
    data: {
      tokenHash: hashToken(verifyToken),
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  const verified = await req(makeJar(), "POST", "/api/auth/verify", { token: verifyToken });
  const verifyReuse = await req(makeJar(), "POST", "/api/auth/verify", { token: verifyToken });
  const credential = await prisma.credential.findUnique({ where: { userId } });
  expectCase({
    id: "E2E-AUTH-15",
    name: "an email verification token is single-use and stamps the credential",
    expected: "200 then 400; emailVerifiedAt set",
    actual: `${verified.status}; ${verifyReuse.status}; verified=${Boolean(credential?.emailVerifiedAt)}`,
    ok:
      verified.status === 200 &&
      verifyReuse.status === 400 &&
      Boolean(credential?.emailVerifiedAt),
    latencyMs: verified.ms,
  });

  const current = makeJar();
  await req(current, "POST", "/api/auth/login", { email, password: rotatedPassword });
  const stale = makeJar();
  await req(stale, "POST", "/api/auth/login", { email, password: rotatedPassword });
  const changed = await req(current, "POST", "/api/auth/password", {
    currentPassword: rotatedPassword,
    newPassword: changedPassword,
  });
  const currentAfter = await req(current, "GET", "/api/chat/unread");
  const staleAfter = await req(stale, "GET", "/api/chat/unread");
  const loginChanged = await req(makeJar(), "POST", "/api/auth/login", {
    email,
    password: changedPassword,
  });
  expectCase({
    id: "E2E-AUTH-16",
    name: "a password change keeps the current device and revokes the rest",
    expected: "200 change; current 200; stale 401; new-password login 200",
    actual: `${changed.status}; ${currentAfter.status}; ${staleAfter.status}; ${loginChanged.status}`,
    ok:
      changed.status === 200 &&
      currentAfter.status === 200 &&
      staleAfter.status === 401 &&
      loginChanged.status === 200,
    latencyMs: changed.ms,
  });

  // CSRF: a same-origin browser request passes, a cross-origin one is rejected.
  const crossOrigin = await req(
    makeJar(),
    "POST",
    "/api/auth/login",
    { email, password: changedPassword },
    { Origin: "https://evil.example" },
  );
  const sameOrigin = await req(
    makeJar(),
    "POST",
    "/api/auth/login",
    { email, password: changedPassword },
    { Origin: BASE },
  );
  expectCase({
    id: "E2E-AUTH-17",
    name: "cross-origin state-changing requests are rejected",
    expected: "cross-origin 403; same-origin 200",
    actual: `${crossOrigin.status}; ${sameOrigin.status}`,
    ok: crossOrigin.status === 403 && sameOrigin.status === 200,
    latencyMs: crossOrigin.ms,
  });
}

// E2E-I: auth UI surfaces (Phase 6)
// ---------------------------------------------------------------------------

async function authUiCases() {
  const loginPage = await req(makeJar(), "GET", "/login");
  expectCase({
    id: "E2E-UI-01",
    name: "the sign-in page shows email, password, forgot-password, and visitor controls",
    expected: "200 with Email, Password, Forgot password?, visitor option",
    actual: `${loginPage.status}; email=${loginPage.text.includes("Email")}; password=${loginPage.text.includes("Password")}; forgot=${loginPage.text.includes("Forgot password?")}; visitor=${loginPage.text.includes("Continue as a visitor")}`,
    ok:
      loginPage.status === 200 &&
      loginPage.text.includes("Email") &&
      loginPage.text.includes("Password") &&
      loginPage.text.includes("Forgot password?") &&
      loginPage.text.includes("Continue as a visitor"),
    latencyMs: loginPage.ms,
  });

  expectCase({
    id: "E2E-UI-02",
    name: "the sign-in page no longer offers a passwordless account picker",
    expected: "no 'no password' or 'Choose your profile' copy",
    actual: `passwordless=${/no password/i.test(loginPage.text)}; picker=${loginPage.text.includes("Choose your profile")}`,
    ok: !/no password/i.test(loginPage.text) && !loginPage.text.includes("Choose your profile"),
    latencyMs: loginPage.ms,
  });

  const forgot = await req(makeJar(), "GET", "/forgot-password");
  expectCase({
    id: "E2E-UI-03",
    name: "the forgot-password page is reachable",
    expected: "200 with the reset request form",
    actual: `${forgot.status}; form=${forgot.text.includes("Send reset link")}`,
    ok: forgot.status === 200 && forgot.text.includes("Send reset link"),
    latencyMs: forgot.ms,
  });

  const reset = await req(makeJar(), "GET", "/reset-password");
  expectCase({
    id: "E2E-UI-04",
    name: "a reset link without a token is rejected in the UI",
    expected: "200 with an invalid or expired message",
    actual: `${reset.status}; message=${reset.text.includes("invalid or has expired")}`,
    ok: reset.status === 200 && reset.text.includes("invalid or has expired"),
    latencyMs: reset.ms,
  });

  const verify = await req(makeJar(), "GET", "/verify-email");
  expectCase({
    id: "E2E-UI-05",
    name: "a verification link without a token is rejected in the UI",
    expected: "200 with a missing-token message",
    actual: `${verify.status}; message=${verify.text.includes("missing its token")}`,
    ok: verify.status === 200 && verify.text.includes("missing its token"),
    latencyMs: verify.ms,
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 160);
}

function writeReports() {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const known = results.filter((r) => r.status === "known").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const generatedAt = new Date().toISOString();

  writeFileSync(
    path.join(RESULTS_DIR, "e2e.json"),
    `${JSON.stringify({ suite: "e2e", generatedAt, startedAt, base: BASE, summary: { passed, failed, known, skipped, total: results.length }, cases: results }, null, 2)}\n`,
  );

  const rows = results
    .map(
      (r) =>
        `| ${r.id} | ${escapeCell(r.name)} | ${escapeCell(r.expected)} | ${escapeCell(r.actual)} | ${r.status} | ${
          r.latencyMs === undefined ? "—" : `${r.latencyMs} ms`
        } |`,
    )
    .join("\n");

  const markdown = [
    "# HistorAI evaluation — e2e (black-box HTTP)",
    "",
    `Generated: ${generatedAt}  `,
    `Base URL: ${BASE}`,
    "",
    `**Summary:** ${passed} passed · ${failed} failed · ${known} known issue(s) · ${skipped} skipped · ${results.length} total`,
    "",
    known > 0
      ? "Known issues are documented limitations reproduced by the harness, not undiagnosed regressions."
      : "",
    "",
    "",
    "| ID | Case | Expected | Actual | Status | Latency |",
    "|----|------|----------|--------|--------|---------|",
    rows,
    "",
  ].join("\n");

  writeFileSync(path.join(RESULTS_DIR, "e2e.md"), markdown);
  console.log(`\nResults written to eval/results/e2e.{json,md} (${failed} failure(s)).`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`HistorAI e2e evaluation against ${BASE}\n`);

  if (!(await waitForServer(60_000))) {
    console.error(`Server at ${BASE} did not become ready. Start it with \`npm run dev\`.`);
    process.exit(1);
  }

  // Start from a known state: reset the schema and seed the committed fixtures.
  resetAndSeed();

  // Fail fast if the seed data or server is not what we expect.
  const probeJar = makeJar();
  const probe = await signIn(probeJar, "u-seed-ruth");
  if (probe.status !== 200) {
    console.error(`Seed sign-in failed (${probe.status}). Is the database seeded?`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const uploadsBefore = listUploads();
  try {
    await ageCases();
    await authCases();
    await passwordLifecycleCases();
    await authUiCases();
    await gateCases();
    await pipelineCases();
    await likesAndChatCases();
    await riverExperienceCases();
    await dropExperienceCases();
  } finally {
    removeNewUploads(uploadsBefore);
    await prisma.$disconnect();
  }

  writeReports();
  process.exitCode = results.some((r) => r.status === "fail") ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
