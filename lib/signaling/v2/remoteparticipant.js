'use strict';

var inherits = require('util').inherits;
var RemoteParticipantSignaling = require('../remoteparticipant');
var RemoteTrackV2 = require('./remotetrack');

/**
 * Construct a {@link RemoteParticipantV2}.
 * @class
 * @extends RemoteParticipantSignaling
 * @param {object} participantState
 * @param {function(string): Promise<DataTrackReceiver|MediaTrackReceiver>} getTrackReceiver
 * @param {object} [options]
 * @property {?number} revision
 */
function RemoteParticipantV2(participantState, getTrackReceiver, options) {
  if (!(this instanceof RemoteParticipantV2)) {
    return new RemoteParticipantV2(participantState, getTrackReceiver, options);
  }

  RemoteParticipantSignaling.call(this, participantState.sid, participantState.identity);

  options = Object.assign({
    RemoteTrackV2: RemoteTrackV2
  }, options);

  Object.defineProperties(this, {
    _revision: {
      writable: true,
      value: null
    },
    _RemoteTrackV2: {
      value: options.RemoteTrackV2
    },
    _getTrackReceiver: {
      value: getTrackReceiver
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
  var RemoteTrackV2 = this._RemoteTrackV2;
  var track = this.tracks.get(trackState.id);
  if (!track) {
    track = new RemoteTrackV2(trackState);
    this.addTrack(track);
  }
  return track;
};

/**
 * Update the {@link RemoteParticipantV2} with the new state.
 * @param {object} participantState
 * @returns {this}
 */
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

/**
 * Add the {@link RemoteTrackV2} to the {@link RemoteParticipantV2}.
 * @param {RemoteTrackV2} track
 * @returns {this}
 */
RemoteParticipantV2.prototype.addTrack = function addTrack(track) {
  RemoteParticipantSignaling.prototype.addTrack.call(this, track);
  this._getTrackReceiver(track.id).then(track.setTrackTransceiver.bind(track));
  return this;
};

module.exports = RemoteParticipantV2;
