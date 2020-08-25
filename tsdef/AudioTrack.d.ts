import { Track } from './Track';

export class AudioTrack extends Track {
  isStarted: boolean;
  isEnabled: boolean;
  kind: 'audio';
  mediaStreamTrack: MediaStreamTrack;

  _attachments?: HTMLMediaElement[];

  attach(element?: HTMLMediaElement | string): HTMLMediaElement;
  detach(element?: HTMLMediaElement | string): HTMLMediaElement[];
}
