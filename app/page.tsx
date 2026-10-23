import { QuestionExplorer } from "@/components/question-explorer";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getVoteStates } from "@/lib/question-votes";
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
  const [authors, voteStates] = await Promise.all([
    getPublicUserMap(questions.map((question) => question.askedBy)),
    getVoteStates(
      questions.map((question) => question.id),
      user?.id ?? null,
    ),
  ]);

  return (
    <QuestionExplorer
      topics={topics}
      questions={questions}
      answerCounts={answerCounts}
      authors={authors}
      canAnswer={user?.role === "river"}
      voteStates={voteStates}
      signedIn={Boolean(user)}
    />
  );
}
