// Shared data model and API contract types.
// The Story shape mirrors MVP.md §4 exactly — keep them in sync.

export type InputType = "audio" | "text";
export type StoryStatus = "draft" | "reviewed" | "published";

export interface StoryMetadata {
  topic: string;
  summary: string;
}

export interface Story {
  id: string;
  prompt: string;
  questionId: string | null;
  inputType: InputType;
  rawAudioPath: string | null;
  transcript: string;
  metadata: StoryMetadata;
  article: string;
  groundingScore: number;
  piiDetected: boolean;
  status: StoryStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Questions & topics (see data/questions.json)
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

// POST /api/generate
export interface GenerateRequest {
  id: string;
}

export interface GenerateResponse {
  story: Story;
}

// POST /api/approve
export interface ApproveRequest {
  id: string;
}

export interface ApproveResponse {
  story: Story;
}

// GET /api/stories?status=published
export interface StoriesResponse {
  stories: Story[];
}
