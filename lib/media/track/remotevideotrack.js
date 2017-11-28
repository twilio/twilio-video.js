'use strict';

var inherits = require('util').inherits;
var RemoteMediaTrack = require('./remotemediatrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link RemoteVideoTrack}.
 * @class
 * @classdesc A {@link RemoteVideoTrack} represents a {@link VideoTrack}
 *   published to a {@link Room} by a {@link RemoteParticipant}.
 * @extends {VideoTrack}
 * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
 * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteVideoTrack} is
 *   currently subscribed to
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @fires RemoteVideoTrack#disabled
 * @fires RemoteVideoTrack#enabled
 * @fires RemoteVideoTrack#started
 * @fires RemoteVideoTrack#unsubscribed
 */
function RemoteVideoTrack(mediaTrackReceiver, signaling, options) {
  if (!(this instanceof RemoteVideoTrack)) {
    return new RemoteVideoTrack(mediaTrackReceiver, signaling, options);
  }
  RemoteMediaTrack.call(this, VideoTrack, mediaTrackReceiver, signaling, options);
}

inherits(RemoteVideoTrack, VideoTrack);

RemoteVideoTrack.prototype.toString = function toString() {
  return '[RemoteVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
};

RemoteVideoTrack.prototype._unsubscribe = RemoteMediaTrack.prototype._unsubscribe;

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "unpaused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} was unsubscribed from.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   unsubscribed from
 * @event RemoteVideoTrack#unsubscribed
 */

module.exports = RemoteVideoTrack;
