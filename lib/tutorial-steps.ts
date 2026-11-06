export type TutorialTrack = "river" | "drop" | "visitor";

export interface TourStep {
  /** Short heading shown in the tour card. */
  title: string;
  /** Plain-language explanation for the highlighted control. */
  body: string;
  /** CSS selector for the element to spotlight. Omit for a centred card. */
  target?: string;
  /** Route the tour should open before looking for the target. */
  path?: string;
}

/** The pre-sign-in tour. It runs on /login, where first-time visitors land. */
export const LOGIN_STEPS: readonly TourStep[] = [
  {
    title: "Being a River",
    body: "Choose this card if you would like to answer questions, record your memories, and turn them into stories. No password is needed for this demo.",
    target: '[data-tour="role-river"]',
  },
  {
    title: "Being a Drop",
    body: "Choose this card if you would like to ask questions, read stories, and start private conversations with Rivers. No password is needed for this demo.",
    target: '[data-tour="role-drop"]',
  },
  {
    title: "Already have a profile?",
    body: "If you have used HistorAI on this device before, choose your name here to sign back in. Your profile and stories will still be here.",
    target: '[data-tour="existing-accounts"]',
  },
  {
    title: "Just looking around?",
    body: "You can read every question and story without creating a profile. Choosing a role later lets you ask, answer, upvote, like, and send messages.",
    target: '[data-tour="visitor"]',
  },
];

const NAV_STEP: TourStep = {
  title: "Find your way around",
  body: "Use the menu on the left to move between Home, questions, stories, and podcasts. You can come back here at any time.",
  target: '[data-tour="nav"]',
};

const SEARCH_STEP: TourStep = {
  title: "Search everything",
  body: "Search questions and stories by a word or a topic. It sits in the left menu whenever you are looking for a particular memory.",
  target: '[data-tour="search"]',
};

const TEXT_SIZE_STEP: TourStep = {
  title: "Make the text comfortable",
  body: "Use A, A+, and A++ to make the whole site larger. Your choice is remembered on this device.",
  target: '[data-tour="text-size"]',
};

const HELP_STEP: TourStep = {
  title: "Help is always nearby",
  body: "Help, at the bottom of the left menu, opens plain-language answers, privacy information, and a way to replay this tour later.",
  target: '[data-tour="help"]',
};

const READ_STORIES_STEP: TourStep = {
  title: "Read stories",
  body: "Read stories collects answers that Rivers reviewed and published. Each story shows the question it answers so you can follow the thread.",
  path: "/youth",
  target: '[data-tour="story-feed"]',
};

/** Role-specific tours. Each step may open a new page before it is shown. */
export const TRACK_STEPS: Record<TutorialTrack, readonly TourStep[]> = {
  visitor: [
    NAV_STEP,
    SEARCH_STEP,
    TEXT_SIZE_STEP,
    {
      title: "Browse the questions",
      body: "Filter by topic, or sort to see the newest, the most popular, or the questions that still need an answer.",
      path: "/questions",
      target: '[data-tour="question-filters"]',
    },
    READ_STORIES_STEP,
    HELP_STEP,
    {
      title: "Ready to join in?",
      body: "You can create a free profile whenever you are ready. As a Drop you can ask questions; as a River you can answer them.",
      target: '[data-tour="sign-in"]',
    },
  ],
  drop: [
    NAV_STEP,
    {
      title: "Ask a question",
      body: "Start here. Write something you would genuinely like an older person's perspective on, then choose one or more topics so the right people can find it.",
      path: "/questions/new",
      target: '[data-tour="ask-form"]',
    },
    {
      title: "See what happened to your question",
      body: "My questions shows whether your question is waiting, being answered, or answered. You can edit or withdraw it while no River has started an answer.",
      path: "/questions/mine",
      target: '[data-tour="my-questions"]',
    },
    {
      title: "Browse questions",
      body: "Filter by topic, or sort to see the newest questions, the most popular ones, or questions that still need an answer.",
      path: "/questions",
      target: '[data-tour="question-filters"]',
    },
    READ_STORIES_STEP,
    HELP_STEP,
  ],
  river: [
    NAV_STEP,
    {
      title: "Pick a question to answer",
      body: "Answer a question shows questions that are still waiting for a River's perspective. Choose one you have a personal story about.",
      path: "/senior",
      target: '[data-tour="senior-questions"]',
    },
    {
      title: "Type it or record it",
      body: "You can type your answer, or choose Record your answer and speak naturally. You can listen to a recording before sending it, and you can always type instead. If you would rather talk it through, the optional interviewer is there to help.",
      path: "/senior?question=q-first-job",
      target: '[data-tour="answer-modes"]',
    },
    {
      title: "Save it or write your story",
      body: "You can save your answer and finish later, or ask HistorAI to write the story. Either way, you read it, correct anything that does not sound right, and choose whether to publish it. Nothing is published automatically. Find everything in My stories.",
    },
    HELP_STEP,
  ],
};
