import { NoiseCancellationVendor } from './types';

export interface AudioProcessor {
  /**
   * @property {NoiseCancellationVendor} vendor
   */
  vendor: NoiseCancellationVendor;

  /**
   * connects and cleans given stream
   * @returns {MediaStreamTrack} clean track
   */
  connect: (sourceTrack: MediaStreamTrack) => MediaStreamTrack

  /**
   * checks if AudioProcessor is currently enabled
   * @returns {boolean} true if audio processor is enabled.
   */
  isEnabled: () => boolean;

  /**
   * checks if AudioProcessor is initialized (not destroyed)
   * @returns {boolean} true if audio processor is initialized.
   */
  isInitialized(): boolean;

  /**
   * checks if AudioProcessor is connected to a stream
   * @returns {boolean} true if a stream is connected.
   */
  isConnected(): boolean;

  /**
   * enables noise cancellation.
   * @returns {void}
   */
  enable: () => void;

  /**
   * disables noise cancellation.
   * @returns {void}
   */
  disable: () => void;

  /**
   * stops processing previously connected stream
   * @returns {void}
   */
  disconnect: () => void;

  /**
   * destroys the processor freeing up any resources
   * @returns {void}
   */
  destroy:() => void;

  /**
   * enables/disables logging
   * @param {boolean} [enable] - Specify true to enable logging
   * @returns {void}
   */
  setLogging:(enable: boolean) => void;
}


