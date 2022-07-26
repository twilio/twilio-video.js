/* eslint-disable no-console */
'use strict';
import { AudioProcessor } from '../tsdef/AudioProcessor';
import { NoiseCancellationOptions } from '../tsdef/types';
const Log = require('./util/log');

const dynamicImport = require('./dynamicImport');
const KRISP_PLUGIN_FILE = 'krispsdk.mjs';
const RNNOISE_PLUGIN_FILE = 'rnnoise_sdk.mjs';

// AudioProcessor assumes following interface from the Plugin
interface NoiseCancellationPlugin {
  init(options: { rootDir: string }): Promise<void>;
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

let audioProcessors = new Map<string, AudioProcessor>();
export async function createNoiseCancellationAudioProcessor(
  noiseCancellationOptions: NoiseCancellationOptions,
  log: typeof Log
) : Promise<AudioProcessor> {
  let audioProcessor = audioProcessors.get(noiseCancellationOptions.vendor);
  if (!audioProcessor) {
    let sdkFilePath: string;
    let rootDir = noiseCancellationOptions.sdkAssetsPath;
    switch (noiseCancellationOptions.vendor) {
      case 'krisp':
        sdkFilePath = `${rootDir}/${KRISP_PLUGIN_FILE}`;
        break;
      case 'rnnoise':
        sdkFilePath = `${rootDir}/${RNNOISE_PLUGIN_FILE}`;
        break;
      default:
        throw new Error(`Unsupported NoiseCancellationOptions.vendor: ${noiseCancellationOptions.vendor}`);
    }

    try {
      log.debug('loading noise cancellation sdk: ', sdkFilePath);
      const dynamicModule = await dynamicImport(sdkFilePath);
      log.debug('Loaded noise cancellation sdk:', dynamicModule);
      const plugin = dynamicModule.default as NoiseCancellationPlugin;

      if (!plugin.isInitialized()) {
        log.debug('initializing noise cancellation sdk: ', rootDir);
        await plugin.init({ rootDir });
        log.debug('noise cancellation sdk initialized!');
      }

      audioProcessor = {
        vendor: noiseCancellationOptions.vendor,
        isInitialized: () => plugin.isInitialized(),
        isConnected: () => plugin.isConnected(),
        isEnabled: () => plugin.isEnabled(),
        disconnect: () => plugin.disconnect(),
        enable: () => plugin.enable(),
        disable: () => plugin.disable(),
        destroy: () => plugin.destroy(),
        setLogging: (enable: boolean) => plugin.setLogging(enable),
        connect: (sourceTrack: MediaStreamTrack) => {
          log.debug('connect: ', sourceTrack.id);
          if (plugin.isConnected()) {
            plugin.disconnect();
          }

          const mediaStream = plugin.connect(new MediaStream([sourceTrack]));
          if (!mediaStream) {
            throw new Error('Error connecting with noise cancellation sdk');
          }
          const cleanTrack = mediaStream.getAudioTracks()[0];
          if (!cleanTrack) {
            throw new Error('Error getting clean track from noise cancellation sdk');
          }
          plugin.enable();
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
