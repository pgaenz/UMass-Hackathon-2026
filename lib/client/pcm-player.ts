/**
 * Plays raw PCM16 chunks returned by gpt-audio-mini. OpenRouter only supports
 * pcm16 while streaming, so we schedule the chunks ourselves instead of using
 * an <audio> element.
 */
export class PcmPlayer {
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;

  private getAudioContextConstructor(): typeof AudioContext | null {
    return (
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      null
    );
  }

  async ensure(): Promise<void> {
    if (!this.context) {
      const AudioCtor = this.getAudioContextConstructor();
      if (!AudioCtor) {
        throw new Error("This browser does not support audio playback.");
      }
      this.context = new AudioCtor();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async playBase64(data: string, sampleRate: number): Promise<void> {
    await this.ensure();
    const context = this.context;
    if (!context) {
      return;
    }

    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const sampleCount = Math.floor(bytes.byteLength / 2);
    if (sampleCount === 0) {
      return;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
    const samples = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i += 1) {
      samples[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    buffer.copyToChannel(samples, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime + 0.04, this.nextStartTime);
    this.nextStartTime = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
    source.start(startAt);
  }

  stop(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources.clear();
    this.nextStartTime = 0;
  }

  /** Waits until all scheduled chunks have finished playing. */
  async waitForIdle(signal?: AbortSignal): Promise<void> {
    while (this.context && this.nextStartTime > this.context.currentTime + 0.03) {
      if (signal?.aborted) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  async close(): Promise<void> {
    this.stop();
    const context = this.context;
    this.context = null;
    if (context) {
      await context.close().catch(() => undefined);
    }
  }
}
