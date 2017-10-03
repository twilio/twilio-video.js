'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link RemoteTrackSignaling}.
 * @class
 * @classdesc A {@link RemoteTrack} implementation
 * @extends TrackSignaling
 * @param {Track.SID} sid
 * @param {string} name
 * @param {Track.ID} id
 * @param {Track.Kind} kind
 * @param {boolean} isEnabled
 * @property {boolean} isSubscribed
 */
function RemoteTrackSignaling(sid, name, id, kind, isEnabled) {
  TrackSignaling.call(this, name, id, kind, isEnabled);
  Object.defineProperties(this, {
    isSubscribed: {
      enumerable: true,
      get: function() {
        return !!this._mediaStreamTrackOrDataTrackTransceiver;
      }
    }
  });
  this.setSid(sid);
}

inherits(RemoteTrackSignaling, TrackSignaling);

module.exports = RemoteTrackSignaling;
