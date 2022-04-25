/* eslint-disable no-console */
'use strict';
import { AudioProcessor } from '../tsdef/AudioProcessor';
import { NoiseCancellationOptions } from '../tsdef/types';
const Log = require('./util/log');

const dynamicImport = require('./dynamicImport');

const KRISP_VERSION = '1.0.0';
const RNNOISE_VERSION = '1.0.0';
const KRISP_SDK_FILE = 'krispsdk.mjs';
const RNNOISE_SDK_FILE = 'rnnoise_sdk.mjs';

// AudioProcessor assumes following interface from the SDK
interface NoiseCancellationSDK {
  init(options: { rootDir: string }): Promise<void>;
  isInitialized(): boolean;
  isConnected(): boolean;
  isEnabled(): boolean
  connect(input: MediaStream): Promise<MediaStream>;
  disconnect(): void;
  enable(): void;
  disable(): void;
  destroy(): void;
  setLogging(enable: boolean):void;
}

let audioProcessors = new Map<string, AudioProcessor>();
export async function createNoiseCancellationAudioProcessor(
  noiseCancellationOptions: NoiseCancellationOptions,
  log: typeof Log
) : Promise<AudioProcessor> {
  let audioProcessor = audioProcessors.get(noiseCancellationOptions.vendor);
  if (!audioProcessor) {
    let sdkFilePath: string;
    let rootDir: string;
    switch (noiseCancellationOptions.vendor) {
      case 'krisp':
        rootDir = `${noiseCancellationOptions.sdkAssetsPath}/${KRISP_VERSION}`;
        sdkFilePath = `${rootDir}/${KRISP_SDK_FILE}`;
        break;
      case 'rnnoise':
        rootDir = `${noiseCancellationOptions.sdkAssetsPath}/${RNNOISE_VERSION}`;
        sdkFilePath = `${rootDir}/${RNNOISE_SDK_FILE}`;
        break;
      default:
        throw new Error(`Unsupported NoiseCancellationOptions.vendor: ${noiseCancellationOptions.vendor}`);
    }

    try {
      log.debug('loading noise cancellation sdk: ', sdkFilePath);
      const dynamicModule = await dynamicImport(sdkFilePath);
      log.debug('Loaded noise cancellation sdk:', dynamicModule);
      const sdkAPI = dynamicModule.default as NoiseCancellationSDK;

      if (!sdkAPI.isInitialized()) {
        log.debug('initializing noise cancellation sdk: ', rootDir);
        await sdkAPI.init({ rootDir });
        log.debug('noise cancellation sdk initialized!');
      }

      audioProcessor = {
        vendor: noiseCancellationOptions.vendor,
        isInitialized: () => sdkAPI.isInitialized(),
        isConnected: () => sdkAPI.isConnected(),
        isEnabled: () => sdkAPI.isEnabled(),
        disconnect: () => sdkAPI.disconnect(),
        enable: () => sdkAPI.enable(),
        disable: () => sdkAPI.disable(),
        destroy: () => sdkAPI.destroy(),
        setLogging: (enable: boolean) => sdkAPI.setLogging(enable),
        connect: async (sourceTrack: MediaStreamTrack) => {
          log.debug('connect: ', sourceTrack.id);
          if (sdkAPI.isConnected()) {
            sdkAPI.disconnect();
          }

          const mediaStream = await sdkAPI.connect(new MediaStream([sourceTrack]));
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
      audioProcessors.set(noiseCancellationOptions.vendor, audioProcessor);

    } catch (er) {
      log.error(`Error loading noise cancellation sdk:${sdkFilePath}`, er);
      throw er;
    }
  }
  return audioProcessor;
}
