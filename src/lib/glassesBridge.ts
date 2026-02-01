export type SensorSample = {
  headMotion: "nod" | "shake" | "steady";
  brightness: number; // 0..1
  temp: number; // Celsius
};

export interface GlassesBridge {
  start(onSample: (s: SensorSample) => void): void;
  stop(): void;
  isRunning(): boolean;
}

class SimulatedGlassesBridge implements GlassesBridge {
  private timer: any = null;
  private running = false;

  start(onSample: (s: SensorSample) => void) {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      const sample: SensorSample = {
        headMotion:
          Math.random() > 0.8 ? "nod" : Math.random() > 0.8 ? "shake" : "steady",
        brightness: 0.5 + Math.random() * 0.5,
        temp: 20 + Math.random() * 6,
      };
      onSample(sample);
    }, 800);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  isRunning() {
    return this.running;
  }
}

export function createBridge(kind: "simulated" = "simulated"): GlassesBridge {
  switch (kind) {
    case "simulated":
    default:
      return new SimulatedGlassesBridge();
  }
}
