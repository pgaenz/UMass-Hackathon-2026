import { runArticleChecks } from "@/lib/checks";
import { authorize } from "@/lib/session";
import { requireOwnedStory } from "@/lib/story-access";
import { updateStory } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/stories/[id]/check — re-run checks on the current article. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const owned = await requireOwnedStory(id, auth.session.userId);
  if ("response" in owned) return owned.response;
  const story = owned.story;

  if (!story.article.trim()) {
    return Response.json(
      { error: "There is no story to check yet." },
      { status: 400 },
    );
  }

  try {
    const { safety, review } = await runArticleChecks({
      transcript: story.transcript,
      article: story.article,
    });
    const updated = await updateStory(id, {
      safety,
      review,
      groundingScore: review?.score ?? 0,
      checkedAt: new Date().toISOString(),
      checkError: null,
      status: review?.verdict === "pass" ? "reviewed" : "draft",
      updatedAt: new Date().toISOString(),
    });
    return Response.json({ story: updated ?? story });
  } catch {
    const updated = await updateStory(id, {
      checkError: "We could not check this version yet.",
      checkedAt: null,
    });
    return Response.json({ story: updated ?? story, checkError: true });
  }
}
