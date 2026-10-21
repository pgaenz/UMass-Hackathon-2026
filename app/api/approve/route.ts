import { getStory, updateStory } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Senior consent gate. A story whose review passed publishes directly. A story
 * whose review flagged problems can still be published, but only with an
 * explicit `override: true` (a deliberate "publish anyway").
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    override?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return Response.json({ error: "Missing story id" }, { status: 400 });
  }

  const story = await getStory(id);
  if (!story) {
    return Response.json({ error: "Unknown story" }, { status: 404 });
  }
  if (story.status === "published") {
    return Response.json({ story });
  }
  if (!story.article.trim()) {
    return Response.json({ error: "There is no article to publish yet" }, { status: 409 });
  }

  const reviewPassed = story.review?.verdict === "pass";
  if (!reviewPassed && body?.override !== true) {
    return Response.json(
      { error: "The review flagged this story. Confirm you want to publish it anyway." },
      { status: 409 },
    );
  }

  const updated = await updateStory(id, { status: "published" });
  return Response.json({ story: updated ?? story });
}
