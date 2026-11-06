import { DropHome } from "@/components/home/drop-home";
import { RiverHome } from "@/components/home/river-home";
import type { HomeData } from "@/components/home/shared";
import { VisitorHome } from "@/components/home/visitor-home";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getLikeStates } from "@/lib/likes";
import { getVoteStates } from "@/lib/question-votes";
import { getQuestionMap, getQuestions, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import { getAllStories } from "@/lib/store";
import { getPublicUserMap } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [topics, questions, stories, allStories, user] = await Promise.all([
    getTopics(),
    getQuestions(),
    getPublishedStories(),
    getAllStories(),
    getCurrentUser(),
  ]);

  const answerCounts = countAnswersByQuestion(stories);
  const [authors, voteStates, likeStates, questionMap] = await Promise.all([
    getPublicUserMap([
      ...questions.map((question) => question.askedBy),
      ...stories.map((story) => story.authorId),
    ]),
    getVoteStates(
      questions.map((question) => question.id),
      user?.id ?? null,
    ),
    getLikeStates(
      stories.map((story) => story.id),
      user?.id ?? null,
    ),
    getQuestionMap(stories.map((story) => story.questionId)),
  ]);

  const data: HomeData = {
    topics,
    questions,
    stories,
    allStories,
    answerCounts,
    authors,
    voteStates,
    likeStates,
    questionMap,
    signedIn: Boolean(user),
  };

  if (!user) {
    return <VisitorHome data={data} />;
  }
  if (user.role === "river") {
    return <RiverHome data={data} userName={user.name} />;
  }
  return <DropHome data={data} userName={user.name} userId={user.id} />;
}
