import { QuestionExplorer } from "@/components/question-explorer";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getQuestions, getTopics } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [topics, questions, stories] = await Promise.all([
    getTopics(),
    getQuestions(),
    getPublishedStories(),
  ]);
  const answerCounts = countAnswersByQuestion(stories);

  return <QuestionExplorer topics={topics} questions={questions} answerCounts={answerCounts} />;
}
