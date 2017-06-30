'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link RemoteTrackSignaling}.
 * @class
 * @classdesc A {@link RemoteTrack} implementation
 * @extends TrackSignaling
 * @param {Track.SID} sid
 * @param {Track.ID} id
 * @param {string} kind - one of "audio" or "video"
 * @param {boolean} isEnabled
 * @param {boolean} [isSubscribed]
 * @property {boolean} isSubscribed
 */
function RemoteTrackSignaling(sid, id, kind, isEnabled, isSubscribed) {
  TrackSignaling.call(this, id, kind, isEnabled);
  Object.defineProperties(this, {
    isSubscribed: {
      enumerable: true,
      value: typeof isSubscribed === 'boolean' ? isSubscribed : true
    }
  });
  this.setSid(sid);
}

inherits(RemoteTrackSignaling, TrackSignaling);

module.exports = RemoteTrackSignaling;
