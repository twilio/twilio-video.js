'use strict';

var inherits = require('util').inherits;
var AudioTrack = require('./audiotrack');
var RemoteMediaTrack = require('./remotemediatrack');

/**
 * Construct a {@link RemoteAudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link RemoteAudioTrack} represents an {@link AudioTrack}
 *   published to a {@link Room} by a {@link RemoteParticipant}.
 * @extends {AudioTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
 * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteAudioTrack} is
 *   currently subscribed to
 * @property {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
 * @fires RemoteAudioTrack#disabled
 * @fires RemoteAudioTrack#enabled
 * @fires RemoteAudioTrack#started
 * @fires RemoteAudioTrack#unsubscribed
 */
function RemoteAudioTrack(mediaStreamTrack, signaling, options) {
  if (!(this instanceof RemoteAudioTrack)) {
    return new RemoteAudioTrack(mediaStreamTrack, signaling, options);
  }
  RemoteMediaTrack.call(this, AudioTrack, mediaStreamTrack, signaling, options);
}

inherits(RemoteAudioTrack, AudioTrack);

RemoteAudioTrack.prototype.toString = function toString() {
  return '[RemoteAudioTrack #' + this._instanceId + ': ' + this.sid + ']';
};

RemoteAudioTrack.prototype._unsubscribe = RemoteMediaTrack.prototype._unsubscribe;

/**
 * The {@link RemoteAudioTrack} was disabled, i.e. "muted".
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   disabled
 * @event RemoteAudioTrack#disabled
 */

/**
 * The {@link RemoteAudioTrack} was enabled, i.e. "unmuted".
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   enabled
 * @event RemoteAudioTrack#enabled
 */

/**
 * The {@link RemoteAudioTrack} started. This means there is enough audio data
 * to begin playback.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that started
 * @event RemoteAudioTrack#started
 */

/**
 * The {@link RemoteAudioTrack} was unsubscribed from.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   unsubscribed from
 * @event RemoteAudioTrack#unsubscribed
 */

module.exports = RemoteAudioTrack;
