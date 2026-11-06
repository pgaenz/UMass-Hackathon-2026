import { getPublishedStories } from "./answers";
import { getArticleTitle, publicDisplayName, truncate } from "./format";
import { getQuestions, getTopics } from "./questions";
import { listUsers, toPublicUser } from "./users";

export type SearchKind = "question" | "story" | "user";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string;
  href: string;
  /** False when D2 says the name must not link to a profile (Drop under 18). */
  linkable?: boolean;
}

const MIN_QUERY = 2;
const MAX_RESULTS = 40;
const SNIPPET_MAX = 140;

function normalize(value: string): string {
  return value.toLowerCase();
}

/** 0 = no match, up to 4 for an exact match. */
function matchScore(haystack: string, query: string): number {
  if (!haystack) return 0;
  const text = normalize(haystack);
  if (text === query) return 4;
  if (text.startsWith(query)) return 3;
  if (text.includes(query)) return 2;
  return 0;
}

function cleanSnippet(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[#*_>`]/g, "").trim();
}

/**
 * Lightweight substring search over the file store (see plan/UX-FIXES-2.md §4).
 * No index, no fuzzy matching: questions + published stories + public profiles.
 */
export async function search(rawQuery: string, limit = MAX_RESULTS): Promise<SearchResult[]> {
  const query = normalize(rawQuery.trim());
  if (query.length < MIN_QUERY) return [];

  const [questions, topics, stories, users] = await Promise.all([
    getQuestions(),
    getTopics(),
    getPublishedStories(),
    listUsers(),
  ]);

  const topicLabel = new Map(topics.map((topic) => [topic.id, topic.label]));
  const userName = new Map(users.map((user) => [user.id, user.name]));
  const scored: Array<{ result: SearchResult; score: number }> = [];

  for (const question of questions) {
    const labels = question.topicIds.map((id) => topicLabel.get(id) ?? id);
    const asker = question.askedBy ? userName.get(question.askedBy) ?? "" : "";
    const score =
      matchScore(question.text, query) * 2 +
      Math.max(0, matchScore(asker, query), ...labels.map((label) => matchScore(label, query)));
    if (score > 0) {
      scored.push({
        result: {
          kind: "question",
          id: question.id,
          title: question.text,
          snippet: labels.length > 0 ? labels.join(" · ") : "Question",
          href: `/questions/${question.id}`,
        },
        score,
      });
    }
  }

  for (const story of stories) {
    const title = getArticleTitle(story.article) || story.prompt || "Untitled story";
    const summary = story.metadata?.summary ?? "";
    const author = story.authorId ? userName.get(story.authorId) ?? "" : "";
    const score =
      matchScore(title, query) * 2 +
      Math.max(
        0,
        matchScore(summary, query),
        matchScore(story.metadata?.topic ?? "", query),
        matchScore(author, query),
        matchScore(story.article, query),
      );
    if (score > 0) {
      scored.push({
        result: {
          kind: "story",
          id: story.id,
          title,
          snippet: truncate(cleanSnippet(summary || story.article), SNIPPET_MAX),
          href: `/youth/${story.id}`,
        },
        score,
      });
    }
  }

  for (const user of users) {
    const profile = toPublicUser(user);
    const displayName =
      profile.role === "drop" ? publicDisplayName(profile) : profile.name;
    const interests = profile.interests.map((id) => topicLabel.get(id) ?? id);
    const score =
      matchScore(profile.name, query) * 2 +
      Math.max(
        0,
        matchScore(profile.bio, query),
        ...interests.map((interest) => matchScore(interest, query)),
      );
    if (score > 0) {
      scored.push({
        result: {
          kind: "user",
          id: profile.id,
          title: displayName,
          snippet:
            profile.bio ||
            `${profile.role === "river" ? "River" : "Drop"} · ${profile.ageBand}`,
          href: `/profile/${profile.id}`,
          linkable: !(profile.role === "drop" && profile.ageBand === "13-17"),
        },
        score,
      });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title),
  );
  return scored.slice(0, limit).map((entry) => entry.result);
}
