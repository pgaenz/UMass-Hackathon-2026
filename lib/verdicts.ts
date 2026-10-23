// Pure, dependency-free verdict derivation shared by the agents and the
// evaluation harness.
//
// The model only classifies; the server decides. Keeping these rules in one
// place means a model can never "self-approve" an article or downgrade its own
// safety issue, and the eval suite can test the exact production logic offline.

import type { ReviewIssue, ReviewResult, SafetyIssue, SafetyVerdict } from "./types";

/**
 * Review verdict: pass only when the score is high AND nothing was invented or
 * distorted. Tone/clarity notes can pass at score 4; hard fidelity issues never do.
 */
export function deriveReviewVerdict(
  score: number,
  issues: ReviewIssue[],
): ReviewResult["verdict"] {
  const hasHardIssue = issues.some(
    (issue) => issue.type === "invented_fact" || issue.type === "distortion",
  );
  return score >= 4 && !hasHardIssue ? "pass" : "revise";
}

/**
 * Safety verdict: any hard issue always blocks (even alongside soft issues);
 * soft-only content is sent back for one automatic cleanup pass.
 */
export function deriveSafetyVerdict(issues: SafetyIssue[]): SafetyVerdict {
  if (issues.some((issue) => issue.severity === "hard")) {
    return "block";
  }
  if (issues.some((issue) => issue.severity === "soft")) {
    return "revise";
  }
  return "allow";
}
