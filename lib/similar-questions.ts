import type { Question } from "./types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "did", "do",
  "does", "for", "from", "had", "has", "have", "how", "i", "if", "in", "is",
  "it", "me", "my", "of", "on", "or", "so", "that", "the", "their", "them",
  "then", "there", "they", "this", "to", "was", "we", "were", "what", "when",
  "where", "which", "who", "why", "will", "with", "would", "you", "your",
]);

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .map((word) => word.replace(/'s$/, ""))
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
  );
}

export interface SimilarQuestion {
  question: Question;
  score: number;
}

/** Up to `limit` questions ranked by simple keyword overlap. Never blocks posting. */
export function findSimilarQuestions(
  text: string,
  questions: Question[],
  limit = 3,
): SimilarQuestion[] {
  if (text.trim().length < 15) return [];
  const wanted = words(text);
  if (wanted.size === 0) return [];

  const scored: SimilarQuestion[] = [];
  for (const question of questions) {
    const candidate = words(question.text);
    let overlap = 0;
    for (const word of wanted) {
      if (candidate.has(word)) overlap += 1;
    }
    if (overlap === 0) continue;
    // Normalise so a short question is not favoured only for being short.
    const score = overlap / Math.sqrt(wanted.size * Math.max(candidate.size, 1));
    scored.push({ question, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.question.upvotes - a.question.upvotes ||
        a.question.text.localeCompare(b.question.text),
    )
    .slice(0, limit);
}
