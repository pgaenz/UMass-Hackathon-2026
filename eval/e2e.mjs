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
 * The `data/` files touched by the run are snapshotted before the first request
 * and restored afterwards, so repeated runs stay reproducible.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const DATA_DIR = path.join(ROOT, "data");
const RESULTS_DIR = path.join(ROOT, "eval", "results");
const SNAPSHOT_FILES = [
  "stories.json",
  "users.json",
  "likes.json",
  "chat.json",
  "question-votes.json",
  "questions.json",
];

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

async function req(jar, method, route, body) {
  const headers = { Cookie: jar.header() };
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
  return req(jar, "POST", "/api/auth/session", { userId });
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
// Data snapshot / restore
// ---------------------------------------------------------------------------

function readData(name) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8"));
}

function takeSnapshot() {
  const snapshot = {};
  for (const file of SNAPSHOT_FILES) {
    const full = path.join(DATA_DIR, file);
    snapshot[file] = existsSync(full) ? readFileSync(full, "utf8") : null;
  }
  return snapshot;
}

/** Temporarily rewrites a story's status on disk (restored by the snapshot). */
function patchStoryStatus(storyId, status) {
  const file = path.join(DATA_DIR, "stories.json");
  const data = JSON.parse(readFileSync(file, "utf8"));
  const story = data.stories.find((entry) => entry.id === storyId);
  if (story) {
    story.status = status;
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
}

function restoreSnapshot(snapshot) {
  for (const [file, content] of Object.entries(snapshot)) {
    const full = path.join(DATA_DIR, file);
    if (content === null) {
      if (existsSync(full)) {
        writeFileSync(full, "");
      }
    } else {
      writeFileSync(full, content);
    }
  }
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
    const res = await req(jar, "POST", "/api/auth/login", testCase.body);
    expectCase({
      id: testCase.id,
      name: `POST /api/auth/login rejects ${JSON.stringify(testCase.body)}`,
      expected: "400 (invalid profile)",
      actual: `${res.status} ${res.json?.error ?? ""}`.trim(),
      ok: res.status === 400,
      latencyMs: res.ms,
    });
  }

  const valid = await req(jar, "POST", "/api/auth/login", {
    role: "drop",
    name: "Alice Johnson",
    age: 13,
  });
  const user = valid.json?.user;
  const leaksAge = user ? "age" in user : true;
  const ok = valid.status === 201 && user?.ageBand === "13-17" && !leaksAge;
  expectCase({
    id: "E2E-AGE-07",
    name: "POST /api/auth/login accepts age 13 and returns only the age band",
    expected: "201, ageBand 13-17, no `age` field",
    actual: `${valid.status}, ageBand=${user?.ageBand ?? "—"}${leaksAge ? ", LEAKED age" : ""}`,
    ok,
    latencyMs: valid.ms,
  });

  // Known limitation: the name safety gate rejects any display name containing
  // the word "Drop", which is the product's own term for young users. The model
  // gives inconsistent reasons ("harmful reference" / "dangerous behavior" /
  // "inappropriate") and there is no human-review path for a rejected name.
  const dropName = await req(jar, "POST", "/api/auth/login", {
    role: "drop",
    name: "Drop Test",
    age: 25,
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
    // to `reviewed` on disk so the gate can be tested deterministically; the
    // snapshot restores the original file at the end of the run.
    patchStoryStatus(flagged.id, "reviewed");
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
    writeFileSync(path.join(process.env.E2E_DUMP_DIR, "data-at-before.json"), readFileSync(path.join(DATA_DIR, "stories.json"), "utf8"));
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

  // Fail fast if the seed data or server is not what we expect.
  const probeJar = makeJar();
  const probe = await signIn(probeJar, "u-seed-ruth");
  if (probe.status !== 200) {
    console.error(`Seed sign-in failed (${probe.status}). Is data/users.json intact?`);
    process.exit(1);
  }

  const snapshot = takeSnapshot();
  try {
    await ageCases();
    await gateCases();
    await pipelineCases();
    await likesAndChatCases();
  } finally {
    restoreSnapshot(snapshot);
  }

  writeReports();
  process.exitCode = results.some((r) => r.status === "fail") ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
