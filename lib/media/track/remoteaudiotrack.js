'use strict';

var inherits = require('util').inherits;
var AudioTrack = require('./audiotrack');
var RemoteTrack = require('./remotetrack');

/**
 * Construct an {@link RemoteAudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link RemoteAudioTrack} represents a media {@link AudioTrack} published
 * to the {@link Room} by a {@link RemoteParticipant}.
 * @extends AudioTrack
 * @extends RemoteTrack
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 */
function RemoteAudioTrack(mediaStreamTrack, signaling, options) {
  if (!(this instanceof RemoteAudioTrack)) {
    return new RemoteAudioTrack(mediaStreamTrack, signaling, options);
  }
  RemoteTrack.call(this, AudioTrack, mediaStreamTrack, signaling, options);
}

inherits(RemoteAudioTrack, AudioTrack);

RemoteAudioTrack.prototype.toString = function toString() {
  return '[RemoteAudioTrack #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = RemoteAudioTrack;
