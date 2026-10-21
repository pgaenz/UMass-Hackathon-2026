import { concatFloat32, encodeWav, resampleLinear } from "./wav";
import { DEFAULT_VAD_CONFIG, VoiceActivityDetector, type VadConfig } from "./vad";

const TARGET_SAMPLE_RATE = 24_000;
const PROCESSOR_BUFFER_SIZE = 4_096;

export interface ConversationRecorderCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd: (audio: Blob | null, durationMs: number) => void;
  onLevel?: (rms: number) => void;
}

export class ConversationRecorder {
  private readonly callbacks: ConversationRecorderCallbacks;
  private readonly vad: VoiceActivityDetector;
  private readonly preRollFrames: Float32Array[] = [];
  private recordedFrames: Float32Array[] = [];
  private enabled = false;
  private speaking = false;
  private recordStartedAt = 0;

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private frameMs = 0;

  constructor(
    callbacks: ConversationRecorderCallbacks,
    vadConfig: Partial<VadConfig> = {},
  ) {
    this.callbacks = callbacks;
    this.vad = new VoiceActivityDetector(vadConfig);
  }

  async start(): Promise<void> {
    if (this.context) {
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const AudioCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      throw new Error("This browser does not support audio recording.");
    }

    const context = new AudioCtor();
    if (context.state === "suspended") {
      await context.resume();
    }

    const source = context.createMediaStreamSource(this.stream);
    const processor = context.createScriptProcessor(
      PROCESSOR_BUFFER_SIZE,
      1,
      1,
    );
    const silentGain = context.createGain();
    silentGain.gain.value = 0;

    this.frameMs = (PROCESSOR_BUFFER_SIZE / context.sampleRate) * 1000;
    processor.onaudioprocess = (event) => this.handleAudio(event);

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(context.destination);

    this.context = context;
    this.source = source;
    this.processor = processor;
    this.silentGain = silentGain;
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) {
      this.enabled = false;
      this.speaking = false;
      this.recordedFrames = [];
      this.preRollFrames.length = 0;
      this.vad.resetForNextTurn();
      return;
    }

    this.enabled = true;
    this.speaking = false;
    this.recordedFrames = [];
    this.preRollFrames.length = 0;
    this.vad.resetForNextTurn();
  }

  private handleAudio(event: AudioProcessingEvent): void {
    if (!this.enabled || !this.context) {
      return;
    }

    const frame = new Float32Array(event.inputBuffer.getChannelData(0));
    const rms = this.computeRms(frame);
    this.callbacks.onLevel?.(rms);

    const decision = this.vad.push(rms, this.frameMs);

    if (decision === "start") {
      this.speaking = true;
      this.recordedFrames = [...this.preRollFrames, frame];
      this.preRollFrames.length = 0;
      this.recordStartedAt = performance.now();
      this.callbacks.onSpeechStart?.();
      return;
    }

    if (this.speaking) {
      this.recordedFrames.push(frame);
      const reachedMaxTurn =
        performance.now() - this.recordStartedAt >= DEFAULT_VAD_CONFIG.maxTurnMs;
      if (decision === "end" || reachedMaxTurn) {
        this.finishTurn();
      }
      return;
    }

    this.preRollFrames.push(frame);
    this.trimPreRoll();
  }

  private finishTurn(): void {
    if (!this.context) {
      return;
    }

    const spokenMs = this.vad.spokenMs;
    const frames = this.recordedFrames;
    this.recordedFrames = [];
    this.preRollFrames.length = 0;
    this.speaking = false;
    this.enabled = false;
    this.vad.resetForNextTurn();

    if (spokenMs < DEFAULT_VAD_CONFIG.minSpeechMs || frames.length === 0) {
      this.callbacks.onSpeechEnd(null, 0);
      return;
    }

    const merged = concatFloat32(frames);
    const resampled = resampleLinear(merged, this.context.sampleRate, TARGET_SAMPLE_RATE);
    const durationMs = Math.round((merged.length / this.context.sampleRate) * 1000);
    this.callbacks.onSpeechEnd(encodeWav(resampled, TARGET_SAMPLE_RATE), durationMs);
  }

  private trimPreRoll(): void {
    const maxFrames = Math.max(
      1,
      Math.ceil(DEFAULT_VAD_CONFIG.preRollMs / Math.max(1, this.frameMs)),
    );
    while (this.preRollFrames.length > maxFrames) {
      this.preRollFrames.shift();
    }
  }

  private computeRms(frame: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frame.length; i += 1) {
      sum += frame[i] * frame[i];
    }
    return Math.sqrt(sum / frame.length);
  }

  async stop(): Promise<void> {
    this.enabled = false;
    this.speaking = false;
    this.recordedFrames = [];
    this.preRollFrames.length = 0;

    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
    }
    this.source?.disconnect();
    this.silentGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());

    const context = this.context;
    this.processor = null;
    this.source = null;
    this.silentGain = null;
    this.stream = null;
    this.context = null;

    if (context) {
      await context.close().catch(() => undefined);
    }
  }
}
