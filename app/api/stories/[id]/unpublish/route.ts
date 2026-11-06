import { authorize } from "@/lib/session";
import { requireOwnedStory } from "@/lib/story-access";
import { updateStory } from "@/lib/store";

export const runtime = "nodejs";

/** POST /api/stories/[id]/unpublish — take a story off Read stories (keeps likes). */
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

  if (story.status !== "published") {
    return Response.json({ error: "This story is not published." }, { status: 409 });
  }

  const status = story.review?.verdict === "pass" ? "reviewed" : "draft";
  const updated = await updateStory(id, {
    status,
    publishedAt: null,
    updatedAt: new Date().toISOString(),
  });
  return Response.json({ story: updated ?? story });
}
