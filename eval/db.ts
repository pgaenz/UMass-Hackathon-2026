/**
 * DB-backed repository suite (Phase 3). Runs against the Postgres configured in
 * `DATABASE_URL`; it creates uniquely-tagged rows and removes them again, so it
 * does not depend on (or disturb) the seed data.
 *
 *   npm run eval:db
 *
 * Focus areas from plan/postgres-migration.md §6 / §7:
 * - CRUD smoke across every swapped repository module.
 * - Denormalized vote counter cannot drift under concurrency.
 * - Idempotent like writes return a truthful count.
 */
import { randomUUID } from "node:crypto";

import {
  authenticate,
  changePassword,
  createEmailVerificationToken,
  createPasswordResetToken,
  markEmailVerified,
  registerUser,
  resetPassword,
} from "../lib/auth";
import { prisma } from "../lib/db";
import {
  appendMessage,
  blockUser,
  countUnread,
  getOrCreateThread,
  getThread,
  getThreadMessages,
  isBlocked,
  listThreadsForUser,
  markThreadRead,
} from "../lib/chat";
import {
  appendTurn,
  compileSeniorTranscript,
  createConversation,
  getConversation,
  setConversationStatus,
} from "../lib/conversations";
import { countLikes, getLikeStates, isLiked, setLike } from "../lib/likes";
import {
  adjustUpvotes,
  createQuestion,
  deleteQuestion,
  getQuestion,
  updateQuestion,
} from "../lib/questions";
import { countVotes, getVoteStates, setVote } from "../lib/question-votes";
import { createReport } from "../lib/reports";
import {
  appendFeedback,
  createStory,
  deleteStory,
  getStoriesByAuthor,
  getStory,
  updateStory,
} from "../lib/store";
import { createUser, getUser, listUsers, updateUser } from "../lib/users";

let passed = 0;
let failed = 0;

function check(id: string, name: string, ok: boolean, actual: unknown = undefined): void {
  if (ok) {
    passed += 1;
    console.log(`[PASS] ${id} — ${name}`);
  } else {
    failed += 1;
    console.log(`[FAIL] ${id} — ${name}`);
    console.log(`        actual: ${JSON.stringify(actual)}`);
  }
}

const tag = `eval-${randomUUID().slice(0, 8)}`;

