// Shared data model and API contract types.
// The Story shape mirrors MVP.md §4 exactly — keep them in sync.

export type InputType = "audio" | "text" | "conversation";
export type StoryStatus = "draft" | "reviewed" | "published";

export interface StoryMetadata {
  topic: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Review agent output (shown to the senior; drives the publish gate)
// ---------------------------------------------------------------------------

export type ReviewIssueType = "invented_fact" | "distortion" | "tone" | "clarity";

export interface ReviewIssue {
  type: ReviewIssueType;
  detail: string;
  excerpt?: string;
}

export interface ReviewResult {
  score: number; // 1 (fabricated) – 5 (faithful and clear)
  verdict: "pass" | "revise";
  summary: string;
  issues: ReviewIssue[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Safety agent output (family-friendly / non-graphic / non-instructional gate)
// ---------------------------------------------------------------------------

// "soft" issues are polish (e.g. mild profanity) and can be auto-revised.
// "hard" issues must never be published, even by the senior.
export type SafetySeverity = "soft" | "hard";

export type SafetyCategory =
  | "profanity"
  | "sexual"
  | "violence"
  | "hate"
  | "harassment"
  | "self_harm"
  | "illegal_instructions"
  | "graphic"
  | "pii"
  | "other";

export interface SafetyIssue {
  category: SafetyCategory;
  severity: SafetySeverity;
  detail: string;
  excerpt?: string;
}

export type SafetyVerdict = "allow" | "revise" | "block";

export interface SafetyResult {
  verdict: SafetyVerdict; // derived server-side, never trusted from the model
  issues: SafetyIssue[];
  summary: string; // written to the user, plain language
  createdAt: string;
}

// A senior's feedback on a generated article, used to drive a re-creation.
// Text and/or audio (the audio is transcribed and stored where possible).
export interface FeedbackEntry {
  id: string;
  source: "user";
  text: string;
  rawAudioPath: string | null;
  createdAt: string;
}

export interface Story {
  id: string;
  prompt: string;
  questionId: string | null;
  // The River who authored this story. null means legacy/community content.
  authorId: string | null;
  inputType: InputType;
  rawAudioPath: string | null;
  transcript: string;
  // Full Q&A of the interview (interviewer + senior). Used only to keep the
  // generated article connected; facts still come from `transcript`.
  conversationContext: string | null;
  metadata: StoryMetadata;
  article: string;
  review: ReviewResult | null;
  // null = not checked (legacy/demo content) and is treated as allowed.
  safety: SafetyResult | null;
  feedback: FeedbackEntry[];
  groundingScore: number;
  piiDetected: boolean;
  status: StoryStatus;
  conversationId: string | null;
  createdAt: string;
  // --- River experience fields (plan/river-experience.md §6) ---
  // Last change to any River-editable field. Defaults to createdAt.
  updatedAt?: string;
  // When the story was last published.
  publishedAt?: string | null;
  // True once the River has edited the story text directly.
  riverEdited?: boolean;
  // When review + safety were last computed for the current article.
  checkedAt?: string | null;
  // Plain-language message when a check could not complete.
  checkError?: string | null;
  // Hash of the transcript used for the current article.
  writtenFromHash?: string | null;
  // One snapshot kept for "Restore my previous version".
  previousArticle?: string | null;
}

// ---------------------------------------------------------------------------
// Live voice conversation (native speech-to-speech)
// ---------------------------------------------------------------------------

export type ConversationStatus = "active" | "ended" | "abandoned";

export interface ConversationUserTurn {
  text: string;
  audioPath: string;
  durationMs: number;
  transcriptionStatus: "ok" | "failed";
}

export interface ConversationAssistantTurn {
  text: string;
  interrupted: boolean;
}

export interface ConversationTurn {
  id: string;
  index: number;
  // null for the opening assistant greeting.
  user: ConversationUserTurn | null;
  assistant: ConversationAssistantTurn | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  storyId: string;
  prompt: string;
  questionId: string | null;
  // The River who owns this conversation.
  userId: string | null;
  status: ConversationStatus;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}

// POST /api/conversation
export interface CreateConversationRequest {
  prompt: string;
  questionId?: string | null;
}

export interface CreateConversationResponse {
  conversation: Conversation;
  story: Story;
}

export interface EndConversationResponse {
  conversation: Conversation;
  story: Story;
}

// ---------------------------------------------------------------------------
// Story likes & interest-based match pop-up (see plan/LIKES.md)
// ---------------------------------------------------------------------------

// One user's like on one published story. Unique on (storyId, userId).
export interface StoryLike {
  storyId: string;
  userId: string;
  createdAt: string;
}

// Server-rendered state for the like control.
export interface StoryLikeState {
  liked: boolean;
  count: number;
}

// The other liker surfaced after a like. `sharedInterests` is empty when the
// fallback applies (neither profile lists any overlapping interest).
export interface LikeMatch {
  user: PublicUser;
  sharedInterests: Topic[];
}

// POST /api/stories/[id]/like
// `match` is computed in the same round trip so the pop-up can render instantly.
export interface LikeStoryResponse {
  liked: boolean;
  count: number;
  match: LikeMatch | null;
}

// ---------------------------------------------------------------------------
// Users, roles & profiles (see plan/PROFILES.md)
// ---------------------------------------------------------------------------

// Code role ids. Water is the metaphor for wisdom:
//   river = older adult (a long, deep accumulation of knowledge)
//   drop  = young person (asks and learns)
export type Role = "river" | "drop";

// Public, non-identifying age bucket. Exact age is never shown publicly.
export type AgeBand = "13-17" | "18-29" | "30-44" | "45-59" | "60-74" | "75+";

export interface User {
  id: string;
  role: Role;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  createdAt: string;
}

// Minimal author reference used when rendering cards and lists.
export interface AuthorRef {
  id: string;
  name: string;
  role: Role;
  ageBand: AgeBand;
}

// What other users are allowed to see.
export interface PublicUser {
  id: string;
  role: Role;
  name: string;
  ageBand: AgeBand;
  bio: string;
  interests: string[];
  createdAt: string;
}

// Server-side session identity. The cookie holds only an opaque token; this is
// resolved from the database on each request.
export interface SessionData {
  userId: string;
  role: Role;
}

// POST /api/auth/login — sign in with an email and password.
export interface LoginRequest {
  email: string;
  password: string;
}

// POST /api/auth/register — create a profile plus credentials.
export interface RegisterRequest {
  role: Role;
  name: string;
  age: number;
  bio?: string;
  interests?: string[];
  email: string;
  password: string;
}

// PATCH /api/auth/profile — edit the signed-in user's own profile.
export interface UpdateProfileRequest {
  name?: string;
  age?: number;
  bio?: string;
  interests?: string[];
}

// ---------------------------------------------------------------------------
// Questions & topics (seed fixtures: eval/fixtures/questions.json)
// ---------------------------------------------------------------------------

export interface Topic {
  id: string;
  label: string;
}

// A prompt youth can ask; seniors answer with one or more stories.
export interface Question {
  id: string;
  text: string;
  topicIds: string[];
  askedBy: string | null;
  upvotes: number;
  storyIds: string[];
  createdAt: string;
  // Defaults to createdAt. Kept optional so existing records load unchanged.
  updatedAt?: string;
  editedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Question upvotes (per-user; see plan/UX-FIXES-2.md §6)
// ---------------------------------------------------------------------------

// One user's upvote on one question. Unique on (questionId, userId).
// `question.upvotes` remains the denormalized display/sort count.
export interface QuestionVote {
  questionId: string;
  userId: string;
  createdAt: string;
}

// Server-rendered state for the upvote control. The displayed count is the
// denormalized `question.upvotes`, so only the viewer's own vote is needed here.
export interface QuestionVoteState {
  voted: boolean;
}

// POST /api/questions/upvote
export interface VoteQuestionResponse {
  voted: boolean;
  count: number;
}

// ---------------------------------------------------------------------------
// 1:1 private messaging (see plan/CHAT.md)
// "ChatThread"/"ChatMessage" deliberately avoid the existing AI "Conversation".
// ---------------------------------------------------------------------------

export type ChatThreadStatus = "active" | "archived";
export type ChatSafetyVerdict = "allow" | "block";

export interface ChatSafety {
  verdict: ChatSafetyVerdict;
  flags: string[]; // e.g. ["scam:money", "pii:phone", "link"]
}

export interface ChatMessage {
  id: string;
  senderId: string;
  kind: "text"; // reserved: "voice" for a later release
  body: string;
  safety: ChatSafety;
  readBy: string[];
  createdAt: string;
  deletedAt: string | null;
}

export interface ChatThread {
  id: string;
  participantIds: [string, string];
  pairKey: string; // "u-a|u-b" (sorted) — prevents duplicate threads
  status: ChatThreadStatus;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string; // denormalized for inbox sorting
}

export interface ChatBlock {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

// ---- wire shapes ----

export interface OtherParticipant {
  id: string;
  name: string;
  role: Role;
  ageBand: AgeBand;
}

export interface ThreadSummary {
  threadId: string;
  other: OtherParticipant;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  blocked: boolean;
  updatedAt: string;
}

export interface ChatMessageView {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  seen: boolean;
}

export interface SendMessageRequest {
  body: string;
}

export interface ChatMessagesResponse {
  threadId: string;
  other: OtherParticipant;
  messages: ChatMessageView[];
  blocked: boolean;
  canSend: boolean;
}

// ---------------------------------------------------------------------------
// API contract (see docs/api-contract.md)
// ---------------------------------------------------------------------------

// Every non-2xx response uses this shape.
export interface ApiError {
  error: string;
}

// POST /api/intake — text variant (audio uses multipart/form-data).
export interface IntakeTextRequest {
  inputType: "text";
  prompt: string;
  text: string;
  // Optional question this story answers; links the draft to the question.
  questionId?: string | null;
}

export interface IntakeResponse {
  story: Story;
}

// POST /api/generate — first call creates the article; a call with feedback
// re-creates it from the original answer + current article + all feedback.
export interface GenerateRequest {
  id: string;
  feedback?: string;
}

export interface GenerateResponse {
  story: Story;
}

// POST /api/approve. `override` publishes a story whose review did not pass.
export interface ApproveRequest {
  id: string;
  override?: boolean;
}

export interface ApproveResponse {
  story: Story;
}

// GET /api/stories?status=published
export interface StoriesResponse {
  stories: Story[];
}
