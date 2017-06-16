'use strict';

var inherits = require('util').inherits;
var RemoteTrack = require('./remotetrack');
var VideoTrack = require('./videotrack');

/**
 * Construct an {@link RemoteVideoTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link RemoteVideoTrack} represents a media {@link VideoTrack} published
 * to the {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @extends RemoteTrack
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {TrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 */
function RemoteVideoTrack(mediaStreamTrack, signaling, options) {
  if (!(this instanceof RemoteVideoTrack)) {
    return new RemoteVideoTrack(mediaStreamTrack, signaling, options);
  }
  RemoteTrack.call(this, VideoTrack, mediaStreamTrack, signaling, options);
}

inherits(RemoteVideoTrack, VideoTrack);

RemoteVideoTrack.prototype.toString = function toString() {
  return '[RemoteVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = RemoteVideoTrack;
