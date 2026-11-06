import { runArticleChecks } from "@/lib/checks";
import { deleteStoryCascade } from "@/lib/delete-story";
import { hashTranscript } from "@/lib/river-story-state";
import { authorize } from "@/lib/session";
import { requireOwnedStory } from "@/lib/story-access";
import { updateStory } from "@/lib/store";
import type { Story } from "@/lib/types";

export const runtime = "nodejs";

const TRANSCRIPT_MAX = 20_000;
const ARTICLE_MAX = 30_000;

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * PATCH /api/stories/[id] — edit the answer and/or the story directly.
 * The edit is always persisted before any check runs (plan/river-experience.md §7.2).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    transcript?: unknown;
    article?: unknown;
    expectedUpdatedAt?: unknown;
  } | null;

  const owned = await requireOwnedStory(id, auth.session.userId);
  if ("response" in owned) return owned.response;
  const story = owned.story;

  if (
    typeof body?.expectedUpdatedAt === "string" &&
    body.expectedUpdatedAt !== story.updatedAt
  ) {
    return fail(409, "This story changed in another window. Reload to see the latest version.");
  }

  const hasTranscript = typeof body?.transcript === "string";
  const hasArticle = typeof body?.article === "string";
  if (!hasTranscript && !hasArticle) {
    return fail(400, "Nothing to save");
  }

  const transcript = hasTranscript ? (body?.transcript as string).trim() : story.transcript;
  const article = hasArticle ? (body?.article as string).trim() : story.article;

  if (hasTranscript && (transcript.length < 1 || transcript.length > TRANSCRIPT_MAX)) {
    return fail(400, `Your answer must be between 1 and ${TRANSCRIPT_MAX} characters.`);
  }
  if (hasArticle && (article.length < 1 || article.length > ARTICLE_MAX)) {
    return fail(400, `Your story must be between 1 and ${ARTICLE_MAX} characters.`);
  }

  const now = new Date().toISOString();
  const patch: Partial<Story> = { updatedAt: now };
  if (hasTranscript) patch.transcript = transcript;
  if (hasArticle) {
    patch.article = article;
    patch.riverEdited = true;
    patch.review = null;
    patch.safety = null;
    patch.checkedAt = null;
    patch.checkError = null;
    patch.writtenFromHash = hashTranscript(transcript);
    // One snapshot for "Restore my previous version" (D3).
    patch.previousArticle = story.article.trim() ? story.article : story.previousArticle;
    // D1: editing a published story takes it off Read stories immediately.
    if (story.status === "published") {
      patch.status = "draft";
      patch.publishedAt = null;
    }
  }

  let updated = await updateStory(id, patch);
  if (!updated) return fail(404, "Unknown story");

  if (hasArticle) {
    try {
      const { safety, review } = await runArticleChecks({ transcript, article });
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
      // The save stands; only the check is recorded as not done yet.
      updated =
        (await updateStory(id, {
          checkError: "We could not check this version yet.",
          checkedAt: null,
        })) ?? updated;
    }
  }

  return Response.json({ story: updated });
}

/** DELETE /api/stories/[id] — permanent delete with the full cascade (D4/D7). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const owned = await requireOwnedStory(id, auth.session.userId);
  if ("response" in owned) return owned.response;

  await deleteStoryCascade(id);
  return Response.json({ deleted: true, id });
}
