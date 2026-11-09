/**
 * Test/dev only: load the committed JSON fixtures into PostgreSQL and give the
 * seeded users a deterministic credential so the e2e harness can sign in as them.
 *
 *   npm run db:seed:test
 *
 * This replaced the one-time production importer (`scripts/import-json.ts`) and
 * the standalone credential seeder. After the Phase 8 cutover the JSON store is
 * no longer part of the running system; the fixtures live under `eval/fixtures/`
 * and exist solely so tests (and local development) start from known content.
 *
 * Design notes:
 * - Refuses to run when NODE_ENV=production.
 * - Every row is upserted by its original JSON id, so re-running creates no
 *   duplicates.
 * - Foreign keys are validated before writing. Orphan `askedBy`, `authorId`,
 *   `questionId`, `storyId`, and user references are nulled or skipped and
 *   listed in the report; unknown topic ids are dropped and reported.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/db";
import type {
  ChatBlock,
  ChatThread,
  Conversation,
  Question,
  QuestionVote,
  Story,
  StoryLike,
  Topic,
  User,
} from "../lib/types";

// ---------------------------------------------------------------------------
// Source file shapes
// ---------------------------------------------------------------------------

interface UsersFile {
  users: User[];
}
interface StoriesFile {
  stories: Story[];
}
interface QuestionsFile {
  topics: Topic[];
  questions: Question[];
}
interface VotesFile {
  votes: QuestionVote[];
}
interface LikesFile {
  likes: StoryLike[];
}
interface ConversationsFile {
  conversations: Conversation[];
}
interface ChatFile {
  threads: ChatThread[];
  blocks: ChatBlock[];
}

interface Counts {
  table: string;
  source: number;
  inserted: number;
  updated: number;
  skipped: number;
}

const FIXTURES_DIR = path.join(process.cwd(), "eval", "fixtures");
const SEED_EMAIL_DOMAIN = "seed.historai.test";

/** Reads and parses a fixture, falling back to the empty-store default. */
async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

function readFile<T>(file: string, fallback: T): Promise<T> {
  return readJson<T>(path.join(FIXTURES_DIR, file), fallback);
}

