import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getQuestions, getTopics } from "@/lib/questions";
import { findSimilarQuestions } from "@/lib/similar-questions";
import { truncate } from "@/lib/format";

export const runtime = "nodejs";

// GET /api/questions/similar?text=… — public read, up to 3 matches (D6).
export async function GET(request: Request): Promise<Response> {
  const text = new URL(request.url).searchParams.get("text") ?? "";
  if (text.trim().length < 15) {
    return Response.json({ questions: [] });
  }

  const [questions, topics, stories] = await Promise.all([
    getQuestions(),
    getTopics(),
    getPublishedStories(),
  ]);
  const counts = countAnswersByQuestion(stories);
  const topicLabel = new Map(topics.map((topic) => [topic.id, topic.label]));

  const matches = findSimilarQuestions(text, questions, 3).map(({ question }) => ({
    id: question.id,
    text: truncate(question.text, 160),
    topics: question.topicIds
      .map((id) => topicLabel.get(id))
      .filter((label): label is string => Boolean(label)),
    answerCount: counts[question.id] ?? 0,
  }));

  // Never include askedBy or any other author information.
  return Response.json({ questions: matches });
}
