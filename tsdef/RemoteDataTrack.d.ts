import { Track } from './Track';

/**
 * A {@link RemoteDataTrack} represents data published to a {@link Room} by a
 * {@link RemoteParticipant}.
 * @extends Track
 * @property {boolean} isEnabled - true
 * @property {boolean} isSubscribed - Whether the {@link RemoteDataTrack} is
 *   subscribed to
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteDataTrack} is
 *   switched off
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which data will be transmitted or
 *   retransmitted if not acknowledged on the underlying RTCDataChannel.
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the data will be retransmitted if not successfully received on the
 *   underlying RTCDataChannel.
 * @property {boolean} ordered - true if data on the {@link RemoteDataTrack} can
 *   be received out-of-order.
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteDataTrack}
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of retransmits that will be attempted, ensuring "reliable"
 *   transmission.
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteDataTrack}
 * @emits RemoteDataTrack#message
 * @emits RemoteDataTrack#switchedOff
 * @emits RemoteDataTrack#switchedOn
 */
export class RemoteDataTrack extends Track {
  isEnabled: boolean;
  isSubscribed: boolean;
  kind: 'data';
  maxPacketLifeTime: number | null;
  maxRetransmits: number | null;
  ordered: boolean;
  reliable: boolean;
  sid: Track.SID;
}

/**
 * A message was received over the {@link RemoteDataTrack}.
 * @event RemoteDataTrack#message
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that received
 *   the message
 */

/**
 * A {@link RemoteDataTrack} was switched off.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   switched off
 * @event RemoteDataTrack#switchedOff
 */

/**
 * A {@link RemoteDataTrack} was switched on.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   switched on
 * @event RemoteDataTrack#switchedOn
 */