/** `null`/`undefined` become a SQL NULL; anything else is stored as JSON. */
function jsonOrDbNull(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

/** Sorts a two-id pair and joins it the way `lib/chat.ts` does. */
function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join("|");
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed test data while NODE_ENV=production.");
  }

  // --- 1. Read the source files (fallbacks match the empty-store defaults) ---
  const [usersFile, storiesFile, questionsFile, votesFile, likesFile, conversationsFile, chatFile] =
    await Promise.all([
      readFile<UsersFile>("users.json", { users: [] }),
      readFile<StoriesFile>("stories.json", { stories: [] }),
      readFile<QuestionsFile>("questions.json", { topics: [], questions: [] }),
      readFile<VotesFile>("question-votes.json", { votes: [] }),
      readFile<LikesFile>("likes.json", { likes: [] }),
      readFile<ConversationsFile>("conversations.json", { conversations: [] }),
      readFile<ChatFile>("chat.json", { threads: [], blocks: [] }),
    ]);

  const users = usersFile.users;
  const stories = storiesFile.stories;
  const topics = questionsFile.topics;
  const questions = questionsFile.questions;
  const conversations = conversationsFile.conversations;
  const threads = chatFile.threads;
  // Flatten messages while remembering their parent thread id.
  const rawMessages = threads.flatMap((thread) =>
    (thread.messages ?? []).map((message) => ({ threadId: thread.id, message })),
  );

  // --- 2. Snapshot the current database so insert/update counts are exact ---
  const existing = {
    topics: new Set((await prisma.topic.findMany({ select: { id: true } })).map((r) => r.id)),
    users: new Set((await prisma.user.findMany({ select: { id: true } })).map((r) => r.id)),
    questions: new Set(
      (await prisma.question.findMany({ select: { id: true } })).map((r) => r.id),
    ),
    stories: new Set((await prisma.story.findMany({ select: { id: true } })).map((r) => r.id)),
    conversations: new Set(
      (await prisma.conversation.findMany({ select: { id: true } })).map((r) => r.id),
    ),
    threads: new Set(
      (await prisma.chatThread.findMany({ select: { id: true } })).map((r) => r.id),
    ),
    messages: new Set(
      (await prisma.chatMessage.findMany({ select: { id: true } })).map((r) => r.id),
    ),
    voteKeys: new Set(
      (
        await prisma.questionVote.findMany({
          select: { questionId: true, userId: true },
        })
      ).map((r) => `${r.questionId}|${r.userId}`),
    ),
    likeKeys: new Set(
      (await prisma.storyLike.findMany({ select: { storyId: true, userId: true } })).map(
        (r) => `${r.storyId}|${r.userId}`,
      ),
    ),
    blockKeys: new Set(
      (
        await prisma.chatBlock.findMany({ select: { blockerId: true, blockedId: true } })
      ).map((r) => `${r.blockerId}|${r.blockedId}`),
    ),
  };

  const topicIds = new Set(topics.map((topic) => topic.id));
  const userIds = new Set(users.map((user) => user.id));
  const questionIds = new Set(questions.map((question) => question.id));
  const storyIds = new Set(stories.map((story) => story.id));
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));

  const orphans: string[] = [];
  const note = (message: string) => orphans.push(message);

  // --- 3. Filter + resolve references, recording every orphan explicitly ---
  const summary: Counts[] = [];
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  // Topics (source of truth for Question.topicIds / User.interests).
  for (const topic of topics) {
    ops.push(
      prisma.topic.upsert({
        where: { id: topic.id },
        create: { id: topic.id, label: topic.label },
        update: { label: topic.label },
      }),
    );
  }
  summary.push({
    table: "Topic",
    source: topics.length,
    inserted: topics.filter((topic) => !existing.topics.has(topic.id)).length,
    updated: topics.filter((topic) => existing.topics.has(topic.id)).length,
    skipped: 0,
  });

  // Users. Unknown interests are dropped and reported.
  for (const user of users) {
    const interests = (user.interests ?? []).filter((id) => topicIds.has(id));
    if (interests.length !== (user.interests ?? []).length) {
      note(`user ${user.id}: dropped unknown interest id(s)`);
    }
    const data = {
      role: user.role,
      name: user.name ?? "",
      age: user.age,
      bio: user.bio ?? "",
      interests,
      createdAt: user.createdAt,
    };
    ops.push(
      prisma.user.upsert({
        where: { id: user.id },
        create: { id: user.id, ...data },
        // Never touch sessionVersion here; auth owns it.
        update: data,
      }),
    );
  }
  summary.push({
    table: "User",
    source: users.length,
    inserted: users.filter((user) => !existing.users.has(user.id)).length,
    updated: users.filter((user) => existing.users.has(user.id)).length,
    skipped: 0,
  });

  // Questions. Orphan askedBy -> null.
  for (const question of questions) {
    let askedBy = question.askedBy ?? null;
    if (askedBy && !userIds.has(askedBy)) {
      note(`question ${question.id}: askedBy ${askedBy} missing -> null`);
      askedBy = null;
    }
    const topicIdsForRow = (question.topicIds ?? []).filter((id) => topicIds.has(id));
    if (topicIdsForRow.length !== (question.topicIds ?? []).length) {
      note(`question ${question.id}: dropped unknown topicId(s)`);
    }
    const data = {
      text: question.text,
      topicIds: topicIdsForRow,
      askedBy,
      upvotes: typeof question.upvotes === "number" ? question.upvotes : 0,
      createdAt: question.createdAt,
      editedAt: question.editedAt ?? null,
    };
    ops.push(
      prisma.question.upsert({
        where: { id: question.id },
        create: { id: question.id, ...data },
        update: data,
      }),
    );
  }
  summary.push({
    table: "Question",
    source: questions.length,
    inserted: questions.filter((question) => !existing.questions.has(question.id)).length,
    updated: questions.filter((question) => existing.questions.has(question.id)).length,
    skipped: 0,
  });

  // Stories. Orphan authorId / questionId -> null. `conversationId` is written
  // in a second pass below because it and `Conversation.storyId` form a cycle.
  const deferredConversationLinks: { storyId: string; conversationId: string }[] = [];
  for (const story of stories) {
    let authorId = story.authorId ?? null;
    if (authorId && !userIds.has(authorId)) {
      note(`story ${story.id}: authorId ${authorId} missing -> null`);
      authorId = null;
    }
    let questionId = story.questionId ?? null;
    if (questionId && !questionIds.has(questionId)) {
      note(`story ${story.id}: questionId ${questionId} missing -> null`);
      questionId = null;
    }
    if (story.conversationId) {
      if (conversationIds.has(story.conversationId)) {
        deferredConversationLinks.push({
          storyId: story.id,
          conversationId: story.conversationId,
        });
      } else {
        note(`story ${story.id}: conversationId ${story.conversationId} missing -> null`);
      }
    }
    const data = {
      prompt: story.prompt ?? "",
      questionId,
      authorId,
      inputType: story.inputType ?? "text",
      rawAudioPath: story.rawAudioPath ?? null,
      transcript: story.transcript ?? "",
      conversationContext: story.conversationContext ?? null,
      metadata: (story.metadata ?? { topic: "", summary: "" }) as unknown as Prisma.InputJsonValue,
      article: story.article ?? "",
      review: jsonOrDbNull(story.review),
      safety: jsonOrDbNull(story.safety),
      feedback: (story.feedback ?? []) as unknown as Prisma.InputJsonValue,
      groundingScore: story.groundingScore ?? 0,
      piiDetected: story.piiDetected ?? false,
      status: story.status ?? "draft",
      conversationId: null,
      createdAt: story.createdAt,
      publishedAt: story.publishedAt ?? null,
      riverEdited: story.riverEdited ?? false,
      checkedAt: story.checkedAt ?? null,
      checkError: story.checkError ?? null,
      writtenFromHash: story.writtenFromHash ?? null,
      previousArticle: story.previousArticle ?? null,
    };
    ops.push(
      prisma.story.upsert({
        where: { id: story.id },
        create: { id: story.id, ...data },
        update: data,
      }),
    );
  }
  summary.push({
    table: "Story",
    source: stories.length,
    inserted: stories.filter((story) => !existing.stories.has(story.id)).length,
    updated: stories.filter((story) => existing.stories.has(story.id)).length,
    skipped: 0,
  });

  // Conversations. Orphan userId / storyId -> null.
  for (const conversation of conversations) {
    let userId = conversation.userId ?? null;
    if (userId && !userIds.has(userId)) {
      note(`conversation ${conversation.id}: userId ${userId} missing -> null`);
      userId = null;
    }
    let storyId: string | null = conversation.storyId ?? null;
    if (storyId && !storyIds.has(storyId)) {
      note(`conversation ${conversation.id}: storyId ${storyId} missing -> null`);
      storyId = null;
    }
    const data = {
      storyId,
      prompt: conversation.prompt ?? "",
      questionId: conversation.questionId ?? null,
      userId,
      status: conversation.status ?? "active",
      turns: (conversation.turns ?? []) as unknown as Prisma.InputJsonValue,
      createdAt: conversation.createdAt,
    };
    ops.push(
      prisma.conversation.upsert({
        where: { id: conversation.id },
        create: { id: conversation.id, ...data },
        update: data,
      }),
    );
  }
  summary.push({
    table: "Conversation",
    source: conversations.length,
    inserted: conversations.filter((c) => !existing.conversations.has(c.id)).length,
    updated: conversations.filter((c) => existing.conversations.has(c.id)).length,
    skipped: 0,
  });

  // Second pass for the Story <-> Conversation cycle now that both exist.
  for (const link of deferredConversationLinks) {
    ops.push(
      prisma.story.update({
        where: { id: link.storyId },
        data: { conversationId: link.conversationId },
      }),
    );
  }

  // Question votes. Orphan question/user -> skip the row.
  const votes = votesFile.votes.filter((vote) => {
    if (!questionIds.has(vote.questionId)) {
      note(`question-vote ${vote.questionId}|${vote.userId}: question missing -> skipped`);
      return false;
    }
    if (!userIds.has(vote.userId)) {
      note(`question-vote ${vote.questionId}|${vote.userId}: user missing -> skipped`);
      return false;
    }
    return true;
  });
  if (votes.length > 0) {
    ops.push(
      prisma.questionVote.createMany({
        data: votes.map((vote) => ({
          questionId: vote.questionId,
          userId: vote.userId,
          createdAt: vote.createdAt,
        })),
        skipDuplicates: true,
      }),
    );
  }
  summary.push({
    table: "QuestionVote",
    source: votesFile.votes.length,
    inserted: votes.filter((v) => !existing.voteKeys.has(`${v.questionId}|${v.userId}`)).length,
    updated: 0,
    skipped:
      votesFile.votes.length -
      votes.filter((v) => !existing.voteKeys.has(`${v.questionId}|${v.userId}`)).length,
  });

  // Story likes. Orphan story/user -> skip the row.
  const likes = likesFile.likes.filter((like) => {
    if (!storyIds.has(like.storyId)) {
      note(`like ${like.storyId}|${like.userId}: story missing -> skipped`);
      return false;
    }
    if (!userIds.has(like.userId)) {
      note(`like ${like.storyId}|${like.userId}: user missing -> skipped`);
      return false;
    }
    return true;
  });
  if (likes.length > 0) {
    ops.push(
      prisma.storyLike.createMany({
        data: likes.map((like) => ({
          storyId: like.storyId,
          userId: like.userId,
          createdAt: like.createdAt,
        })),
        skipDuplicates: true,
      }),
    );
  }
  summary.push({
    table: "StoryLike",
    source: likesFile.likes.length,
    inserted: likes.filter((l) => !existing.likeKeys.has(`${l.storyId}|${l.userId}`)).length,
    updated: 0,
    skipped:
      likesFile.likes.length -
      likes.filter((l) => !existing.likeKeys.has(`${l.storyId}|${l.userId}`)).length,
  });

  // Chat threads. Skip missing participants or a duplicate pair.
  const importedThreadIds = new Set<string>();
  const seenPairs = new Set<string>();
  let skippedThreads = 0;
  for (const thread of threads) {
    const participants = [thread.participantIds?.[0] ?? "", thread.participantIds?.[1] ?? ""];
    const missing = participants.filter((id) => !id || !userIds.has(id));
    if (missing.length > 0) {
      note(`chat thread ${thread.id}: missing participant(s) ${missing.join(", ")} -> skipped`);
      skippedThreads += 1;
      continue;
    }
    const pairKey = pairKeyFor(participants[0], participants[1]);
    if (seenPairs.has(pairKey)) {
      note(`chat thread ${thread.id}: duplicate pairKey ${pairKey} -> skipped`);
      skippedThreads += 1;
      continue;
    }
    seenPairs.add(pairKey);
    importedThreadIds.add(thread.id);
    const data = {
      participantIds: [...participants].sort(),
      pairKey,
      status: thread.status ?? "active",
      createdAt: thread.createdAt,
      lastMessageAt: thread.lastMessageAt,
    };
    ops.push(
      prisma.chatThread.upsert({
        where: { id: thread.id },
        create: { id: thread.id, ...data },
        update: data,
      }),
    );
  }
  summary.push({
    table: "ChatThread",
    source: threads.length,
    inserted: threads.filter((t) => importedThreadIds.has(t.id) && !existing.threads.has(t.id)).length,
    updated: threads.filter((t) => importedThreadIds.has(t.id) && existing.threads.has(t.id)).length,
    skipped: skippedThreads,
  });

  // Chat messages. Orphans -> skipped.
  const messages = rawMessages.filter(({ threadId, message }) => {
    if (!importedThreadIds.has(threadId)) {
      note(`chat message ${message.id}: parent thread ${threadId} missing -> skipped`);
      return false;
    }
    if (!userIds.has(message.senderId)) {
      note(`chat message ${message.id}: sender ${message.senderId} missing -> skipped`);
      return false;
    }
    return true;
  });
  if (messages.length > 0) {
    ops.push(
      prisma.chatMessage.createMany({
        data: messages.map(({ threadId, message }) => ({
          id: message.id,
          threadId,
          senderId: message.senderId,
          kind: message.kind ?? "text",
          body: message.body ?? "",
          safety: (message.safety ?? { verdict: "allow", flags: [] }) as unknown as Prisma.InputJsonValue,
          readBy: message.readBy ?? [message.senderId],
          createdAt: message.createdAt,
          deletedAt: message.deletedAt ?? null,
        })),
        skipDuplicates: true,
      }),
    );
  }
  summary.push({
    table: "ChatMessage",
    source: rawMessages.length,
    inserted: messages.filter(({ message }) => !existing.messages.has(message.id)).length,
    updated: 0,
    skipped:
      rawMessages.length - messages.filter(({ message }) => !existing.messages.has(message.id)).length,
  });

  // Chat blocks. Orphan user -> skip.
  const blocks = chatFile.blocks.filter((block) => {
    if (!userIds.has(block.blockerId) || !userIds.has(block.blockedId)) {
      note(`chat block ${block.blockerId}|${block.blockedId}: user missing -> skipped`);
      return false;
    }
    return true;
  });
  if (blocks.length > 0) {
    ops.push(
      prisma.chatBlock.createMany({
        data: blocks.map((block) => ({
          blockerId: block.blockerId,
          blockedId: block.blockedId,
          createdAt: block.createdAt,
        })),
        skipDuplicates: true,
      }),
    );
  }
  summary.push({
    table: "ChatBlock",
    source: chatFile.blocks.length,
    inserted: blocks.filter(
      (b) => !existing.blockKeys.has(`${b.blockerId}|${b.blockedId}`),
    ).length,
    updated: 0,
    skipped:
      chatFile.blocks.length -
      blocks.filter((b) => !existing.blockKeys.has(`${b.blockerId}|${b.blockedId}`)).length,
  });

  // --- 4. Referential integrity report (before any write) ---
  console.log(`\nFixtures: ${FIXTURES_DIR}`);
  console.log("\nReferential integrity:");
  if (orphans.length === 0) {
    console.log("  no orphan references found");
  } else {
    for (const line of orphans) console.log(`  - ${line}`);
  }

  // --- 5. Summary table ---
  const width = (values: (string | number)[]) => Math.max(...values.map((v) => String(v).length));
  const headers = ["Table", "Source", "Inserted", "Updated", "Skipped"];
  const rows = summary.map((c) => [c.table, c.source, c.inserted, c.updated, c.skipped]);
  const widths = headers.map((header, i) => width([header, ...rows.map((row) => row[i])]));
  const line = (cells: (string | number)[]) =>
    cells.map((cell, i) => String(cell).padEnd(widths[i])).join("  ");
  console.log("\nSeed summary:");
  console.log(`  ${line(headers)}`);
  console.log(`  ${widths.map((w) => "-".repeat(w)).join("  ")}`);
  for (const row of rows) console.log(`  ${line(row)}`);

  // --- 6. Write everything in one transaction ---
  await prisma.$transaction(ops);

  // --- 7. Give seed users a deterministic test credential (dev/test only) ---
  const password = process.env.SEED_USER_PASSWORD || "historai-dev-password";
  const withoutCredential = await prisma.user.findMany({
    where: { credential: { is: null } },
    select: { id: true },
  });
  if (withoutCredential.length > 0) {
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(
      withoutCredential.map((user) =>
        prisma.credential.create({
          data: {
            userId: user.id,
            email: `${user.id}@${SEED_EMAIL_DOMAIN}`,
            passwordHash,
          },
        }),
      ),
    );
  }

  console.log("\nSeed complete.");
  console.log(
    `Credentials: ${withoutCredential.length} seed user(s) received the shared test password ` +
      `(SEED_USER_PASSWORD).`,
  );
}

main()
  .catch((error) => {
    console.error("\nSeeding failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
