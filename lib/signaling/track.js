'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');
var util = require('../util');

/*
TrackSignaling States
---------------------

    +----------+
    |          |
    | enabled  |--+
    |          |  |
    +----------+  |   +-------+
       ^    |     +-->|       |
       |    |         | ended |
       |    v     +-->|       |
    +----------+  |   +-------+
    |          |  |
    | disabled |--+
    |          |
    +----------+

*/

var states = {
  enabled: [
    'disabled',
    'ended'
  ],
  disabled: [
    'enabled',
    'ended'
  ],
  ended: []
};

/**
 * Construct a {@link TrackSignaling}.
 * @class
 * @classdesc A {@link Track} implementation
 * @extends StateMachine
 * @param {string} id
 * @param {string} kind - one of "audio" or "video"
 * @param {string} initialState - one of "enabled" or "disabled"
 * @property {string} id
 * @property {string} kind
 * @property {?MediaStream} mediaStream
 * @property {?MediaStreamTrack} mediaStreamTrack
 */
function TrackSignaling(id, kind, initialState) {
  StateMachine.call(this, initialState, states);
  var mediaStream;
  var mediaStreamTrack;
  Object.defineProperties(this, {
    _mediaStream: {
      get: function() {
        return mediaStream;
      },
      set: function(_mediaStream) {
        mediaStream = _mediaStream;
        this._mediaStreamDeferred.resolve(mediaStream);
      }
    },
    _mediaStreamDeferred: {
      value: util.defer()
    },
    _mediaStreamTrack: {
      get: function() {
        return mediaStreamTrack;
      },
      set: function(_mediaStreamTrack) {
        mediaStreamTrack = _mediaStreamTrack;
        this._mediaStreamTrackDeferred.resolve(mediaStreamTrack);
      }
    },
    _mediaStreamTrackDeferred: {
      value: util.defer()
    },
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    },
    mediaStream: {
      enumerable: true,
      get: function() {
        return mediaStream;
      }
    },
    mediaStreamTrack: {
      enumerable: true,
      get: function() {
        return mediaStreamTrack;
      }
    }
  });
}

inherits(TrackSignaling, StateMachine);

/**
 * Disable the {@link TrackSignaling} if it is not already disabled.
 * @return {this}
 */
TrackSignaling.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Enable (or disable) the {@link TrackSignaling} if it is not already enabled
 * (or disabled).
 * @param {boolean} [enabled=true]
 * @return {this}
 */
TrackSignaling.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  var newState = enabled ? 'enabled' : 'disabled';
  if (this.state !== 'ended' && this.state !== newState) {
    this.preempt(newState);
  }
  return this;
};

/**
 * End the {@link TrackSignaling} if it is not already ended.
 * @return {this}
 */
TrackSignaling.prototype.end = function end() {
  if (this.state !== 'ended') {
    this.preempt('ended');
  }
  return this;
};

/**
 * Get the MediaStreamTrack (and MediaStream) on the {@link TrackSignaling}.
 * @returns {Promise<[MediaStreamTrack, MediaStream]>}
 */
TrackSignaling.prototype.getMediaStreamTrack = function getMediaStreamTrack() {
  return Promise.all([
    this._mediaStreamTrackDeferred.promise,
    this._mediaStreamDeferred.promise
  ]);
};

/**
 * Set the MediaStreamTrack (and MediaStream) on the {@link TrackSignaling}.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {MediaStream} mediaStream
 * @returns {this}
 */
TrackSignaling.prototype.setMediaStreamTrack = function setMediaStreamTrack(mediaStreamTrack, mediaStream) {
  this._mediaStream = mediaStream;
  this._mediaStreamTrack = mediaStreamTrack;
  return this;
};

module.exports = TrackSignaling;
