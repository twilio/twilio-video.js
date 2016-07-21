'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('../participant');
var TrackV2 = require('./track');

/**
 * Construct a {@link ParticipantV2}.
 * @class
 * @extends ParticipantSignaling
 * @param {string} sid
 * @param {string} identity
 * @param {function(string): Promise<[MediaStreamTrack, MediaStream]>} getMediaStreamTrack
 */
function ParticipantV2(sid, identity, getMediaStreamTrack) {
  if (!(this instanceof ParticipantV2)) {
    return new ParticipantV2(sid, identity, getMediaStreamTrack);
  }

  ParticipantSignaling.call(this, sid, identity);

  Object.defineProperties(this, {
    _getMediaStreamTrack: {
      value: getMediaStreamTrack
    }
  });

  return this;
}

inherits(ParticipantV2, ParticipantSignaling);

ParticipantV2.prototype.getOrCreateTrack = function getOrCreateTrack(trackState) {
  var track = this.tracks.get(trackState.id);
  if (!track) {
    track = new TrackV2(trackState);
    this.addTrack(track);
  }
  return track;
};

ParticipantV2.prototype.fullUpdate = function fullUpdate(participantState) {
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

ParticipantV2.prototype.partialUpdate = function partialUpdate(event) {
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

ParticipantV2.prototype.addTrack = function addTrack(track) {
  var self = this;

  ParticipantSignaling.prototype.addTrack.call(this, track);

  this._getMediaStreamTrack(track.id).then(function(pair) {
    var mediaStreamTrack = pair[0];
    var mediaStream = pair[1];
    self.addMediaStreamTrack(mediaStreamTrack, mediaStream);
  });

  return this;
};

module.exports = ParticipantV2;
