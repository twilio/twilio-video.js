'use strict';

var inherits = require('util').inherits;
var RemoteParticipantSignaling = require('../remoteparticipant');
var TrackV2 = require('./track');

/**
 * Construct a {@link RemoteParticipantV2}.
 * @class
 * @extends RemoteParticipantSignaling
 * @param {function(string): Promise<[MediaStreamTrack, MediaStream]>} getMediaStreamTrack
 */
function RemoteParticipantV2(sid, identity, getMediaStreamTrack) {
  if (!(this instanceof RemoteParticipantV2)) {
    return new RemoteParticipantV2(sid, identity, getMediaStreamTrack);
  }

  RemoteParticipantSignaling.call(this, sid, identity);

  Object.defineProperties(this, {
    _getMediaStreamTrack: {
      value: getMediaStreamTrack
    }
  });

  return this;
}

inherits(RemoteParticipantV2, RemoteParticipantSignaling);

RemoteParticipantV2.prototype.getOrCreateTrack = function getOrCreateTrack(trackState) {
  var track = this.tracks.get(trackState.id);
  if (!track) {
    track = new TrackV2(trackState);
    this.addTrack(track);
  }
  return track;
};

RemoteParticipantV2.prototype.fullUpdate = function fullUpdate(participantState) {
  var tracksToKeep = new Set();

  participantState.tracks.forEach(function(trackState) {
    var track = this.getOrCreateTrack(trackState);
    track.fullUpdate(trackState);
    tracksToKeep.add(track);
  }, this);

  this.tracks.forEach(function(track) {
    if (!tracksToKeep.has(track)) {
      this.removeTrack(track);
    }
  }, this);

  return this;
};

RemoteParticipantV2.prototype.partialUpdate = function partialUpdate(event) {
  event.tracks.forEach(function(trackEvent) {
    var track = this.getOrCreateTrack(trackEvent);

    if (trackEvent.event) {
      if (trackEvent.event === 'track_removed') {
        this.removeTrack(track);
      } else {
        track.partialUpdate(trackEvent.event);
      }
    }
  }, this);

  return this;
};

RemoteParticipantV2.prototype.addTrack = function addTrack(track) {
  RemoteParticipantSignaling.prototype.addTrack.call(this, track);

  this._getMediaStreamTrack(track.id).then(function(pair) {
    var mediaStreamTrack = pair[0];
    var mediaStream = pair[1];
    track.setMediaStreamTrack(mediaStreamTrack, mediaStream);
  });

  return this;
};

module.exports = RemoteParticipantV2;
