import { answerTopics, getPublishedStories } from "./answers";
import { firstName, getArticleTitle, toPlainText } from "./format";
import { getLikeStates } from "./likes";
import { chat } from "./openai";
import {
  PODCAST_WORDS_PER_MINUTE,
  type PodcastAuthor,
  type PodcastMinutes,
  type PodcastMode,
  type PodcastPlan,
  type PodcastSegment,
  type PodcastTopic,
} from "./podcast-types";
import { getQuestionMap, getTopics } from "./questions";
import { getPublicUserMap } from "./users";

export class PodcastError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PodcastError";
    this.status = status;
  }
}

interface Candidate {
  storyId: string;
  title: string;
  questionText: string | null;
  author: PodcastAuthor | null;
  topics: PodcastTopic[];
  storyText: string;
  wordCount: number;
  likes: number;
  createdAt: string;
  matchingTopics: number;
}

function countWords(text: string): number {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function roundMinutes(words: number): number {
  return Math.max(1, Math.round((words / PODCAST_WORDS_PER_MINUTE) * 2) / 2);
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
    throw new Error("Podcast host returned no JSON object");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackIntro(labels: string[], minutes: number, storyCount: number): string {
  const theme =
    labels.length > 0
      ? labels.join(", ")
      : "life, memory, and the lessons people carry with them";
  return `Welcome to HistorAI Podcasts. I'm your host, and this episode is a ${minutes}-minute listening journey through ${theme}. We have ${storyCount} real ${
    storyCount === 1 ? "story" : "stories"
  } from Rivers in the community. Take your time, settle in, and let these voices remind you that every life holds something worth passing on.`;
}

function fallbackLeadIn(candidate: Candidate): string {
  const author = candidate.author;
  const byline = author
    ? `${author.name}, a River in the HistorAI community`
    : "a member of the HistorAI community";
  const topicNote =
    candidate.topics.length > 0
      ? ` The story touches on ${candidate.topics.map((topic) => topic.label).join(" and ")}.`
      : "";
  const connect = author
    ? ` If you would like to connect with ${firstName(author.name)}, you can open ${
        firstName(author.name)
      }'s profile on HistorAI and send a private message after signing in.`
    : " You can find more stories from the community on the Read page.";
  return `Our next story is “${candidate.title},” shared by ${byline}.${topicNote} Listen closely to the details, the small choices, and the way the story stays with you.${connect}`;
}

function ensureConnection(leadIn: string, author: PodcastAuthor | null): string {
  if (author) {
    if (/\b(connect|profile|private message)\b/i.test(leadIn)) return leadIn;
    const name = firstName(author.name);
    return `${leadIn} If you would like to reach ${name}, open ${name}'s profile on HistorAI and send a private message after signing in.`;
  }
  if (/\b(read page|community)\b/i.test(leadIn)) return leadIn;
  return `${leadIn} You can find more stories from the HistorAI community on the Read page.`;
}

function fallbackReflection(candidate: Candidate): string {
  return `That was “${candidate.title}.” Stories like this one are not only about what happened; they are about what we choose to carry forward. What would you want a younger person to hear in ${
    candidate.author ? `${firstName(candidate.author.name)}'s story` : "this story"
  }? Take a moment with that question before we move on.`;
}

function fallbackOutro(): string {
  return "Thank you for listening with us. Every story here belongs to a real person who chose to share part of their life. If one of these voices stayed with you, visit HistorAI to read more, leave a like, or reach out through a River's profile. Until next time, keep listening and keep asking.";
}

function fallbackTitle(labels: string[]): string {
  return labels.length > 0
    ? `Stories of ${labels.slice(0, 3).join(", ")}`
    : "Stories Worth Passing On";
}

async function buildCandidates(
  topics: string[],
  mode: PodcastMode,
  minutes: PodcastMinutes,
  userId: string,
): Promise<{
  selected: Candidate[];
  interestLabels: string[];
  storyWordCount: number;
  targetWords: number;
}> {
  const [stories, allTopics] = await Promise.all([getPublishedStories(), getTopics()]);
  if (stories.length === 0) {
    throw new PodcastError(
      "There are no published stories yet. A podcast needs at least one reviewed story.",
      409,
    );
  }

  const topicById = new Map(allTopics.map((topic) => [topic.id, topic]));
  const selectedTopicIds = topics.filter((id) => topicById.has(id));
  if (mode === "interests" && selectedTopicIds.length === 0) {
    throw new PodcastError("Choose at least one interest, or choose Random.", 400);
  }

  const [questions, authors, likeStates] = await Promise.all([
    getQuestionMap(stories.map((story) => story.questionId)),
    getPublicUserMap(stories.map((story) => story.authorId)),
    getLikeStates(
      stories.map((story) => story.id),
      userId,
    ),
  ]);

  const candidates: Candidate[] = stories.map((story) => {
    const question = story.questionId ? questions[story.questionId] : null;
    const topicIds = answerTopics(story, question);
    const metadataTopic = allTopics.find(
      (topic) => topic.label.toLowerCase() === story.metadata.topic.toLowerCase(),
    );
    if (metadataTopic && !topicIds.includes(metadataTopic.id)) {
      topicIds.push(metadataTopic.id);
    }
    const storyTopics: PodcastTopic[] = topicIds
      .map((id) => topicById.get(id))
      .filter((topic): topic is PodcastTopic => Boolean(topic))
      .map((topic) => ({ id: topic.id, label: topic.label }));
    const author = story.authorId ? authors[story.authorId] : null;

    return {
      storyId: story.id,
      title: getArticleTitle(story.article) || story.metadata.topic || "A story from a River",
      questionText: question?.text ?? null,
      author: author
        ? {
            id: author.id,
            name: author.name,
            ageBand: author.ageBand,
            profileHref: `/profile/${author.id}`,
          }
        : null,
      topics: storyTopics,
      storyText: toPlainText(story.article),
      wordCount: countWords(toPlainText(story.article)),
      likes: likeStates[story.id]?.count ?? 0,
      createdAt: story.createdAt,
      matchingTopics: storyTopics.filter((topic) =>
        selectedTopicIds.includes(topic.id),
      ).length,
    };
  });

  const matching =
    mode === "random"
      ? candidates
      : candidates.filter((candidate) => candidate.matchingTopics > 0);

  if (matching.length === 0) {
    throw new PodcastError(
      "No published stories match those interests yet. Try another interest or choose Random.",
      409,
    );
  }

  if (mode === "random") {
    // Random should feel different each time, not just repeat the most-liked
    // stories. Shuffle the pool before filling the time budget.
    for (let index = matching.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [matching[index], matching[swap]] = [matching[swap], matching[index]];
    }
  } else {
    matching.sort(
      (a, b) =>
        b.matchingTopics - a.matchingTopics ||
        b.likes - a.likes ||
        b.createdAt.localeCompare(a.createdAt),
    );
  }

  const targetWords = minutes * PODCAST_WORDS_PER_MINUTE;
  const minimumHostWords = Math.max(250, Math.round(targetWords * 0.3));
  const storyBudget = Math.max(0, targetWords - minimumHostWords);

  const selected: Candidate[] = [];
  let storyWordCount = 0;
  for (const candidate of matching) {
    if (selected.length === 0) {
      selected.push(candidate);
      storyWordCount += candidate.wordCount;
      continue;
    }
    if (storyWordCount + candidate.wordCount > storyBudget) continue;
    selected.push(candidate);
    storyWordCount += candidate.wordCount;
  }

  const interestLabels =
    mode === "random"
      ? []
      : selectedTopicIds.map((id) => topicById.get(id)?.label ?? id);

  return { selected, interestLabels, storyWordCount, targetWords };
}

interface HostScript {
  title: string;
  summary: string;
  intro: string;
  segments: Array<{ storyId: string; leadIn: string; reflection: string }>;
  outro: string;
}

async function writeHostScript(
  selected: Candidate[],
  interestLabels: string[],
  minutes: PodcastMinutes,
  storyWordCount: number,
  targetWords: number,
): Promise<HostScript | null> {
  const hostWordTarget = Math.max(300, targetWords - storyWordCount);
  const perStoryWords = Math.max(
    60,
    Math.round((hostWordTarget * 0.72) / Math.max(1, selected.length)),
  );

  const prompt = `You are the warm, unhurried host of HistorAI Podcasts, a show where younger listeners hear real stories from older adults.

Write the spoken host narration for a ${minutes}-minute episode. The selected story texts will be read aloud separately; do not rewrite or summarize the full stories in your narration. Your job is to introduce the theme, introduce each River and their story, reflect briefly after each story, and close the episode.

Rules:
- Never invent facts about the storyteller or the events. Use only the supplied text and public author details.
- Mention the author's name in every segment introduction.
- In every segment introduction, tell listeners how to connect: they can open the author's profile on HistorAI and send a private message after signing in. Do not invent a URL.
- Keep the tone warm, reflective, and plain-spoken. No markdown, headings, bullet points, or sound-effect cues.
- The host narration across intro, all lead-ins and reflections, and outro should total roughly ${hostWordTarget} words. Each story's host portion should be roughly ${perStoryWords} words combined.
- Do not mention being an AI or a language model.

Stories:
${JSON.stringify(
  selected.map((candidate) => ({
    storyId: candidate.storyId,
    title: candidate.title,
    question: candidate.questionText,
    author: candidate.author
      ? {
          name: candidate.author.name,
          ageBand: candidate.author.ageBand,
        }
      : null,
    topics: candidate.topics.map((topic) => topic.label),
    storyText: candidate.storyText,
  })),
  null,
  2,
)}

Return only valid JSON with this exact shape:
{
  "title": "episode title",
  "summary": "one or two spoken-style sentences describing the episode",
  "intro": "host introduction",
  "segments": [
    { "storyId": "the exact id", "leadIn": "host introduction and connection invitation", "reflection": "host reflection after the story" }
  ],
  "outro": "host closing"
}`;

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You write natural, audio-ready podcast narration. You are faithful to the source material and return only JSON.",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.65, timeoutMs: 120_000, maxTokens: 9_000 },
    );
    const parsed = parseJsonObject(raw);
    const parsedSegments = Array.isArray(parsed.segments) ? parsed.segments : [];
    const segmentMap = new Map<string, { leadIn: string; reflection: string }>();
    for (const entry of parsedSegments) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const id = asString(record.storyId);
      if (!id) continue;
      segmentMap.set(id, {
        leadIn: asString(record.leadIn),
        reflection: asString(record.reflection),
      });
    }

    const title = asString(parsed.title);
    const summary = asString(parsed.summary);
    const intro = asString(parsed.intro);
    const outro = asString(parsed.outro);
    if (!title || !intro || segmentMap.size === 0) return null;

    return {
      title,
      summary,
      intro,
      segments: selected.map((candidate) => ({
        storyId: candidate.storyId,
        ...(segmentMap.get(candidate.storyId) ?? { leadIn: "", reflection: "" }),
      })),
      outro,
    };
  } catch {
    return null;
  }
}

export async function buildPodcastPlan(input: {
  topics: string[];
  mode: PodcastMode;
  minutes: PodcastMinutes;
  userId: string;
}): Promise<PodcastPlan> {
  const { selected, interestLabels, storyWordCount, targetWords } = await buildCandidates(
    input.topics,
    input.mode,
    input.minutes,
    input.userId,
  );

  const script = await writeHostScript(
    selected,
    interestLabels,
    input.minutes,
    storyWordCount,
    targetWords,
  );
  const defaultTitle = fallbackTitle(interestLabels);
  const title = script?.title || defaultTitle;
  const summary =
    script?.summary ||
    `A ${input.minutes}-minute collection of ${
      selected.length === 1 ? "a story" : `${selected.length} stories`
    } from Rivers in the HistorAI community.`;
  const intro =
    script?.intro ||
    fallbackIntro(interestLabels, input.minutes, selected.length);
  const outro = script?.outro || fallbackOutro();
  const scriptSegments = new Map(
    (script?.segments ?? []).map((segment) => [segment.storyId, segment]),
  );

  const segments: PodcastSegment[] = selected.map((candidate) => {
    const written = scriptSegments.get(candidate.storyId);
    return {
      storyId: candidate.storyId,
      title: candidate.title,
      questionText: candidate.questionText,
      author: candidate.author,
      topics: candidate.topics,
      storyText: candidate.storyText,
      storyMinutes: roundMinutes(candidate.wordCount),
      hostLeadIn: ensureConnection(
        written?.leadIn || fallbackLeadIn(candidate),
        candidate.author,
      ),
      hostReflection: written?.reflection || fallbackReflection(candidate),
    };
  });

  const hostWordCount = countWords(
    [intro, ...segments.flatMap((segment) => [segment.hostLeadIn, segment.hostReflection]), outro].join(" "),
  );
  const wordCount = storyWordCount + hostWordCount;

  return {
    title,
    summary,
    targetMinutes: input.minutes,
    estimatedMinutes: roundMinutes(wordCount),
    wordCount,
    storyWordCount,
    hostWordCount,
    aiGenerated: Boolean(script),
    mode: input.mode,
    interestLabels,
    intro,
    segments,
    outro,
  };
}
