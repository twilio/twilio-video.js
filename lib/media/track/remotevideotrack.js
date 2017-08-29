'use strict';

var inherits = require('util').inherits;
var RemoteMediaTrack = require('./remotemediatrack');
var VideoTrack = require('./videotrack');

/**
 * Construct an {@link RemoteVideoTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link RemoteVideoTrack} represents a {@link VideoTrack}
 *   published to the {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @extends RemoteMediaTrack
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 */
function RemoteVideoTrack(mediaStreamTrack, signaling, options) {
  if (!(this instanceof RemoteVideoTrack)) {
    return new RemoteVideoTrack(mediaStreamTrack, signaling, options);
  }
  RemoteMediaTrack.call(this, VideoTrack, mediaStreamTrack, signaling, options);
}

inherits(RemoteVideoTrack, VideoTrack);

RemoteVideoTrack.prototype.toString = function toString() {
  return '[RemoteVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
};

RemoteVideoTrack.prototype._unsubscribe = RemoteMediaTrack.prototype._unsubscribe;

module.exports = RemoteVideoTrack;
