'use strict';

var inherits = require('util').inherits;
var RemoteParticipantSignaling = require('../remoteparticipant');
var TrackV2 = require('./track');

/**
 * Construct a {@link RemoteParticipantV2}.
 * @class
 * @extends RemoteParticipantSignaling
 * @param {object} participantState
 * @param {function(string): Promise<MediaStreamTrack>} getMediaStreamTrack
 * @property {?number} revision
 */
function RemoteParticipantV2(participantState, getMediaStreamTrack, options) {
  if (!(this instanceof RemoteParticipantV2)) {
    return new RemoteParticipantV2(participantState, getMediaStreamTrack, options);
  }

  RemoteParticipantSignaling.call(this, participantState.sid, participantState.identity);

  options = Object.assign({
    TrackV2: TrackV2
  }, options);

  Object.defineProperties(this, {
    _revision: {
      writable: true,
      value: null
    },
    _TrackV2: {
      value: options.TrackV2
    },
    _getMediaStreamTrack: {
      value: getMediaStreamTrack
    },
    revision: {
      enumerable: true,
      get: function() {
        return this._revision;
      }
    }
  });

  return this.update(participantState);
}

inherits(RemoteParticipantV2, RemoteParticipantSignaling);

RemoteParticipantV2.prototype._getOrCreateTrack = function _getOrCreateTrack(trackState) {
  var TrackV2 = this._TrackV2;
  var track = this.tracks.get(trackState.id);
  if (!track) {
    track = new TrackV2(trackState);
    this.addTrack(track);
  }
  return track;
};

RemoteParticipantV2.prototype.update = function update(participantState) {
  if (this.revision !== null && participantState.revision <= this.revision) {
    return this;
  }
  this._revision = participantState.revision;

  var tracksToKeep = new Set();

  participantState.tracks.forEach(function(trackState) {
    var track = this._getOrCreateTrack(trackState);
    track.update(trackState);
    tracksToKeep.add(track);
  }, this);

  this.tracks.forEach(function(track) {
    if (!tracksToKeep.has(track)) {
      this.removeTrack(track);
    }
  }, this);

  if (participantState.state === 'disconnected' && this.state === 'connected') {
    this.preempt('disconnected');
  }

  return this;
};

RemoteParticipantV2.prototype.addTrack = function addTrack(track) {
  RemoteParticipantSignaling.prototype.addTrack.call(this, track);

  this._getMediaStreamTrack(track.id).then(function(mediaStreamTrack) {
    track.setMediaStreamTrack(mediaStreamTrack);
  });

  return this;
};

module.exports = RemoteParticipantV2;
