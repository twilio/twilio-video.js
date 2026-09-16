export type NoiseCancellationPlugin = {
  init(options: { rootDir: string }): Promise<void>;
  isInitialized(): boolean;
  isConnected(): boolean;
  isEnabled(): boolean;
  connect(input: MediaStream): MediaStream;
  disconnect(): void;
  enable(): void;
  disable(): void;
  destroy(): Promise<void>;
  setLogging(enable: boolean): void;
  isSupported(): boolean;
  getVersion(): string;
};
