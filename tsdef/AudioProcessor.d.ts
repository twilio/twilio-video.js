
export interface AudioProcessor {
  // given an audio track returns TwilioAudioProcessorTrack
  connect: (sourceTrack: MediaStreamTrack) => MediaStreamTrack
  isEnabled: () => boolean;
  isInitialized(): boolean;
  isConnected(): boolean;
  enable: () => void; // enables tracks processing.
  disable: () => void; // disables disables processing.
  disconnect: () => void; // stops processing track and releases any resources.
}


