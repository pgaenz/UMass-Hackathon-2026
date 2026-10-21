import { QuestionExplorer } from "@/components/question-explorer";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getQuestions, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import { getPublicUserMap } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [topics, questions, stories, user] = await Promise.all([
    getTopics(),
    getQuestions(),
    getPublishedStories(),
    getCurrentUser(),
  ]);
  const answerCounts = countAnswersByQuestion(stories);
  const authors = await getPublicUserMap(questions.map((question) => question.askedBy));

  return (
    <QuestionExplorer
      topics={topics}
      questions={questions}
      answerCounts={answerCounts}
      authors={authors}
      canAnswer={user?.role === "river"}
    />
  );
}
