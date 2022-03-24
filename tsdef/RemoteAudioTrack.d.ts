import { AudioTrack } from './AudioTrack';
import { Track } from './Track';

export class RemoteAudioTrack extends AudioTrack {
  sid: Track.SID;
  priority: Track.Priority | null;
  isSwitchedOff: boolean;
  switchOffReason: Track.SwitchOffReason | null;
  /**
   * @deprecated Use (.isSwitchedOff && .switchOffReason === Track.SwitchOffReason.DISABLED_BY_PUBLISHER) instead
   */
  isEnabled: boolean;

  setPriority(priority: Track.Priority | null): this;

  /**
   * @deprecated Use "switchedOff" (.isSwitchedOff && .switchOffReason === Track.SwitchOffReason.DISABLED_BY_PUBLISHER) instead
   */
  on(event: 'disabled', listener: (track: this) => void): this;
  /**
   * @deprecated Use "switchedOn" instead
   */
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: 'switchedOff', listener: (track: this, switchOffReason: Track.SwitchOffReason) => void): this;
  on(event: 'switchedOn', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
