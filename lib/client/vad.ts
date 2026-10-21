export interface VadConfig {
  silenceMs: number;
  minSpeechMs: number;
  preRollMs: number;
  maxTurnMs: number;
  speechMultiplier: number;
  absoluteFloor: number;
  calibrationFrames: number;
  startFrames: number;
}

export type VadDecision = "start" | "end" | "none";

export const DEFAULT_VAD_CONFIG: VadConfig = {
  // Elderly users often pause to think, breathe, or remember. Never cut them
  // off after a normal 700–1000 ms silence timeout.
  silenceMs: 2_500,
  minSpeechMs: 400,
  preRollMs: 300,
  maxTurnMs: 90_000,
  speechMultiplier: 2.8,
  absoluteFloor: 0.006,
  calibrationFrames: 8,
  startFrames: 3,
};

/**
 * Lightweight adaptive-energy VAD. It deliberately preserves internal pauses;
 * only the silence at the end of a turn ends the recording.
 */
export class VoiceActivityDetector {
  private readonly config: VadConfig;
  private noiseFloor = 0.004;
  private calibrationFrames = 0;
  private speechFrames = 0;
  private speaking = false;
  private speechMs = 0;
  private silenceMs = 0;

  constructor(config: Partial<VadConfig> = {}) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
  }

  resetForNextTurn(): void {
    this.speechFrames = 0;
    this.speaking = false;
    this.speechMs = 0;
    this.silenceMs = 0;
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }

  get spokenMs(): number {
    return this.speechMs;
  }

  get threshold(): number {
    return Math.max(this.config.absoluteFloor, this.noiseFloor * this.config.speechMultiplier);
  }

  push(rms: number, frameMs: number): VadDecision {
    if (this.calibrationFrames < this.config.calibrationFrames) {
      this.noiseFloor = this.noiseFloor * 0.7 + rms * 0.3;
      this.calibrationFrames += 1;
      return "none";
    }

    const isSpeech = rms > this.threshold;

    if (!this.speaking) {
      if (!isSpeech) {
        this.noiseFloor = this.noiseFloor * 0.97 + rms * 0.03;
        this.speechFrames = 0;
        return "none";
      }

      this.speechFrames += 1;
      if (this.speechFrames < this.config.startFrames) {
        return "none";
      }

      this.speaking = true;
      this.speechMs = frameMs * this.speechFrames;
      this.silenceMs = 0;
      return "start";
    }

    if (isSpeech) {
      this.speechMs += frameMs;
      this.silenceMs = 0;
    } else {
      this.silenceMs += frameMs;
    }

    if (this.silenceMs >= this.config.silenceMs) {
      this.speaking = false;
      return "end";
    }

    return "none";
  }
}
