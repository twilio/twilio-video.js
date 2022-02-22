
export interface AudioProcessor {
  // given an audio track returns TwilioAudioProcessorTrack
  process: (sourceTrack: MediaStreamTrack) => Promise<MediaStreamTrack>
  isEnabled: () => boolean;
  enable: () => void; // enables tracks processing.
  disable: () => void; // disables disables processing.
  disconnect: () => void; // stops processing track and releases any resources.
}