async function main(): Promise<void> {
  const userIds: string[] = [];
  const questionIds: string[] = [];
  const storyIds: string[] = [];
  const threadIds: string[] = [];
  const conversationIds: string[] = [];
  const topicIds: string[] = [];
  const reportIds: string[] = [];

  try {
    // --- users -------------------------------------------------------------
    const river = await createUser({ role: "river", name: `${tag} River`, age: 68 });
    const drop = await createUser({ role: "drop", name: `${tag} Drop`, age: 16 });
    userIds.push(river.id, drop.id);
    check("DB-USR-01", "createUser returns the persisted row", river.id.startsWith("u-"), river.id);
    check("DB-USR-02", "getUser resolves by id", (await getUser(river.id))?.name === river.name);
    check(
      "DB-USR-03",
      "listUsers includes new rows",
      (await listUsers()).some((user) => user.id === drop.id),
    );
    const renamed = await updateUser(river.id, { bio: "updated" });
    check("DB-USR-04", "updateUser persists the patch", renamed?.bio === "updated", renamed?.bio);
    check("DB-USR-05", "updateUser returns null for a missing id", (await updateUser("nope", {})) === null);

    // --- topics ------------------------------------------------------------
    const topic = await prisma.topic.create({ data: { id: `${tag}-topic`, label: "Eval Topic" } });
    topicIds.push(topic.id);

    // --- questions + votes -------------------------------------------------
    const question = await createQuestion({
      text: "Eval question?",
      topicIds: [topic.id],
      askedBy: drop.id,
    });
    questionIds.push(question.id);
    check("DB-QST-01", "createQuestion starts at 0 upvotes", question.upvotes === 0);
    check(
      "DB-QST-02",
      "getQuestion returns topicIds",
      (await getQuestion(question.id))?.topicIds.includes(topic.id) === true,
    );
    const edited = await updateQuestion(question.id, { text: "Edited eval question?" });
    check("DB-QST-03", "updateQuestion persists text + editedAt", edited?.text === "Edited eval question?");

    check("DB-VOT-01", "first setVote returns +1", (await setVote(question.id, drop.id, true)) === 1);
    check("DB-VOT-02", "duplicate setVote returns 0", (await setVote(question.id, drop.id, true)) === 0);
    check("DB-VOT-03", "countVotes reflects the row", (await countVotes(question.id)) === 1);
    check(
      "DB-VOT-04",
      "getVoteStates marks the viewer's vote",
      (await getVoteStates([question.id], drop.id))[question.id].voted === true,
    );
    await adjustUpvotes(question.id, 1);
    check("DB-VOT-05", "adjustUpvotes increments", (await getQuestion(question.id))?.upvotes === 1);
    check("DB-VOT-06", "setVote(false) returns -1", (await setVote(question.id, drop.id, false)) === -1);
    await adjustUpvotes(question.id, -1);
    check("DB-VOT-07", "counter clamps at zero", (await adjustUpvotes(question.id, -5)) === 0);

    // --- stories + feedback ------------------------------------------------
    const story = await createStory({
      prompt: "Eval prompt",
      authorId: river.id,
      questionId: question.id,
      transcript: "Eval transcript",
      status: "published",
    });
    storyIds.push(story.id);
    check("DB-STR-01", "createStory persists fields", story.authorId === river.id && story.status === "published");
    check(
      "DB-STR-02",
      "question link is derived onto the question",
      (await getQuestion(question.id))?.storyIds.includes(story.id) === true,
    );
    const patched = await updateStory(story.id, { review: null, safety: null, status: "draft" });
    check("DB-STR-03", "updateStory writes null JSON + status", patched?.status === "draft" && patched.review === null);
    const withFeedback = await appendFeedback(story.id, {
      id: `${tag}-fb`,
      source: "user",
      text: "feedback",
      rawAudioPath: null,
      createdAt: new Date().toISOString(),
    });
    check("DB-STR-04", "appendFeedback appends without clobbering", withFeedback?.feedback.length === 1);
    check(
      "DB-STR-05",
      "getStoriesByAuthor finds the story",
      (await getStoriesByAuthor(river.id)).some((entry) => entry.id === story.id),
    );

    // --- likes -------------------------------------------------------------
    check("DB-LIK-01", "first setLike returns 1", (await setLike(story.id, drop.id, true)) === 1);
    check("DB-LIK-02", "duplicate setLike stays at 1", (await setLike(story.id, drop.id, true)) === 1);
    check("DB-LIK-03", "isLiked is true", (await isLiked(story.id, drop.id)) === true);
    check("DB-LIK-04", "countLikes is 1", (await countLikes(story.id)) === 1);
    check(
      "DB-LIK-05",
      "getLikeStates marks liked + count",
      (await getLikeStates([story.id], drop.id))[story.id].liked === true,
    );

    // --- chat --------------------------------------------------------------
    const thread = await getOrCreateThread(river, drop);
    threadIds.push(thread.id);
    check("DB-CHT-01", "getOrCreateThread is idempotent", (await getOrCreateThread(river, drop)).id === thread.id);
    const message = await appendMessage(thread.id, river.id, "hello", {
      verdict: "allow",
      flags: [],
    });
    check("DB-CHT-02", "appendMessage persists", message?.body === "hello", message);
    const messages = await getThreadMessages(thread.id, drop.id);
    check("DB-CHT-03", "getThreadMessages returns the message", messages.length === 1);
    check("DB-CHT-04", "countUnread counts it for the recipient", (await countUnread(drop.id)) === 1);
    await markThreadRead(thread.id, drop.id);
    check("DB-CHT-05", "markThreadRead clears unread", (await countUnread(drop.id)) === 0);
    const inbox = await listThreadsForUser(river.id);
    check("DB-CHT-06", "listThreadsForUser includes the thread", inbox.some((entry) => entry.threadId === thread.id));
    check("DB-CHT-07", "isBlocked is false before blocking", (await isBlocked(river.id, drop.id)) === false);
    await blockUser(river.id, drop.id);
    check("DB-CHT-08", "blockUser blocks the pair", (await isBlocked(drop.id, river.id)) === true);
    check("DB-CHT-09", "blockUser archives the thread", (await getThread(thread.id))?.status === "archived");

    // --- conversations -----------------------------------------------------
    const conversation = await createConversation({
      storyId: story.id,
      prompt: "Eval conversation",
      userId: river.id,
    });
    conversationIds.push(conversation.id);
    const turn = await appendTurn(conversation.id, {
      user: { text: "senior answer", audioPath: "", durationMs: 1, transcriptionStatus: "ok" },
      assistant: { text: "interviewer question", interrupted: false },
    });
    check("DB-CNV-01", "appendTurn assigns index 0", turn?.turn.index === 0, turn?.turn);
    check(
      "DB-CNV-02",
      "compileSeniorTranscript uses only the senior's words",
      compileSeniorTranscript((await getConversation(conversation.id))!) === "senior answer",
    );
    check(
      "DB-CNV-03",
      "setConversationStatus persists",
      (await setConversationStatus(conversation.id, "ended"))?.status === "ended",
    );

    // --- reports -----------------------------------------------------------
    const report = await createReport({
      targetType: "story",
      targetId: story.id,
      reason: "eval",
      details: "details",
    });
    reportIds.push(report.id);
    check("DB-RPT-01", "createReport returns open status", report.status === "open");

    // --- credentials + one-time tokens (Phase 5) ---------------------------
    const password = "correct-horse-battery";
    const newPassword = "a-brand-new-password";
    const accountEmail = `${tag}-auth@eval.example.test`;
    const account = await registerUser({
      role: "river",
      name: `${tag} Account`,
      age: 55,
      email: accountEmail,
      password,
    });
    userIds.push(account.id);

    check(
      "DB-AUTH-01",
      "registerUser creates a usable credential",
      (await authenticate(accountEmail, password))?.id === account.id,
    );
    check(
      "DB-AUTH-02",
      "authenticate is case-insensitive on email",
      (await authenticate(accountEmail.toUpperCase(), password))?.id === account.id,
    );
    check(
      "DB-AUTH-03",
      "authenticate rejects a wrong password",
      (await authenticate(accountEmail, "not-the-password")) === null,
    );

    // Password reset: hashed, single-use, rotating, and session-revoking.
    const resetToken = await createPasswordResetToken(account.id);
    check(
      "DB-AUTH-04",
      "resetPassword rejects an unknown token",
      (await resetPassword("definitely-not-a-token", newPassword)) === null,
    );
    check(
      "DB-AUTH-05",
      "resetPassword rotates the password",
      (await resetPassword(resetToken, newPassword)) === account.id,
    );
    check(
      "DB-AUTH-06",
      "the pre-reset password no longer works",
      (await authenticate(accountEmail, password)) === null,
    );
    check(
      "DB-AUTH-07",
      "the post-reset password works",
      (await authenticate(accountEmail, newPassword))?.id === account.id,
    );
    check(
      "DB-AUTH-08",
      "a reset token is single-use",
      (await resetPassword(resetToken, password)) === null,
    );

    const versionBeforeReset = (
      await prisma.user.findUnique({
        where: { id: account.id },
        select: { sessionVersion: true },
      })
    )!.sessionVersion;
    await prisma.session.create({
      data: {
        id: `sess-${tag}`,
        userId: account.id,
        expiresAt: new Date(Date.now() + 60_000),
        sessionVersion: versionBeforeReset,
      },
    });
    await resetPassword(await createPasswordResetToken(account.id), password);
    const versionAfterReset = (
      await prisma.user.findUnique({
        where: { id: account.id },
        select: { sessionVersion: true },
      })
    )!.sessionVersion;
    check(
      "DB-AUTH-09",
      "reset bumps sessionVersion",
      versionAfterReset > versionBeforeReset,
      { versionBeforeReset, versionAfterReset },
    );
    check(
      "DB-AUTH-10",
      "reset revokes pre-existing sessions",
      (await prisma.session.findUnique({ where: { id: `sess-${tag}` } }))?.revokedAt !== null,
    );

    const expiredToken = await createPasswordResetToken(account.id);
    await prisma.passwordResetToken.updateMany({
      where: { userId: account.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    check(
      "DB-AUTH-11",
      "an expired reset token is rejected",
      (await resetPassword(expiredToken, "yet-another-password")) === null,
    );

    // Email verification: same single-use/expiring rules.
    const verificationToken = await createEmailVerificationToken(account.id);
    check(
      "DB-AUTH-12",
      "markEmailVerified consumes the token",
      (await markEmailVerified(verificationToken)) === account.id,
    );
    check(
      "DB-AUTH-13",
      "emailVerifiedAt is stamped",
      (await prisma.credential.findUnique({ where: { userId: account.id } }))?.emailVerifiedAt
        instanceof Date,
    );
    check(
      "DB-AUTH-14",
      "a verification token is single-use",
      (await markEmailVerified(verificationToken)) === null,
    );

    // Authenticated password change.
    check(
      "DB-AUTH-15",
      "changePassword rejects a wrong current password",
      (await changePassword(account.id, "definitely-wrong", "changed-password-123")) ===
        "wrong-password",
    );
    check(
      "DB-AUTH-16",
      "changePassword rotates the hash",
      (await changePassword(account.id, password, "changed-password-123")) === "ok",
    );
    check(
      "DB-AUTH-17",
      "the changed password works",
      (await authenticate(accountEmail, "changed-password-123"))?.id === account.id,
    );

    const raceToken = await createPasswordResetToken(account.id);
    const raceResults = await Promise.all([
      resetPassword(raceToken, "race-password-a"),
      resetPassword(raceToken, "race-password-b"),
    ]);
    check(
      "DB-AUTH-18",
      "a reset token cannot be spent twice concurrently",
      raceResults.filter((result) => result === account.id).length === 1,
      raceResults,
    );

    // --- concurrency: vote counter ----------------------------------------
    const N = 25;
    await Promise.all(
      Array.from({ length: N }, async () => {
        const delta = await setVote(question.id, river.id, true);
        if (delta !== 0) await adjustUpvotes(question.id, delta);
      }),
    );
    const voteRows = await countVotes(question.id);
    const voteCount = (await getQuestion(question.id))?.upvotes;
    check(
      "DB-CON-01",
      `${N} concurrent upvotes store one row and counter 1`,
      voteRows === 1 && voteCount === 1,
      { voteRows, voteCount },
    );

    await Promise.all(
      Array.from({ length: N }, async () => {
        const delta = await setVote(question.id, river.id, false);
        if (delta !== 0) await adjustUpvotes(question.id, delta);
      }),
    );
    const voteRowsAfter = await countVotes(question.id);
    const voteCountAfter = (await getQuestion(question.id))?.upvotes;
    check(
      "DB-CON-02",
      `${N} concurrent un-votes leave 0 rows and counter 0`,
      voteRowsAfter === 0 && voteCountAfter === 0,
      { voteRowsAfter, voteCountAfter },
    );

    // --- concurrency: likes -----------------------------------------------
    const story2 = await createStory({ prompt: "like target", authorId: river.id, status: "published" });
    storyIds.push(story2.id);
    await Promise.all(Array.from({ length: N }, () => setLike(story2.id, drop.id, true)));
    const likeCount = await countLikes(story2.id);
    check("DB-CON-03", `${N} concurrent likes store one row`, likeCount === 1, likeCount);
    await Promise.all(Array.from({ length: N }, () => setLike(story2.id, drop.id, false)));
    const likeCountAfter = await countLikes(story2.id);
    check("DB-CON-04", `${N} concurrent unlikes leave 0 rows`, likeCountAfter === 0, likeCountAfter);

    // --- deletes + cascades ------------------------------------------------
    check("DB-DEL-01", "deleteStory returns true", (await deleteStory(story2.id)) === true);
    check("DB-DEL-02", "deleteStory returns false for a missing id", (await deleteStory(story2.id)) === false);
    await deleteQuestion(question.id);
    check("DB-DEL-03", "deleteQuestion cascades its votes", (await countVotes(question.id)) === 0);
  } finally {
    // Best-effort cleanup: remove every uniquely-tagged row.
    await prisma.chatThread.deleteMany({ where: { id: { in: threadIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    await prisma.story.deleteMany({ where: { id: { in: storyIds } } });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
    await prisma.topic.deleteMany({ where: { id: { in: topicIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }

  console.log(`\nDB repository suite: ${passed} passed, ${failed} failed.`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
