'use strict';
import { DEFAULT_LOGGER_NAME, DEFAULT_LOG_LEVEL } from './util/constants';
import { AudioProcessor } from '../tsdef/AudioProcessor';
const Log = require('./util/log');

let nInstances = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any


// AudioProcessor needs SDK that implements following interface.
interface KrispSDK {
  init(isVad: boolean, audioContext: AudioContext|null, sdkRootPath: string): Promise<void>;
  isInitialized(): boolean;
  isConnected(): boolean;
  isEnabled(): boolean
  connect(input: MediaStream): MediaStream;
  disconnect(): void;
  enable(): void;
  disable(): void;
  destroy(): void;
  setLogging(enable: boolean): void;
}

// uses KrispSDK to provide AudioProcessor interface.
class KrispAdapter  {
  private _log: typeof Log;
  private _instanceId: number;

  constructor() {
    this._instanceId = nInstances++;
    this._log = new Log('default', this, DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME);
  }

  toString(): string {
    return `[KrispAudioProcessor #${this._instanceId}]`;
  }

  async init(krispSDKPath: string) : Promise<AudioProcessor> {
    try {
      this._log.debug('loading krisp sdk: ', krispSDKPath);
      const KrispModule = await import(/* webpackIgnore: true */ krispSDKPath + '/krispsdk.mjs');
      this._log.debug('Loaded krisp sdk:', KrispModule);
      const krisp = KrispModule.default as KrispSDK;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.Krisp = krisp;
      if (!krisp.isInitialized()) {
        // eslint-disable-next-line no-undefined
        this._log.debug('initializing krisp: ', krispSDKPath);
        await krisp.init(false /* isVad */, null /* audioContext */, krispSDKPath);
        this._log.debug('krisp initialized!');
      }

      return {
        isInitialized: () => krisp.isInitialized(),
        isConnected: () => krisp.isConnected(),
        isEnabled: () => krisp.isEnabled(),
        disconnect: () => krisp.disconnect(),
        enable: () => krisp.enable(),
        disable: () => krisp.disable(),
        connect: (sourceTrack: MediaStreamTrack) => {
          this._log.debug('process: ', sourceTrack.id);
          if (krisp.isConnected()) {
            krisp.disconnect();
          }

          const mediaStream = krisp.connect(new MediaStream([sourceTrack]));
          if (!mediaStream) {
            throw new Error('Error connecting to Krisp');
          }
          const cleanTrack = mediaStream.getAudioTracks()[0];
          if (!cleanTrack) {
            throw new Error('Error getting clean track from Krisp');
          }
          krisp.enable();
          return cleanTrack;
        },
        destroy: () => krisp.destroy(),
        setLogging: (enable: boolean) => krisp.setLogging(enable)
      };
    } catch (er) {
      this._log.error('Error loading krisp sdk:', er);
      throw er;
    }
  }
}

let krispAudioProcessor: AudioProcessor|null = null;
export async function createKrispAudioProcessor(krispSDKPath: string) : Promise<AudioProcessor> {
  if (!krispAudioProcessor) {
    const adapter = new KrispAdapter();
    krispAudioProcessor = await adapter.init(krispSDKPath);
  }
  return krispAudioProcessor;
}
