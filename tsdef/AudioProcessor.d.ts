import { NoiseCancellationVendor } from './types';

export interface AudioProcessor {
  // given an audio track returns TwilioAudioProcessorTrack
  vendor: NoiseCancellationVendor;
  connect: (sourceTrack: MediaStreamTrack) => Promise<MediaStreamTrack>
  isEnabled: () => boolean;
  isInitialized(): boolean;
  isConnected(): boolean;
  enable: () => void; // enables tracks processing.
  disable: () => void; // disables disables processing.
  disconnect: () => void; // stops processing track and releases any resources.
  destroy:() => void; // destroys the processor.
  setLogging:(enable: boolean) => void; // enables/disables logging
}


