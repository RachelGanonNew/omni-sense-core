export type LiveVoiceConfig = {
  apiKey?: string;
  model?: string;
};

export class LiveVoiceClient {
  private running = false;
  constructor(private cfg: LiveVoiceConfig = {}) {}

  isRunning() {
    return this.running;
  }

  async start(): Promise<void> {
    // Placeholder: real implementation would open a streaming session
    this.running = true;
  }

  async stop(): Promise<void> {
    // Placeholder: close streaming session
    this.running = false;
  }

  async say(_text: string): Promise<void> {
    // Placeholder: in Live mode would stream audio; for now, no-op
  }
}

export function createLiveVoice(cfg: LiveVoiceConfig = {}): LiveVoiceClient {
  return new LiveVoiceClient(cfg);
}
