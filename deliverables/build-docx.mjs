#!/usr/bin/env node
/**
 * Builds `deliverables/HistorAI_Deliverable.docx` — the PEAAII 2026 hackathon
 * project document (Deliverables 1 & 2).
 *
 * Usage (from the repo root):
 *   npm install --no-save docx
 *   node deliverables/build-docx.mjs
 *
 * The document is generated from this file so it can be regenerated after any
 * change; screenshots are intentionally left as described placeholders (see the
 * Demo section) to be inserted by the team.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "deliverables");
mkdirSync(OUT_DIR, { recursive: true });

const ACCENT = "0B4F6C";
const ACCENT2 = "0B7285";
const INK = "12343B";
const MUTED = "4A6B76";
const WARM = "B06A00";

// ---------------------------------------------------------------------------
// Inline formatting: **bold**, `code`
// ---------------------------------------------------------------------------

function runs(text, base = {}) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(new TextRun({ text: text.slice(last, match.index), ...base }));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(new TextRun({ text: token.slice(2, -2), bold: true, ...base }));
    } else {
      parts.push(new TextRun({ text: token.slice(1, -1), font: "Consolas", size: 17, ...base }));
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push(new TextRun({ text: text.slice(last), ...base }));
  }
  return parts;
}

const P = (text, opts = {}) =>
  new Paragraph({ spacing: { after: 80, line: 250, ...(opts.spacing ?? {}) }, ...opts, children: runs(text, opts.run ?? {}) });

const H1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    children: runs(text),
  });
const H2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    children: runs(text),
  });
const H3 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    children: runs(text),
  });

const Bullet = (text) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40, line: 246 },
    children: runs(text),
  });

const Small = (text) =>
  new Paragraph({
    spacing: { after: 60, line: 238 },
    children: runs(text, { size: 17, color: MUTED }),
  });

const Spacer = (pts = 4) =>
  new Paragraph({ spacing: { after: pts * 20 }, children: [] });

// ---------------------------------------------------------------------------
// Tables and boxes
// ---------------------------------------------------------------------------

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "B7CDD7" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "B7CDD7" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "B7CDD7" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "B7CDD7" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D5E3E9" },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "D5E3E9" },
};

function table(headers, rows, opts = {}) {
  const widths = opts.widths;
  const cellWidth = (index) =>
    widths ? { size: widths[index], type: WidthType.PERCENTAGE } : undefined;

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (header, index) =>
        new TableCell({
          width: cellWidth(index),
          shading: { fill: ACCENT, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [
            new Paragraph({
              spacing: { after: 0, line: 236 },
              children: runs(header, { color: "FFFFFF", bold: true, size: 18 }),
            }),
          ],
        }),
    ),
  });

  const bodyRows = rows.map(
    (row, rowIndex) =>
      new TableRow({
        children: row.map(
          (cell, index) =>
            new TableCell({
              width: cellWidth(index),
              shading:
                rowIndex % 2 === 1
                  ? { fill: "F4FAFC", type: ShadingType.CLEAR, color: "auto" }
                  : undefined,
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [
                new Paragraph({
                  spacing: { after: 0, line: 236 },
                  children: runs(String(cell), { size: 18 }),
                }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [headerRow, ...bodyRows],
  });
}

function placeholder(id, title, description) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.DASHED, size: 6, color: "8AA6B2" },
      bottom: { style: BorderStyle.DASHED, size: 6, color: "8AA6B2" },
      left: { style: BorderStyle.DASHED, size: 6, color: "8AA6B2" },
      right: { style: BorderStyle.DASHED, size: 6, color: "8AA6B2" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "F7FBFC", type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 90, bottom: 90, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({ text: `${id} — ${title}`, bold: true, color: ACCENT, size: 19 }),
                  new TextRun({ text: "   [INSERT SCREENSHOT HERE]", bold: true, color: WARM, size: 18 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 40, line: 240 },
                children: runs(description, { size: 18 }),
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: `Caption: Figure ${id.slice(1)}. ${title}.`,
                    italics: true,
                    size: 17,
                    color: MUTED,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Workflow diagram (native Word paragraphs — no image required)
// ---------------------------------------------------------------------------

function flowBox(title, note, kind) {
  const fills = { agent: "E3F2F9", gate: "F1F5F4", human: "FDF3E3", result: "E4F4EC" };
  const colors = { agent: ACCENT2, gate: INK, human: WARM, result: ACCENT2 };
  const dashed = kind === "gate";
  return new Paragraph({
    shading: { fill: fills[kind], type: ShadingType.CLEAR, color: "auto" },
    border: {
      top: { style: dashed ? BorderStyle.DASHED : BorderStyle.SINGLE, size: 6, color: colors[kind] },
      bottom: { style: dashed ? BorderStyle.DASHED : BorderStyle.SINGLE, size: 6, color: colors[kind] },
      left: { style: dashed ? BorderStyle.DASHED : BorderStyle.SINGLE, size: 6, color: colors[kind] },
      right: { style: dashed ? BorderStyle.DASHED : BorderStyle.SINGLE, size: 6, color: colors[kind] },
    },
    spacing: { before: 40, after: 40, line: 230 },
    children: [
      new TextRun({ text: title, bold: true, size: 18, color: colors[kind] }),
      new TextRun({ break: 1 }),
      new TextRun({ text: note, size: 15, color: MUTED }),
    ],
  });
}

const downArrow = () =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: "▼", color: ACCENT2, size: 16 })],
  });

function lane(title, boxes) {
  const children = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: title, bold: true, size: 17, color: ACCENT2, allCaps: true })],
    }),
  ];
  boxes.forEach((box, index) => {
    children.push(flowBox(box[0], box[1], box[2]));
    if (index < boxes.length - 1) children.push(downArrow());
  });
  return new TableCell({
    width: { size: 29, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children,
  });
}

const arrowCell = () =>
  new TableCell({
    width: { size: 6.5, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "→", color: ACCENT2, size: 26, bold: true })],
      }),
    ],
  });

function workflowDiagram() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          lane("1 · Capture (human)", [
            ["Drop asks a question", "Browse, upvote, or ask a new one", "human"],
            ["River answers", "Voice memo · typed text · live AI interview", "human"],
            ["Whisper transcription", "Transcript = the only source of facts", "gate"],
          ]),
          arrowCell(),
          lane("2 · Agentic pipeline", [
            ["Writing Agent", "Article + topic + summary; never adds facts", "agent"],
            ["Safety Agent", "allow · revise (auto-clean) · BLOCK", "gate"],
            ["Review Agent", "Independent grounding score 1–5", "agent"],
          ]),
          arrowCell(),
          lane("3 · Human gate & result", [
            ["River reviews & approves", "Human-in-the-loop publish decision", "human"],
            ["Published youth feed", "Drafts and unapproved stories never appear", "result"],
            ["Like → match → chat", "Chat safety screen runs before delivery", "gate"],
          ]),
        ],
      }),
    ],
  });
}

function diagramLegend() {
  return new Paragraph({
    spacing: { before: 100, after: 80 },
    children: [
      new TextRun({ text: "■", color: ACCENT2, size: 18 }),
      new TextRun({ text: " model-backed agent    ", size: 17, color: MUTED }),
      new TextRun({ text: "▨", color: INK, size: 18 }),
      new TextRun({ text: " deterministic / server-side gate    ", size: 17, color: MUTED }),
      new TextRun({ text: "■", color: WARM, size: 18 }),
      new TextRun({ text: " human decision", size: 17, color: MUTED }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Document content
// ---------------------------------------------------------------------------

const children = [];

// ---- Cover block ----
children.push(
  new Paragraph({
    spacing: { after: 20 },
    children: [new TextRun({ text: "HistorAI — “When I Was Your Age”", bold: true, size: 40, color: ACCENT })],
  }),
  new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({
        text: "Bridging generational wisdom and purpose through agentic AI",
        size: 24,
        color: ACCENT2,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT2 } },
    children: [
      new TextRun({
        text: "UMass Boston · 2026 PEAAII Agentic AI Applications Hackathon · Deliverable 1 & 2",
        size: 18,
        color: MUTED,
      }),
    ],
  }),
);

children.push(
  table(
    ["Team", "Contribution"],
    [
      ["Mattia Mencarelli", "Product strategy, problem framing, clinical research, market positioning"],
      ["Giuliano Di Croce", "Business model, go-to-market strategy, market sizing"],
      ["Philipp Gaenz", "Agentic workflow, frontend, backend"],
      ["Louis Beckand Verwee", "Agentic workflow, UX/UI, demo"],
    ],
    { widths: [30, 70] },
  ),
);

children.push(
  Small("Contribution split is by team agreement; git history is not used as a contribution measure."),
  new Paragraph({
    spacing: { before: 60, after: 40 },
    children: [
      new TextRun({ text: "Repository:  ", bold: true, size: 19 }),
      new ExternalHyperlink({
        link: "https://github.com/pgaenz/UMass-Hackathon-2026",
        children: [
          new TextRun({
            text: "https://github.com/pgaenz/UMass-Hackathon-2026",
            color: "0563C1",
            underline: {},
            size: 19,
          }),
        ],
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: "Access:  ", bold: true, size: 19 }),
      new TextRun({
        text: "the repository is shared for review; if it is kept private, the teaching-assistant account ",
        size: 19,
      }),
      new TextRun({ text: "TinyZhen", bold: true, size: 19 }),
      new TextRun({ text: " is added as a collaborator, as the hackathon requires.", size: 19 }),
    ],
  }),
  new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: "Document date:  ", bold: true, size: 19 }),
      new TextRun({ text: "October 2026", size: 19 }),
    ],
  }),
);

// ---- 1. Project Overview ----
children.push(H1("1. Project Overview"));

children.push(H2("1.1 Project title and summary"));
children.push(
  P(
    "**HistorAI** lets a young person (a **Drop**) ask a question, lets an older adult (a **River**) answer it by voice, typed text, or a live AI speech-to-speech interview, and uses a multi-agent pipeline to turn that answer into a faithful, readable article. Nothing publishes until the River approves it. Reading then becomes a connection: liking a story can surface a shared-interest match, and private 1:1 messages are screened for scams, personal data, and abuse before they are stored.",
  ),
);

children.push(H2("1.2 Problem statement"));
children.push(
  P("Three connected problems motivate the product; sources are listed in Appendix F."),
  Bullet(
    "**Elder loneliness and loss of purpose.** The WHO Commission on Social Connection links loneliness to 871,000 deaths a year globally; the U.S. Surgeon General reports a 26–30% higher risk of premature death (comparable to smoking 15 cigarettes a day); 34% of adults aged 50–80 report feeling isolated and 37% lack companionship (University of Michigan poll). Loss of purpose is itself dangerous: a JAMA Network Open study of 6,985 older adults found more than twice the all-cause mortality risk (2.43×) among those with low life purpose.",
  ),
  Bullet(
    "**Youth burnout and a guidance void.** Cigna’s 2025 report finds 67% of Gen Z adults and 65% of Millennials report feeling lonely — the loneliest generations. Harvard’s Making Caring Common study found 75% of lonely young adults feel they lack meaning or purpose, while their attention is captured by shallow algorithmic content.",
  ),
  Bullet(
    "**Generational wisdom disappears.** Stanford Center on Longevity research shows age segregation harms both groups; structured, non-evaluative intergenerational contact builds youth resilience and restores senior purpose. Today there is no low-friction channel to capture and share that experience before it is lost.",
  ),
  P(
    "**Localized persona (from the team’s Trust & Robustness Plan):** Arthur, a 75-year-old widower whose children have moved away. He lives alone, has no daily companion, and no one to share his stories with. HistorAI gives him a reason to be needed each week and a way to build friendships across generations.",
  ),
);

children.push(H2("1.3 Target users"));
children.push(
  table(
    ["Segment", "Who", "What they need"],
    [
      ["Wisdom creators", "Rivers — older adults, roughly 60–85, retired or semi-retired, often living alone", "Purpose, dignity, a low-friction way to contribute; voice over typing"],
      ["Wisdom seekers", "Drops — young people roughly 13–30, heavy media consumers", "Authentic mentorship and lived experience instead of algorithmic noise"],
      ["Institutional (roadmap)", "Senior-living communities, universities, care plans", "A scalable engagement and wellbeing program with measurable outcomes"],
    ],
    { widths: [20, 40, 40] },
  ),
);

children.push(H2("1.4 Proposed solution"));
children.push(
  P(
    "HistorAI is built around one loop: **a youth question → a frictionless answer → an agentic transformation → a human approval → a youth feed → a real connection.** Drops ask and upvote questions. Rivers answer with one tap (voice memo, typed text, or a guided AI interview). A four-stage agent pipeline transcribes, writes, safety-checks, and independently fact-checks the story. The River reviews the result, can request a rewrite in their own words, and only then publishes. Published stories can be liked, which can introduce two people with shared interests, and messaging is protected by a pre-send safety screen.",
  ),
  P(
    "The working prototype produces a **written article** as its publishable output. Podcast and video generation — one voice memo turned into multiple formats — are in active development and are described only as roadmap in this document.",
  ),
);

children.push(H2("1.5 Why agentic AI is appropriate"));
children.push(
  table(
    ["Agentic capability", "How HistorAI implements it"],
    [
      ["Goal-directed, multi-step work", "One goal — turn a spoken answer into a publishable, grounded story — is decomposed into intake, transcription, writing, safety, review, human approval, and publication."],
      ["Tool use and external resources", "OpenRouter chat completions (writing, review, safety), Whisper speech-to-text, native speech-to-speech audio, browser recording, and a persistent store are orchestrated per step."],
      ["Memory and context", "The transcript, interview context, prior feedback, review results, and safety results are stored per story and re-used by the revision agent. Chat history and profile interests drive matching."],
      ["Planning and routing", "The server decides what runs when: safety always runs before review; a hard safety block stops the pipeline; a soft issue triggers exactly one automatic cleanup; a failed review requires an explicit human override."],
      ["Multi-agent coordination", "Seven specialised agents (writing, revision, review, safety, safety rewrite, interview, chat safety) run under a deterministic orchestrator rather than one monolithic prompt."],
      ["Human-in-the-loop", "The River is the only actor who can publish. Feedback loops back into the revision agent, and no override can publish a hard safety violation."],
    ],
    { widths: [30, 70] },
  ),
  P(
    "**Contrast with a chatbot:** a chatbot answers a request. HistorAI pursues a goal across several tools, delegates writing and verification to different agents, blocks its own unsafe output, and treats the human as the final authority. The agentic layer is the product, not a feature bolted onto a form.",
  ),
);

// ---- 2. Agentic AI Design ----
children.push(H1("2. Agentic AI Design"));

children.push(H2("2.1 Overall workflow"));
children.push(
  P(
    "The diagram below shows the production workflow. Solid-bordered boxes are model-backed agents, dashed boxes are deterministic or server-side gates, and warm boxes are human decisions.",
  ),
  workflowDiagram(),
  diagramLegend(),
);

children.push(H2("2.2 Agent responsibilities"));
children.push(
  table(
    ["Agent", "Input", "Output and guardrail"],
    [
      ["Writing Agent", "Transcript (+ interview context)", "Article, topic, summary. Strict extractive grounding: it may reorganise and quote, never add facts, and must preserve uncertainty."],
      ["Review Agent", "Transcript + generated article", "Independent grounding score 1–5 with issue types (invented_fact, distortion, tone, clarity). The verdict is derived server-side: pass only when score ≥ 4 and no invented/distorted fact exists."],
      ["Revision Agent", "Transcript, current article, review + safety feedback, senior feedback", "A new article that fixes feedback without inventing anything; unsafe content is cut, never replaced with invented detail."],
      ["Safety Agent", "Article, question, bio, or name (+ transcript as context)", "Family-friendly classification with soft/hard severities. The server derives allow / revise / block; hard issues can never be published."],
      ["Safety Rewrite Agent", "Short user text + safety issues", "A cleaned question or bio for soft issues, so the author’s meaning survives without the flagged language."],
      ["Interview Agent", "Live speech-to-speech turns + prior conversation", "Warm, one-question-at-a-time interviewing that draws out the story without inventing facts or diagnosing. It never writes the article."],
      ["Chat Safety Agent", "One private message", "allow / block classification for scams, credentials, contact data, grooming, abuse, and illegal requests. A deterministic regex layer runs first; if the semantic layer errors, the message is not delivered."],
      ["Orchestration layer (not an LLM)", "Route requests and persisted state", "Ordering (safety before review), verdict derivation, publish transitions, rate limits, storage, and session authorisation."],
    ],
    { widths: [20, 28, 52] },
  ),
);

children.push(H2("2.3 Tools and external resources"));
children.push(
  table(
    ["Tool / resource", "Used for"],
    [
      ["OpenRouter Chat Completions", "Writing, revision, review, safety, and chat screening (default `openai/gpt-4o-mini`; review runs on `google/gemini-3.6-flash`)."],
      ["OpenRouter /audio/transcriptions", "Whisper large-v3-turbo speech-to-text for voice memos, interview turns, and spoken feedback."],
      ["OpenRouter audio chat", "Native speech-to-speech interview with streamed PCM16 audio (`gpt-audio-mini`)."],
      ["Browser APIs", "`MediaRecorder`, voice-activity detection, WAV encoding, PCM playback — no plugins or native apps."],
      ["JSON file store + `data/uploads/`", "Stories, users, questions, conversations, chat, likes, and raw audio. No database in the prototype."],
      ["Signed httpOnly cookie sessions", "Passwordless role + profile identity for the demo; roles gate authoring and publishing."],
      ["Committed seed data", "A fresh clone is demo-ready without keys or a database."],
    ],
    { widths: [34, 66] },
  ),
);

children.push(H2("2.4 Context and information requirements"));
children.push(
  Bullet(
    "**The transcript is the single source of facts.** Every generation prompt states that the transcript is the only evidence; the model is explicitly forbidden from importing outside knowledge or “filling in” missing details.",
  ),
  Bullet(
    "**Interview context is structure, not facts.** The interviewer’s questions and acknowledgements are passed only so paragraphs stay coherent; prompts state that anything the interviewer said is not evidence about the senior.",
  ),
  Bullet(
    "**Feedback and verdict history persist.** Review results, safety results, and every round of senior feedback are stored on the story and re-used by the revision agent, so a rewrite addresses all prior notes.",
  ),
  Bullet(
    "**Connection context is minimal.** Matching uses only published-story likes and the list of interests a user chose to publish; message screening receives one message body at a time and never the whole thread.",
  ),
  Bullet(
    "**No internet grounding.** The prototype deliberately does not let models browse or retrieve external sources, which removes an entire class of fabrication and keeps older adults’ data out of third-party retrieval.",
  ),
);

children.push(H2("2.5 Human-in-the-loop decisions"));
children.push(
  table(
    ["Decision", "Who decides", "System behaviour"],
    [
      ["Publish a story", "The River (author)", "Only a River who owns the story can approve it; the story then appears in the youth feed."],
      ["Request a rewrite", "The River", "Text or spoken feedback is transcribed and passed to the revision agent; the article is regenerated without new facts."],
      ["Publish despite a failed review", "The River, explicitly", "A story that failed the grounding review can only be published with an explicit “publish anyway” confirmation."],
      ["Publish a hard safety violation", "No one", "A hard-blocked story cannot be published by any role, with or without override. The content must be changed."],
      ["Block or report a person", "Any signed-in user", "Either party can close a conversation; reports are stored for moderation."],
      ["Crisis language", "System + user", "The message is not delivered and the sender receives the 988 Suicide & Crisis Lifeline resource instead."],
      ["Read-only browsing", "Visitor", "A visitor can read published stories without creating content."],
    ],
    { widths: [30, 22, 48] },
  ),
);

children.push(H2("2.6 Single-agent or multi-agent architecture"));
children.push(
  P(
    "HistorAI is intentionally **multi-agent with a deterministic orchestrator**. Separating the writer from an independent reviewer produces a genuine adversarial check instead of a model approving its own work. Running safety before review avoids wasting a review on unsafe content, and deriving every verdict server-side means the model classifies while the application decides. The same principle protects messaging: a fast regex layer catches known patterns instantly, and a semantic layer handles the rest — with a fail-closed rule when it cannot verify a message.",
  ),
  P(
    "The trade-off is latency and cost: a full generation is three model calls, and the reviewer can run on a different model to reduce correlated errors. The prototype measured about 5.2 seconds end-to-end for the generate stage on the evaluation machine (writing + safety + review), comfortably inside the team’s under-60-second target.",
  ),
);

// ---- 3. Working Prototype ----
children.push(H1("3. Working Prototype"));

children.push(H2("3.1 What is implemented"));
children.push(
  Bullet("**Roles and profiles** — passwordless River/Drop sign-in, onboarding, editable profiles, public profiles, visitor mode, and an age gate (13+, exact age never shown publicly — only an age band)."),
  Bullet("**Questions** — asking, browsing, topic filters, sorting, search, and per-user upvotes."),
  Bullet("**Answering** — voice memos, typed answers, and a live AI speech-to-speech interview."),
  Bullet("**The agent pipeline** — Whisper transcription, writing, safety gate with automatic cleanup of soft issues, independent grounding review, and revision from senior feedback."),
  Bullet("**Publishing** — a River-only approval gate, a youth feed that contains only published stories, and an article reader with accessibility controls."),
  Bullet("**Connection** — story likes, a one-tap shared-interest match pop-up, private 1:1 messaging with pre-send screening, blocking, reporting, and rate limits."),
  Bullet("**Operations** — JSON persistence with committed seed data, a production build, and the `eval/` harness described in §5."),
);

children.push(H2("3.2 Repository and how to run it"));
children.push(
  P(
    "Repository: `https://github.com/pgaenz/UMass-Hackathon-2026`. Requires **Node.js 20+** and an OpenRouter API key. From a fresh clone:",
  ),
);
children.push(
  new Paragraph({
    spacing: { after: 60, line: 250 },
    shading: { fill: "F1F6F8", type: ShadingType.CLEAR, color: "auto" },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "B7CDD7" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "B7CDD7" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "B7CDD7" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "B7CDD7" },
    },
    children: [
      new TextRun({ text: "npm install", font: "Consolas", size: 17 }),
      new TextRun({ break: 1, text: "cp .env.example .env.local   # set OPENROUTER_API_KEY", font: "Consolas", size: 17 }),
      new TextRun({ break: 1, text: "npm run dev                  # open http://localhost:3000", font: "Consolas", size: 17 }),
      new TextRun({ break: 1, text: "npm run build && npm start   # production build", font: "Consolas", size: 17 }),
    ],
  }),
);
children.push(
  P(
    "Demo sign-in is passwordless: choose **I’m a River** or **I’m a Drop**, or pick a returning profile, or continue as a visitor. Seed users and stories are committed, so the full loop works without any prior data. Environment variables are documented in the README and Appendix E.",
  ),
);

children.push(H2("3.3 Evaluation access"));
children.push(
  P(
    "The evaluation harness is part of the repository: `npm run eval` (deterministic, no key), `npm run eval:live` (agent quality), and `npm run eval:e2e` (black-box HTTP against a running server). Results are committed under `eval/results/`.",
  ),
);

children.push(H2("3.4 Major tools and technologies"));
children.push(
  table(
    ["Layer", "Choice"],
    [
      ["Application", "Next.js 15 (App Router) · React 19 · TypeScript"],
      ["Styling", "Tailwind CSS 4 · custom water-themed design system"],
      ["AI", "OpenRouter: chat completions, Whisper speech-to-text, native speech-to-speech"],
      ["Voice input", "Browser `MediaRecorder`, voice-activity detection, WAV encoding, PCM streaming"],
      ["Storage", "JSON files in `data/` + local audio uploads (no database)"],
      ["Auth (demo)", "Signed httpOnly cookie session · passwordless role + profile"],
      ["Evaluation", "TypeScript harness + Playwright-free HTTP runner (`eval/`)"],
    ],
    { widths: [22, 78] },
  ),
);

// ---- 4. Demo ----
children.push(H1("4. Demo"));
children.push(
  P(
    "**Core value in one sentence:** a question from a young person becomes a real, grounded story from an older adult — because AI does the heavy lifting and the human stays in charge.",
  ),
  P(
    "The demo runs for **2–3 minutes** and follows Problem → User Interaction → Agentic Workflow → Result. It uses the committed seed personas (Maya, 21, a Drop; Ruth, 78, a River) so it is repeatable.",
  ),
);
children.push(
  table(
    ["Time", "Action", "What the audience sees"],
    [
      ["0:00–0:15", "State the problem and the two personas.", "Two lonely generations, one broken bridge; Ruth has a story, Maya needs guidance."],
      ["0:15–0:35", "As Maya, open the question explorer and choose a prompt.", "A youth-driven question with upvotes; the feed of real questions."],
      ["0:35–1:05", "As Ruth, open the River dashboard and answer by voice (or start the AI interview).", "One-tap recording or a patient interviewer; the answer becomes a transcript."],
      ["1:05–1:40", "Open the review screen: article, Safety check, Editor review. Approve.", "The agent output with its guardrails visible; only Ruth can publish."],
      ["1:40–2:10", "As Maya, open the youth feed and read the published story; like it.", "The story is live; a shared-interest match offers to say hello."],
      ["2:10–2:40", "Send a scam message in chat.", "The message is blocked before delivery; close with the GitHub link."],
    ],
    { widths: [14, 38, 48] },
  ),
);
children.push(
  P(
    "**Fallback plan:** if the live model APIs are slow or unavailable, use the committed seed story `s-first-job` (transcript, article, safety, and review are already stored). The review screen, approval, feed, and chat screening all work offline of the writer/reviewer APIs, so the trust story can still be demonstrated.",
  ),
);

children.push(H2("4.1 Screenshot placeholders (to be filled in by the team)"));
children.push(
  P("Insert the screenshots below at the marked positions. Each description states exactly what the image should show; captions are already numbered."),
  placeholder("S1", "Role choice and the youth question", "The `/login` screen with the River / Drop / visitor choice, or the question explorer with a real youth question and its upvote count."),
  placeholder("S2", "The River answers by voice or AI interview", "The River dashboard (`/senior`) with the selected question and the record button, or the AI interview screen (`/senior/conversation`) showing the question and the start control."),
  placeholder("S3", "Review screen with safety and grounding results", "`/senior/review/[id]` showing the original answer beside the generated article, the **Safety check** badge (“Safe to publish”), and the **Editor review** badge with its score (for example, “Passed · 4/5”). This is the human-in-the-loop moment."),
  placeholder("S4", "The published story in the youth feed", "`/youth` or `/youth/[id]` showing the approved story readable by young users, with the likes control."),
  placeholder("S5", "A scam attempt blocked before delivery", "The private message composer after sending a scam message, showing the inline refusal (the message is never delivered). Optional: the 988 crisis response instead."),
);

// ---- 5. Evaluation ----
children.push(H1("5. Evaluation"));
children.push(H2("5.1 Method"));
children.push(
  P(
    "The harness in `eval/` has three layers, all committed with results: **offline** deterministic checks (61 cases: verdict rules, age validation, chat patterns), **live** agent checks (8 cases against real OpenRouter models), and **end-to-end HTTP** checks (24 cases against a running server: age gate, publish gates, feed isolation, likes/match, chat screening). Live runs used writing `openai/gpt-4o-mini`, review `google/gemini-3.6-flash`, and safety/chat `openai/gpt-4o-mini`. The E2E harness snapshots and restores `data/`, so runs are repeatable and do not pollute the demo data.",
  ),
);
children.push(
  table(
    ["Suite", "Cases", "Passed", "Failed", "Known issues", "What it proves"],
    [
      ["Offline (no network)", "61", "61", "0", "0", "Server-derived verdicts, age gate and age bands, chat regex patterns"],
      ["Live agents", "8", "8", "0", "0", "Writing fidelity, fabricated-fact and distortion detection, safety severities, semantic chat screen"],
      ["End-to-end HTTP", "24", "23", "0", "1", "Publish gates, feed isolation, likes/match, full chat screening over the real routes"],
    ],
    { widths: [20, 8, 9, 9, 12, 42] },
  ),
);
children.push(
  Small(
    "The single known issue is reproduced deliberately and described in §5.3: the display-name safety gate rejects benign names containing the product term “Drop”. It is tracked as a `known` case rather than silently passing.",
  ),
);

children.push(H2("5.2 Representative test cases"));
children.push(
  P(
    "**Successful behaviours observed:** faithful and clear articles pass the independent review; fabricated facts and removed hedges are caught and blocked from auto-passing; mild profanity is cleaned automatically while fraud instructions are unoverridably blocked; drafts and unapproved stories never reach the feed; ages are validated with only an age band made public; scams, PII, and crisis language are intercepted before storage while ordinary conversation still flows; and the semantic chat layer catches scams that the pattern layer cannot see.",
  ),
  table(
    ["#", "Scenario", "Expected outcome", "Actual outcome", "Result"],
    [
      ["1", "Typed answer → article → approval → feed (E2E-PIPE-01–05)", "Draft created; article passes; only then does it appear in `/youth`", "201 draft (transcript match) → 200, 174-char article, safety=allow, review=pass → published → marker absent before approval, present after", "Pass"],
      ["2", "Fabricated fact injected into the article (LIVE-FABRICATED-01)", "Reviewer flags `invented_fact` and refuses to pass", "Verdict revise, score 2, 2 invented-fact issues (e.g. “in Boston”, “President Kennedy in 1962”)", "Pass"],
      ["3", "Senior’s hedge removed (“I think it was 1968”) (LIVE-DISTORTION-01)", "Reviewer flags `distortion`", "Verdict revise, score 3, 1 distortion issue with the exact quote", "Pass"],
      ["4", "Mild profanity in a faithful article (LIVE-SAFETY-SOFT-01)", "Soft issue → one automatic cleanup; never blocked", "Verdict revise, soft/profanity only", "Pass"],
      ["5", "Fraud instructions in an article (LIVE-SAFETY-HARD-01)", "Hard block; no publication path", "Verdict block, 1 hard issue (“explicit instructions for committing fraud”)", "Pass"],
      ["6", "Hard-blocked story approved with override (E2E-GATE-01)", "409 — override cannot bypass safety", "409 “This story contains something that cannot be published.”", "Pass"],
      ["7", "Story that failed review (E2E-GATE-02/03)", "409 without confirmation; publishable only with explicit override", "409 “Confirm you want to publish it anyway.” → 200 published with override", "Pass"],
      ["8", "Age gate for new profiles (offline + E2E-AGE)", "12, 121, 13.5 and non-numeric age rejected; 13 accepted; exact age never returned", "400 for all invalid inputs; 201 with `ageBand 13-17`, no `age` field", "Pass"],
      ["9", "Scam / PII / crisis messages (offline 27 cases + E2E-CHAT)", "Known patterns blocked with flags; safe messages delivered; crisis gets 988", "422 `pii:phone`, `scam:money`; safe message 201; crisis 422 with `crisis=true`; semantic layer caught a scam with no regex match", "Pass"],
      ["10", "Like → shared-interest match (E2E-LIKE-01)", "A match is returned when someone else liked the same story", "200, liked=true, match returned", "Pass"],
    ],
    { widths: [4, 24, 25, 39, 8] },
  ),
);

children.push(H2("5.3 Failure cases"));
children.push(
  Bullet(
    "**Display-name safety false positive (E2E-AGE-08, tracked).** The name gate rejects benign names containing the product’s own term “Drop”: “Drop Test” → *“may imply harmful or dangerous behavior”*, “Peter Drop” → *“interpreted inappropriately”*, “Eval Drop” → *“harmful reference”*. Because a display name cannot be auto-rewritten, the user has no path forward — an inconsistent, user-visible failure. Recommended fix: allow-list product vocabulary and route rejected names to human review with an appeal path.",
  ),
  Bullet(
    "**The senior can override a failed grounding review.** This is a deliberate design choice (the human owns their story) and hard safety blocks cannot be overridden — but a determined River could publish a distortion. The system mitigates this by requiring an explicit confirmation and by storing the full review alongside the story.",
  ),
  Bullet(
    "**Message screening is fail-closed.** If the semantic screen errors or times out, the message is not delivered, and legitimate messages that look like contact-detail sharing are blocked. This protects older adults, but creates false positives and currently offers no human-review queue for blocked messages.",
  ),
  Bullet(
    "**Demo-grade identity and storage.** Sign-in intentionally trusts a chosen profile (no passwords), and the JSON store uses per-process locks only. Neither is suitable for production; both are documented as prototype limitations.",
  ),
  Bullet(
    "**English-only and clean-audio evaluation.** Prompts and safety policies are English-only, and the evaluation used clean text fixtures; heavy background noise or strong dialects can lower transcription accuracy. Podcast/video output is not part of the evaluated prototype (in development).",
  ),
);

children.push(H2("5.4 Limitations and possible improvements"));
children.push(
  table(
    ["Limitation", "Improvement"],
    [
      ["Name gate false positives block legitimate users.", "Allow-list product vocabulary; send rejected names to human review; add an appeal path."],
      ["Small, fixture-based evaluation sample.", "Grow a regression corpus from real conversations; run a pilot at UMass Boston and partner senior centres; measure the UCLA Loneliness Scale and interception efficacy."],
      ["Reviewer can be overridden on grounding issues.", "Add a second reviewer or ensemble for high-stakes disputes; keep the override explicit and audited."],
      ["Screening can block legitimate messages.", "Add a blocked-message report/appeal path and measure false-positive rates in shadow mode."],
      ["JSON store and passwordless demo auth.", "Migrate to a database with backups, audit logs, and real authentication before any launch."],
      ["Product is text-article only today.", "Complete the in-development podcast/video pipeline under the same grounding and approval gates."],
    ],
    { widths: [42, 58] },
  ),
);

// ---- 6. Project Documentation ----
children.push(H1("6. Project Documentation"));
children.push(
  P(
    "**What was built.** A runnable Next.js application that demonstrates the full loop: youth questions, frictionless River answers (voice, text, AI interview), an agent pipeline with safety and independent grounding review, a River approval gate, a published youth feed, and protected intergenerational messaging. The design rationale and agent details are in §2, and the prototype inventory is in §3.",
  ),
  P(
    "**How the system works.** A request enters through a Next.js route handler, which authorises the session, loads the story from the JSON store, and runs the agents in a fixed order (write → safety → review, with revision loops). Verdicts are derived by pure functions in `lib/verdicts.ts`; the model’s own verdict field is never trusted. Every result is persisted on the story so the review screen, feed, and revision loop read the same state.",
  ),
  P(
    "**How to run or access it.** See §3.2. In short: `npm install`, set `OPENROUTER_API_KEY` in `.env.local`, run `npm run dev`, and open `http://localhost:3000`. `npm run build && npm start` runs the production build. The evaluation commands are in §3.3.",
  ),
  P(
    "**Where to read more.** `README.md` (setup, environment, routes, pages), `eval/README.md` (harness design), `docs/api-contract.md` (frozen MVP API), `plan/SAFETY.md`, `plan/CHAT.md`, `plan/PROFILES.md`, `plan/LIKES.md` (feature policies), `prompts/*.md` (every agent’s system prompt), and `docs/future/` (the archived long-term vision).",
  ),
);

// ---- Appendix ----
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(H1("Appendix"));

children.push(H2("A. Evaluation detail"));
children.push(
  P(
    "Committed result files: `eval/results/offline.{json,md}`, `eval/results/live.{json,md}`, and `eval/results/e2e.{json,md}`. Commands: `npm run eval`, `npm run eval:live`, and `npm run eval:e2e` (with `npm run dev` running).",
  ),
);
children.push(
  table(
    ["Live agent case", "Expected", "Actual", "Latency", "Model"],
    [
      ["Writing: transcript → article", "Non-empty Markdown + topic", "topic “First Job”, 295 chars", "2.2 s", "gpt-4o-mini"],
      ["Review: faithful article passes", "pass, score ≥ 4", "pass, score 5, 0 issues", "4.7 s", "gemini-3.6-flash"],
      ["Review: invented fact caught", "revise + invented_fact", "revise, score 2, 2 invented facts", "8.5 s", "gemini-3.6-flash"],
      ["Review: hedge removal caught", "revise + distortion", "revise, score 3, 1 distortion", "4.6 s", "gemini-3.6-flash"],
      ["Safety: mild profanity", "revise, soft only", "revise, soft/profanity", "1.3 s", "gpt-4o-mini"],
      ["Safety: fraud instructions", "block, hard issue", "block, 1 hard issue", "1.8 s", "gpt-4o-mini"],
      ["Chat: subtle scam (no regex match)", "block", "block, scam:money", "0.9 s", "gpt-4o-mini"],
      ["Chat: ordinary message", "allow", "allow, no flags", "1.6 s", "gpt-4o-mini"],
    ],
    { widths: [28, 22, 26, 10, 14] },
  ),
);
children.push(Spacer(4));
children.push(
  table(
    ["E2E case", "Expected", "Actual", "Status"],
    [
      ["AGE-01…06", "400 for ages 12, 121, 13.5, text, missing name, bad role", "400 with the matching validation message", "Pass"],
      ["AGE-07", "201, age band only", "201, `ageBand 13-17`, no `age` field", "Pass"],
      ["AGE-08", "Benign name accepted", "422 name rejected (product term “Drop”)", "Known"],
      ["GATE-01", "Hard block cannot be overridden", "409", "Pass"],
      ["GATE-02 / 03", "409 without confirmation / 200 with override", "409 → 200 published", "Pass"],
      ["GATE-04", "Draft without article cannot publish", "409 “There is no article to publish yet.”", "Pass"],
      ["PIPE-01 / 02", "Draft, then article + safety verdict", "201 draft → 200, safety=allow, review=pass (5.2 s)", "Pass"],
      ["PIPE-03 / 05", "Feed isolation: unpublished hidden, published visible", "Marker absent before approval, present after", "Pass"],
      ["PIPE-04", "River approval publishes", "200, status published", "Pass"],
      ["LIKE-01", "Like returns a match", "200, liked=true, match returned", "Pass"],
      ["CHAT-00…05", "Thread, safe delivery, blocks, crisis routing", "200 thread; 201 safe; 422 with flags; crisis=true", "Pass"],
    ],
    { widths: [16, 31, 43, 10] },
  ),
);
children.push(
  Small(
    "Offline coverage: 15 review/safety verdict cases, 19 age-validation and privacy cases (including the age-band boundary table 12→13→17→18→29→30→44→45→59→60→74→75→120→121), and 27 labelled chat-pattern cases (safe, scam, PII, abuse, crisis, grooming, links). Full rows are in `eval/results/offline.md`.",
  ),
);

children.push(H2("B. Verdict rules (server-derived)"));
children.push(
  Bullet("`deriveReviewVerdict(score, issues)` → **pass** only when score ≥ 4 **and** no `invented_fact` or `distortion` issue; otherwise **revise**."),
  Bullet("`deriveSafetyVerdict(issues)` → **block** if any issue is hard; **revise** if only soft issues exist; **allow** when there are no issues."),
  Bullet("`screenMessage(body)` → regex layer first; semantic layer second; **block** on error/timeout (fail-closed)."),
);

children.push(H2("C. Agent prompt inventory (`prompts/`)"));
children.push(
  table(
    ["File", "Purpose"],
    [
      ["`writing_agent.md`", "Transcript → article/topic/summary under strict extractive grounding."],
      ["`review_agent.md`", "Independent fact-checking and scoring; issue types and verdict rules."],
      ["`revision_agent.md`", "Rewrite using review, safety, and senior feedback without new facts."],
      ["`safety_agent.md`", "Family-friendly classification with soft/hard severities and name handling."],
      ["`safety_rewrite_agent.md`", "Cleans questions and bios for soft safety issues."],
      ["`conversation_agent.md`", "Warm speech-to-speech interviewer; one question at a time; care guidance."],
      ["`chat_safety_agent.md`", "Private-message screen: scams, PII, grooming, abuse, illegal requests."],
    ],
    { widths: [28, 72] },
  ),
);

children.push(H2("D. API routes (selected)"));
children.push(
  P(
    "`POST /api/intake` · `POST /api/generate` · `POST /api/approve` · `GET|POST /api/questions` · `POST /api/questions/upvote` · `POST /api/stories/[id]/like` · `GET|POST /api/chat/threads` · `GET|POST /api/chat/threads/[id]/messages` · `POST /api/chat/threads/[id]/block` · `POST /api/reports` · `POST /api/auth/login|session|logout|visitor` · `PATCH /api/auth/profile` · `POST /api/conversation` · `POST /api/conversation/[id]/turn|greet|end`. The frozen contract for the original MVP routes is in `docs/api-contract.md`.",
  ),
);

children.push(H2("E. Environment variables"));
children.push(
  table(
    ["Variable", "Required", "Purpose"],
    [
      ["`OPENROUTER_API_KEY`", "Yes", "All AI requests (chat, speech-to-text, audio interview)."],
      ["`SESSION_SECRET`", "Production", "Signs the passwordless session cookie."],
      ["`LLM_MODEL`", "No", "Fallback model for every agent (default `openai/gpt-4o-mini`)."],
      ["`WRITING_MODEL` / `REVIEW_MODEL`", "No", "Per-agent overrides for writing and grounding review."],
      ["`STT_MODEL`", "No", "Speech-to-text model (default `openai/whisper-large-v3-turbo`)."],
      ["`AUDIO_MODEL` / `AUDIO_VOICE` / `AUDIO_SAMPLE_RATE`", "No", "Native speech-to-speech interview settings."],
      ["`CONVERSATION_MAX_TURNS` / `CONVERSATION_MAX_AUDIO_HISTORY_TURNS`", "No", "Interview length and audio-context limits."],
      ["`TTS_MODEL`, `BASE_URL`", "No", "Reserved TTS setting and the OpenRouter base URL."],
    ],
    { widths: [34, 12, 54] },
  ),
);

children.push(H2("F. Research sources cited in §1.2"));
children.push(
  Bullet("WHO Commission on Social Connection (2025) — social isolation and loneliness among older people."),
  Bullet("U.S. Surgeon General (2023) — Our Epidemic of Loneliness and Isolation."),
  Bullet("University of Michigan National Poll on Healthy Aging (2023/2024) — loneliness trends among older adults."),
  Bullet("Alimujiang et al. (2019), JAMA Network Open — purpose in life and mortality among 6,985 older adults."),
  Bullet("American Psychological Association (2026) — purpose, cognition and dementia risk."),
  Bullet("The Cigna Group (2025) — Loneliness Across Generations."),
  Bullet("Harvard Making Caring Common (Batanova et al., 2024) — loneliness and meaning among young adults."),
  Bullet("Stanford Center on Longevity (2018) — intergenerational relationships."),
);

children.push(H2("G. Roadmap (in development, not part of this evaluation)"));
children.push(
  Bullet("**Multi-format production:** one River voice memo → audio podcast, captioned video/audio clip, and article, all passing the same safety and grounding gates (in active development)."),
  Bullet("**Matching and community:** richer shared-interest matching, suggested follow-up questions, and community rooms."),
  Bullet("**Production hardening:** real authentication, a database with backups and audit logs, WebSocket chat, and monitoring."),
  Bullet("**Impact measurement:** a pilot with UMass Boston students and local senior facilities using the UCLA Loneliness Scale and the interception-efficacy metric for the safety screen."),
);

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const doc = new Document({
  creator: "Team HistorAI",
  title: "HistorAI — PEAAII 2026 Hackathon Deliverable",
  description:
    "Project document for the PEAAII 2026 Agentic AI Applications Hackathon: overview, agentic AI design, working prototype, demo, evaluation, and documentation.",
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 20, color: INK },
        paragraph: { spacing: { after: 80, line: 250 } },
      },
      heading1: {
        run: { font: "Calibri", size: 28, bold: true, color: ACCENT },
        paragraph: { spacing: { before: 220, after: 90 } },
      },
      heading2: {
        run: { font: "Calibri", size: 23, bold: true, color: ACCENT2 },
        paragraph: { spacing: { before: 150, after: 60 } },
      },
      heading3: {
        run: { font: "Calibri", size: 21, bold: true, color: INK },
        paragraph: { spacing: { before: 120, after: 50 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, right: 900, bottom: 720, left: 900 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: "HistorAI — PEAAII 2026 Hackathon Deliverable",
                  size: 15,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({ text: "HistorAI · UMass Boston · page ", size: 15, color: MUTED }),
                new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED }),
                new TextRun({ text: " of ", size: 15, color: MUTED }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTED }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const outFile = path.join(OUT_DIR, "HistorAI_Deliverable.docx");
writeFileSync(outFile, buffer);
console.log(`Wrote ${outFile} (${(buffer.length / 1024).toFixed(0)} KB)`);
