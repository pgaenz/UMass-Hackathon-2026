import { runArticleChecks } from "@/lib/checks";
import { hashTranscript } from "@/lib/river-story-state";
import { authorize } from "@/lib/session";
import { requireOwnedStory } from "@/lib/story-access";
import { updateStory } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/stories/[id]/restore — swap back the one saved previous version (D3). */
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

  if (!story.previousArticle) {
    return Response.json(
      { error: "There is no previous version to restore." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  let updated = await updateStory(id, {
    article: story.previousArticle,
    previousArticle: story.article,
    riverEdited: true,
    review: null,
    safety: null,
    checkedAt: null,
    checkError: null,
    writtenFromHash: hashTranscript(story.transcript),
    status: story.status === "published" ? "draft" : story.status,
    publishedAt: story.status === "published" ? null : story.publishedAt,
    updatedAt: now,
  });
  if (!updated) return Response.json({ error: "Unknown story" }, { status: 404 });

  try {
    const { safety, review } = await runArticleChecks({
      transcript: updated.transcript,
      article: updated.article,
    });
    updated =
      (await updateStory(id, {
        safety,
        review,
        groundingScore: review?.score ?? 0,
        checkedAt: new Date().toISOString(),
        checkError: null,
        status: review?.verdict === "pass" ? "reviewed" : "draft",
      })) ?? updated;
  } catch {
    updated =
      (await updateStory(id, {
        checkError: "We could not check this version yet.",
        checkedAt: null,
      })) ?? updated;
  }

  return Response.json({ story: updated });
}
