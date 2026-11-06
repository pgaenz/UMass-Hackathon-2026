import { checkSafety, reviewArticle } from "./agents";
import type { ReviewResult, SafetyResult } from "./types";

/**
 * Runs the article checks in the safe order: safety first, then accuracy.
 * Used by direct edits, "Check again", and restore. The caller persists the
 * edit before calling this, so a failed check never discards the River's words.
 */
export async function runArticleChecks(input: {
  transcript: string;
  article: string;
}): Promise<{ safety: SafetyResult; review: ReviewResult | null }> {
  const safety = await checkSafety({
    content: input.article,
    kind: "article",
    context: input.transcript,
  });
  const review =
    safety.verdict === "allow"
      ? await reviewArticle({ transcript: input.transcript, article: input.article })
      : null;
  return { safety, review };
}
