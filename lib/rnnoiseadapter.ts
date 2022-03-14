/* eslint-disable no-console */
'use strict';
import { DEFAULT_LOGGER_NAME, DEFAULT_LOG_LEVEL } from './util/constants';
import { AudioProcessor } from '../tsdef/AudioProcessor';
const Log = require('./util/log');

let nInstances = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any


// AudioProcessor needs SDK that implements following interface.
interface RNNoiseSDK {
  init(sdkRootPath: string): Promise<void>;
  isInitialized(): boolean;
  isConnected(): boolean;
  isEnabled(): boolean
  connect(input: MediaStream): MediaStream;
  disconnect(): void;
  enable(): void;
  disable(): void;
  destroy(): void;
  setLogging(enable: boolean):void;
}

class RNNoiseAdapter  {
  private _log: typeof Log;
  private _instanceId: number;

  constructor() {
    this._instanceId = nInstances++;
    this._log = new Log('default', this, DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME);
  }

  toString(): string {
    return `[RNNoiseAdapter #${this._instanceId}]`;
  }

  async init(rnnoiseSDKPath: string) : Promise<AudioProcessor> {
    try {
      this._log.debug('loading rnnoise sdk: ', rnnoiseSDKPath);
      const module = await import(/* webpackIgnore: true */ rnnoiseSDKPath + '/rnnoise_sdk.mjs');
      this._log.debug('Loaded rnnoise sdk:', module);
      const rnnoise = module.default as RNNoiseSDK;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.rnnoise = rnnoise;
      if (!rnnoise.isInitialized()) {
        // eslint-disable-next-line no-undefined
        this._log.debug('initializing rnnoise: ', rnnoiseSDKPath);
        await rnnoise.init(rnnoiseSDKPath);
        this._log.debug('rnnoise initialized!');
      }

      return {
        isInitialized: () => rnnoise.isInitialized(),
        isConnected: () => rnnoise.isConnected(),
        isEnabled: () => rnnoise.isEnabled(),
        disconnect: () => rnnoise.disconnect(),
        enable: () => rnnoise.enable(),
        disable: () => rnnoise.disable(),
        destroy: () => rnnoise.destroy(),
        setLogging: (enable: boolean) => rnnoise.setLogging(enable),
        connect: (sourceTrack: MediaStreamTrack) => {
          this._log.debug('connect: ', sourceTrack.id);
          if (rnnoise.isConnected()) {
            rnnoise.disconnect();
          }

          const mediaStream = rnnoise.connect(new MediaStream([sourceTrack]));
          if (!mediaStream) {
            throw new Error('Error connecting to rnnoise');
          }
          const cleanTrack = mediaStream.getAudioTracks()[0];
          if (!cleanTrack) {
            throw new Error('Error getting clean track from rnnoise');
          }
          rnnoise.enable();
          return cleanTrack;
        },
      };
    } catch (er) {
      this._log.error('Error loading rnnoise sdk:', er);
      throw er;
    }
  }
}

let rnnoiseAudioProcessor: AudioProcessor|null = null;
export async function createRNNoiseAudioProcessor(rnnoiseSDKPath: string) : Promise<AudioProcessor> {
  if (!rnnoiseAudioProcessor) {
    const adapter = new RNNoiseAdapter();
    rnnoiseAudioProcessor = await adapter.init(rnnoiseSDKPath);
  }
  return rnnoiseAudioProcessor;
}
