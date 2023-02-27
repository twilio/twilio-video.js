'use strict';

import { AudioProcessor } from '../tsdef/AudioProcessor';
import { NoiseCancellationOptions } from '../tsdef/types';

const dynamicImport = require('./util/dynamicimport');
const Log = require('./util/log');

const PLUGIN_CONFIG = {
  krisp: {
    supportedVersion: '1.0.0',
    pluginFile: 'krispsdk.mjs'
  },
  rnnoise: {
    supportedVersion: '0.6.0',
    pluginFile: 'rnnoise_sdk.mjs'
  }
};

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
  isSupported(audioContext: AudioContext):boolean;
  getVersion(): string;
}

const ensureVersionSupported = ({ supportedVersion, plugin, log }: {supportedVersion: string, plugin: NoiseCancellationPlugin, log: typeof Log}) : void => {
  if (!plugin.getVersion || !plugin.isSupported) {
    throw new Error('Plugin does not export getVersion/isSupported api. Are you using old version of the plugin ?');
  }

  const pluginVersion = plugin.getVersion();
  log.debug(`Plugin Version = ${pluginVersion}`);
  const supportedVersions = supportedVersion.split('.').map(version => Number(version));
  const pluginVersions = pluginVersion.split('.').map(version => Number(version));
  if (supportedVersions.length !== 3 || pluginVersions.length !== 3) {
    throw new Error(`Unsupported Plugin version format: ${supportedVersion}, ${pluginVersion}`);
  }

  if (supportedVersions[0] !== pluginVersions[0]) {
    throw new Error(`Major version mismatch: [Plugin version ${pluginVersion}],  [Supported Version ${supportedVersion}]`);
  }

  if (pluginVersions[1] < supportedVersions[1]) {
    throw new Error(`Minor version mismatch: [Plugin version ${pluginVersion}] < [Supported Version ${supportedVersion}]`);
  }

  const tempContext = new AudioContext();
  const isSupported = plugin.isSupported(tempContext);
  tempContext.close();
  if (!isSupported) {
    throw new Error('Noise Cancellation plugin is not supported on your browser');
  }
};

let audioProcessors = new Map<string, AudioProcessor>();
export async function createNoiseCancellationAudioProcessor(
  noiseCancellationOptions: NoiseCancellationOptions,
  log: typeof Log
) : Promise<AudioProcessor> {
  let audioProcessor = audioProcessors.get(noiseCancellationOptions.vendor);
  if (!audioProcessor) {
    let pluginConfig = PLUGIN_CONFIG[noiseCancellationOptions.vendor];
    if (!pluginConfig) {
      throw new Error(`Unsupported NoiseCancellationOptions.vendor: ${noiseCancellationOptions.vendor}`);
    }

    const { supportedVersion, pluginFile } =  pluginConfig;
    const  rootDir = noiseCancellationOptions.sdkAssetsPath;
    const  sdkFilePath = `${rootDir}/${pluginFile}`;

    try {
      log.debug('loading noise cancellation sdk: ', sdkFilePath);
      const dynamicModule = await dynamicImport(sdkFilePath);
      log.debug('Loaded noise cancellation sdk:', dynamicModule);

      const plugin = dynamicModule.default as NoiseCancellationPlugin;
      ensureVersionSupported({
        supportedVersion,
        plugin,
        log
      });

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
