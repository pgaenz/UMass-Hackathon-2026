import { findLikeMatch, setLike } from "@/lib/likes";
import { authorize } from "@/lib/session";
import { getStory } from "@/lib/store";

export const runtime = "nodejs";

// POST /api/stories/[id]/like  { like: boolean }
// Explicit and idempotent. The match is computed in the same round trip so the
// client can show the pop-up without a second request.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { like?: unknown } | null;
  if (typeof body?.like !== "boolean") {
    return Response.json({ error: "Missing like flag." }, { status: 400 });
  }

  const story = await getStory(id);
  if (!story || story.status !== "published") {
    return Response.json({ error: "That story could not be found." }, { status: 404 });
  }

  const count = await setLike(id, auth.session.userId, body.like);
  const match = body.like ? await findLikeMatch(id, auth.session.userId) : null;

  return Response.json({ liked: body.like, count, match });
}
