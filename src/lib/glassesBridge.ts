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
  // simple smoothing buffer
  private bBuf: number[] = [];
  private tBuf: number[] = [];

  start(onSample: (s: SensorSample) => void) {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      const rawBrightness = 0.5 + Math.random() * 0.5;
      const rawTemp = 20 + Math.random() * 6;
      this.bBuf.push(rawBrightness);
      this.tBuf.push(rawTemp);
      if (this.bBuf.length > 4) this.bBuf.shift();
      if (this.tBuf.length > 4) this.tBuf.shift();
      const brightness = this.bBuf.reduce((a, c) => a + c, 0) / this.bBuf.length;
      const temp = this.tBuf.reduce((a, c) => a + c, 0) / this.tBuf.length;
      const sample: SensorSample = {
        headMotion: Math.random() > 0.8 ? "nod" : Math.random() > 0.8 ? "shake" : "steady",
        brightness,
        temp,
      };
      onSample(sample);
    }, 800);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.bBuf = [];
    this.tBuf = [];
  }

  isRunning() {
    return this.running;
  }
}

class VendorXGlassesBridge implements GlassesBridge {
  private running = false;
  private timer: any = null;
  start(onSample: (s: SensorSample) => void): void {
    if (this.running) return;
    this.running = true;
    // Placeholder: simulate pairing delay, then emit samples at a different cadence
    const startEmit = () => {
      this.timer = setInterval(() => {
        const sample: SensorSample = {
          headMotion: Math.random() > 0.9 ? "nod" : Math.random() > 0.9 ? "shake" : "steady",
          brightness: 0.4 + Math.random() * 0.6,
          temp: 21 + Math.random() * 4,
        };
        onSample(sample);
      }, 1000);
    };
    setTimeout(startEmit, 700);
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }
  isRunning(): boolean {
    return this.running;
  }
}

export type BridgeKind = "simulated" | "vendorX";
export function createBridge(kind: BridgeKind = "simulated"): GlassesBridge {
  switch (kind) {
    case "vendorX":
      return new VendorXGlassesBridge();
    case "simulated":
    default:
      return new SimulatedGlassesBridge();
  }
}
