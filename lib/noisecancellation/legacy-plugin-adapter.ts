import type { NoiseCancellationPlugin } from './plugin';

const AudioContextFactory = require('../webaudio/audiocontext');

// Legacy Krisp 1.x and rnnoise 0.x
export type LegacyPlugin = {
  init(options: { rootDir: string }): Promise<void>;
  isInitialized(): boolean;
  isConnected(): boolean;
  isEnabled(): boolean;
  connect(input: MediaStream): MediaStream;
  disconnect(): void;
  enable(): void;
  disable(): void;
  destroy(): void;
  setLogging(enable: boolean): void;
  isSupported(audioContext: AudioContext): boolean;
  getVersion(): string;
}

export class LegacyPluginAdapter implements NoiseCancellationPlugin {
  private readonly legacy: LegacyPlugin;

  constructor(legacy: LegacyPlugin) {
    this.legacy = legacy;
  }

  init(options: { rootDir: string }): Promise<void> { return this.legacy.init(options); }
  isInitialized(): boolean { return this.legacy.isInitialized(); }
  isConnected(): boolean { return this.legacy.isConnected(); }
  isEnabled(): boolean { return this.legacy.isEnabled(); }
  connect(input: MediaStream): MediaStream { return this.legacy.connect(input); }
  disconnect(): void { this.legacy.disconnect(); }
  enable(): void { this.legacy.enable(); }
  disable(): void { this.legacy.disable(); }
  setLogging(enable: boolean): void { this.legacy.setLogging(enable); }
  getVersion(): string { return this.legacy.getVersion(); }

  isSupported(): boolean {
    const holder = {};
    const ctx = AudioContextFactory.getOrCreate(holder);
    try {
      return this.legacy.isSupported(ctx);
    } finally {
      AudioContextFactory.release(holder);
    }
  }

  destroy(): Promise<void> {
    this.legacy.destroy();
    return Promise.resolve();
  }
}
