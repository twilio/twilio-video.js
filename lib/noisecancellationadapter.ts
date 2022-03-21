/* eslint-disable no-console */
'use strict';
import { DEFAULT_LOGGER_NAME, DEFAULT_LOG_LEVEL } from './util/constants';
import { AudioProcessor } from '../tsdef/AudioProcessor';
const Log = require('./util/log');

const dynamicImport = require('./dynamicImport');

let nInstances = 0;

// AudioProcessor needs SDK that implements following interface.
interface NoiseCancellationSDK {
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

class NoiseCancellationAdapter  {
  private _log: typeof Log;
  private _instanceId: number;

  constructor() {
    this._instanceId = nInstances++;
    this._log = new Log('default', this, DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME);
  }

  toString(): string {
    return `[NoiseCancellationAdapter #${this._instanceId}]`;
  }

  async init(sdkRootPath: string, sdkFile: string) : Promise<AudioProcessor> {
    try {
      this._log.debug('loading noise cancellation sdk: ', sdkRootPath);
      const dynamicModule = await dynamicImport(`${sdkRootPath}/${sdkFile}`);
      this._log.debug('Loaded noise cancellation sdk:', dynamicModule);
      const sdkAPI = dynamicModule.default as NoiseCancellationSDK;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.noiseCancellationSDK = sdkAPI;
      if (!sdkAPI.isInitialized()) {
        this._log.debug('initializing noise cancellation sdk: ', sdkRootPath);
        await sdkAPI.init(sdkRootPath);
        this._log.debug('noise cancellation sdk initialized!');
      }

      return {
        isInitialized: () => sdkAPI.isInitialized(),
        isConnected: () => sdkAPI.isConnected(),
        isEnabled: () => sdkAPI.isEnabled(),
        disconnect: () => sdkAPI.disconnect(),
        enable: () => sdkAPI.enable(),
        disable: () => sdkAPI.disable(),
        destroy: () => sdkAPI.destroy(),
        setLogging: (enable: boolean) => sdkAPI.setLogging(enable),
        connect: (sourceTrack: MediaStreamTrack) => {
          this._log.debug('connect: ', sourceTrack.id);
          if (sdkAPI.isConnected()) {
            sdkAPI.disconnect();
          }

          const mediaStream = sdkAPI.connect(new MediaStream([sourceTrack]));
          if (!mediaStream) {
            throw new Error('Error connecting with noise cancellation sdk');
          }
          const cleanTrack = mediaStream.getAudioTracks()[0];
          if (!cleanTrack) {
            throw new Error('Error getting clean track from noise cancellation sdk');
          }
          sdkAPI.enable();
          return cleanTrack;
        },
      };
    } catch (er) {
      this._log.error('Error loading noise cancellation sdk:', er);
      throw er;
    }
  }
}

// this version allows only one instance.
// let audioProcessor: AudioProcessor|null = null;
// export async function createNoiseCancellationAudioProcessor(sdkRootPath: string, sdkFile: string) : Promise<AudioProcessor> {
//   if (!audioProcessor) {
//     const adapter = new NoiseCancellationAdapter();
//     audioProcessor = await adapter.init(sdkRootPath, sdkFile);
//   }
//   return audioProcessor;
// }

export async function createNoiseCancellationAudioProcessor(sdkRootPath: string, sdkFile: string) : Promise<AudioProcessor> {
  const adapter = new NoiseCancellationAdapter();
  const audioProcessor = await adapter.init(sdkRootPath, sdkFile);
  return audioProcessor;
}
