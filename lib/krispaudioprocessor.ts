'use strict';
import { AudioProcessor } from '../tsdef/AudioProcessor';
import { DEFAULT_LOGGER_NAME, DEFAULT_LOG_LEVEL } from './util/constants';
const Log = require('./util/log');

let nInstances = 0;
let Krisp: any = null;
const krispModulePath = '/krisp/krispsdk.mjs';

class KrispAudioProcessor implements AudioProcessor {
  krispSDKPath: string;
  private _log: typeof Log;
  private _instanceId: number;


  constructor(krispSDKPath: string) {
    this._instanceId = nInstances++;
    this.krispSDKPath = krispSDKPath;
    this._log = new Log('default', this, DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME);
  }

  toString(): string {
    return `[KrispAudioProcessor #${this._instanceId}]`;
  }

  async _loadKrispSDK() {
    if (!Krisp) {
      try {
      this._log.debug('loading krisp sdk: ', this.krispSDKPath);
      const KrispModule = await import(/* webpackIgnore: true */ this.krispSDKPath + '/krispsdk.mjs');
      Krisp = KrispModule.default;

      // @ts-ignore
      window.Krisp = Krisp;
      this._log.debug('Loaded krisp sdk:', Krisp);
      } catch (er) {
        this._log.err('Error loading krisp sdk:', er);
        throw er;
      }
    }
    return Krisp;
  }

  async _processInternal(sourceTrack: MediaStreamTrack): Promise<MediaStreamTrack> {
    if (!(sourceTrack instanceof MediaStreamTrack)) {
      throw new Error('Invalid argument: sourceTrack must be a MediaStreamTrack');
    }

    const krisp = await this._loadKrispSDK();
    if (!krisp.isInitialized()) {
      await krisp.init(false /* isVad */, undefined /* audioContext */, this.krispSDKPath);
    }

    if (krisp.isConnected()) {
      Krisp.disconnect();
    }

    const mediaStream = krisp.connect(new MediaStream([sourceTrack]));
    if (!mediaStream) {
      throw new Error('Error connecting to Krisp');
    }
    const cleanTrack = mediaStream.getAudioTracks()[0];
    if (!cleanTrack) {
      throw new Error('Error getting clean track from Krisp');
    }
    Krisp.enable();
    return cleanTrack;
  }
  /**
   * Processes {@link PreflightTest}.
   * @param {MediaStreamTrack} sourceTrack
   * @returns {Promise<MediaStreamTrack>} a clean track with noise removed.
   */
  process(sourceTrack: MediaStreamTrack) : Promise<MediaStreamTrack> {
    this._log.debug('process: ', sourceTrack.id);
    return this._processInternal(sourceTrack);
  }


  isEnabled() : boolean {
    return Krisp && Krisp.isEnabled();
  }

  enable() : void {
    this._log.debug('enable');
    Krisp && Krisp.enable();
  }

  disable() : void {
    this._log.debug('disable');
    Krisp && Krisp.disable();
  }

  disconnect() : void {
    this._log.debug('disconnect');
    Krisp && Krisp.disconnect();
  }
}

export function createKrispAudioProcessor(krispSDKPath: string) {
  return new KrispAudioProcessor(krispSDKPath);
}