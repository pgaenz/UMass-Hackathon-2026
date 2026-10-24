export const PODCAST_MINUTES = [15, 30, 45] as const;
export type PodcastMinutes = (typeof PODCAST_MINUTES)[number];

export type PodcastMode = "interests" | "random";

export interface PodcastAuthor {
  id: string;
  name: string;
  ageBand: string;
  profileHref: string;
}

export interface PodcastTopic {
  id: string;
  label: string;
}

export interface PodcastSegment {
  storyId: string;
  title: string;
  questionText: string | null;
  author: PodcastAuthor | null;
  topics: PodcastTopic[];
  storyText: string;
  storyMinutes: number;
  hostLeadIn: string;
  hostReflection: string;
}

export interface PodcastPlan {
  title: string;
  summary: string;
  targetMinutes: PodcastMinutes;
  estimatedMinutes: number;
  wordCount: number;
  storyWordCount: number;
  hostWordCount: number;
  aiGenerated: boolean;
  mode: PodcastMode;
  interestLabels: string[];
  intro: string;
  segments: PodcastSegment[];
  outro: string;
}

export interface PodcastRequest {
  topics: string[];
  mode: PodcastMode;
  minutes: PodcastMinutes;
}

/** Shared words-per-minute used for selection and runtime estimates. */
export const PODCAST_WORDS_PER_MINUTE = 150;
