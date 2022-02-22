'use strict';
import { AudioProcessor } from '../tsdef/AudioProcessor';

let Krisp: any = null;
const krispModulePath = '/krisp/krispsdk.mjs';

export class KrispAudioProcessor implements AudioProcessor {
  krispSDKPath: string;

  KrispAudioProcessor(krispSDKPath: string) {
    this.krispSDKPath = krispSDKPath;
  }

  async _loadKrispSDK() {
    if (!Krisp) {

      console.log('loading krisp sdk');
      const KrispModule = await import(/* webpackIgnore: true */ krispModulePath);
      Krisp = KrispModule.default;

      // @ts-ignore
      window.Krisp = Krisp;

      console.log('Loaded krisp sdk:', Krisp);
    }
    return Krisp;
  }

  async _processInternal(sourceTrack: MediaStreamTrack): Promise<MediaStreamTrack> {
    if (!(sourceTrack instanceof MediaStreamTrack)) {
      throw new Error('Invalid argument: sourceTrack must be a MediaStreamTrack');
    }

    const krisp = await this._loadKrispSDK();

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
    return this._processInternal(sourceTrack);
  }


  isEnabled() : boolean {
    return Krisp && Krisp.isEnabled();
  }

  enable() : void {
    Krisp && Krisp.enable();
  }

  disable() : void {
    Krisp && Krisp.disable();
  }

  disconnect() : void {
    Krisp.disconnect();
  }
}
