import { Track } from './Track';

export class AudioTrack extends Track {
  isStarted: boolean;
  isEnabled: boolean;
  kind: 'audio';
  mediaStreamTrack: MediaStreamTrack;

  attach(element?: HTMLMediaElement | string): HTMLMediaElement;
  detach(element?: HTMLMediaElement | string): HTMLMediaElement[];

  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
