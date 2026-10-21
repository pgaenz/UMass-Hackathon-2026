import type {
  AudioChatContentPart,
  AudioChatMessage,
} from "./audio-chat";
import { readAudioFileAsBase64 } from "./audio";
import { config } from "./config";
import { loadPrompt } from "./prompts";
import type { Conversation } from "./types";

const MAX_HISTORY_TEXT_CHARS = 8_000;

function trimHistory(text: string): string {
  return text.length > MAX_HISTORY_TEXT_CHARS
    ? `${text.slice(0, MAX_HISTORY_TEXT_CHARS)}…`
    : text;
}

export async function buildConversationSystemMessage(
  conversation: Conversation,
): Promise<AudioChatMessage> {
  const persona = await loadPrompt("conversation_agent");
  return {
    role: "system",
    content: [
      persona.trim(),
      "INTERVIEW QUESTION:",
      conversation.prompt || "Ask the senior about an important memory from their life.",
      "Remember: your words are spoken aloud. Write exactly what you would say.",
    ].join("\n\n"),
  };
}

/** Builds the stateless message history for one new turn. */
export async function buildConversationMessages(
  conversation: Conversation,
  current: { audioBase64: string | null; text: string },
): Promise<AudioChatMessage[]> {
  const messages: AudioChatMessage[] = [
    await buildConversationSystemMessage(conversation),
  ];

  const userTurns = conversation.turns.filter((turn) => Boolean(turn.user));
  const audioTurnIds = new Set(
    userTurns
      .slice(-Math.max(0, config.maxConversationAudioHistory))
      .map((turn) => turn.id),
  );

  for (const turn of conversation.turns) {
    if (turn.assistant?.text.trim()) {
      messages.push({ role: "assistant", content: turn.assistant.text.trim() });
    }

    if (!turn.user) {
      continue;
    }

    const text = trimHistory(turn.user.text.trim());
    const includeAudio = audioTurnIds.has(turn.id);
    const audioBase64 =
      includeAudio && turn.user.audioPath
        ? await readAudioFileAsBase64(turn.user.audioPath)
        : null;

    if (audioBase64) {
      const content: AudioChatContentPart[] = [
        {
          type: "input_audio",
          input_audio: { data: audioBase64, format: "wav" },
        },
      ];
      if (text) {
        content.push({
          type: "text",
          text: `Transcript of that recording (for reference only): ${text}`,
        });
      }
      messages.push({ role: "user", content });
    } else if (text) {
      messages.push({ role: "user", content: text });
    }
  }

  if (current.audioBase64) {
    const content: AudioChatContentPart[] = [
      {
        type: "input_audio",
        input_audio: { data: current.audioBase64, format: "wav" },
      },
      {
        type: "text",
        text: "The senior just said this. Respond naturally to their words and tone.",
      },
    ];
    messages.push({ role: "user", content });
  } else if (current.text.trim()) {
    messages.push({ role: "user", content: current.text.trim() });
  }

  return messages;
}

export async function buildGreetingMessages(
  conversation: Conversation,
): Promise<AudioChatMessage[]> {
  return [
    await buildConversationSystemMessage(conversation),
    {
      role: "user",
      content:
        "Begin the interview now. Greet the senior warmly in one short sentence, then ask the interview question in your own gentle words. Do not mention that you are an AI or read the question like a script.",
    },
  ];
}
