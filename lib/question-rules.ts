/** Pure question validation rules, shared by create and edit (plan §7.1). */

export const MIN_QUESTION_LENGTH = 8;
export const MAX_QUESTION_LENGTH = 300;
export const MAX_QUESTION_TOPICS = 5;

export type TextValidation =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function validateQuestionText(raw: unknown): TextValidation {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length < MIN_QUESTION_LENGTH) {
    return { ok: false, error: "Please write a little more, at least 8 characters." };
  }
  if (text.length > MAX_QUESTION_LENGTH) {
    return { ok: false, error: "Please keep your question under 300 characters." };
  }
  return { ok: true, text };
}

export type TopicValidation =
  | { ok: true; topicIds: string[] }
  | { ok: false; error: string };

/** Accepts an array of known topic ids; empty is allowed (D5, recommended only). */
export function validateQuestionTopics(
  raw: unknown,
  knownTopicIds: readonly string[],
): TopicValidation {
  if (raw === undefined || raw === null) return { ok: true, topicIds: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Topics must be a list." };
  }
  if (raw.some((id) => typeof id !== "string")) {
    return { ok: false, error: "Topics must be a list of names." };
  }
  const topicIds = raw as string[];
  if (topicIds.length > MAX_QUESTION_TOPICS) {
    return { ok: false, error: "Please choose no more than 5 topics." };
  }
  const unknown = topicIds.find((id) => !knownTopicIds.includes(id));
  if (unknown) {
    return { ok: false, error: "One of those topics is not available. Please choose again." };
  }
  return { ok: true, topicIds };
}
