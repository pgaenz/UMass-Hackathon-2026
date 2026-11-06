import { checkSafety, rewriteForSafety } from "./agents";

export type QuestionScreenResult =
  | { ok: true; text: string; notice?: string }
  | { ok: false; status: number; error: string };

/**
 * Runs the family-friendly gate for a question. Used by POST and PATCH so both
 * paths share exactly the same behaviour (plan §7.1).
 */
export async function screenQuestionText(text: string): Promise<QuestionScreenResult> {
  const safety = await checkSafety({ content: text, kind: "question" });
  if (safety.verdict === "block") {
    return {
      ok: false,
      status: 422,
      error:
        safety.summary || "That question cannot be posted. Please ask something different.",
    };
  }

  if (safety.verdict !== "revise") {
    return { ok: true, text };
  }

  const cleaned = await rewriteForSafety({ content: text, kind: "question", safety });
  if (!cleaned) {
    return {
      ok: false,
      status: 422,
      error: "That question cannot be posted as written. Please ask something different.",
    };
  }

  const recheck = await checkSafety({ content: cleaned, kind: "question" });
  if (recheck.verdict !== "allow") {
    return {
      ok: false,
      status: 422,
      error:
        recheck.summary || "That question cannot be posted. Please ask something different.",
    };
  }

  return {
    ok: true,
    text: cleaned,
    notice: "We cleaned up your question a little before saving it.",
  };
}
