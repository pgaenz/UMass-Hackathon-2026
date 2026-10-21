import { promises as fs } from "node:fs";
import path from "node:path";

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationMs: number;
}

export function isWav(buffer: Buffer): boolean {
  return (
    buffer.length >= 44 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  );
}

/** Reads the common PCM WAV header fields needed for size/duration checks. */
export function readWavInfo(buffer: Buffer): WavInfo | null {
  if (!isWav(buffer)) {
    return null;
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt " && chunkStart + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataBytes = Math.min(chunkSize, buffer.length - chunkStart);
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!sampleRate || !channels || !bitsPerSample || !dataBytes) {
    return null;
  }

  const bytesPerFrame = channels * (bitsPerSample / 8);
  const frames = bytesPerFrame > 0 ? dataBytes / bytesPerFrame : 0;
  return {
    sampleRate,
    channels,
    bitsPerSample,
    durationMs: Math.round((frames / sampleRate) * 1000),
  };
}

export function base64FromBuffer(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function absoluteAudioPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

/** Reads a stored upload as base64 for replay in the conversation history. */
export async function readAudioFileAsBase64(relativePath: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(absoluteAudioPath(relativePath));
    return base64FromBuffer(buffer);
  } catch {
    return null;
  }
}
