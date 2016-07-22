'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('../track');

function TrackV2(trackState) {
  TrackSignaling.call(this,
    trackState.id,
    trackState.kind,
    trackState.enabled ? 'enabled' : 'disabled');
}

inherits(TrackV2, TrackSignaling);

TrackV2.prototype.fullUpdate = function fullUpdate(trackState) {
  this.enable(trackState.enabled);
  return this;
};

TrackV2.prototype.partialUpdate = function partialUpdate(event) {
  switch (event) {
    case 'track_disabled':
      this.disable();
      break;
    case 'track_enabled':
      this.enable();
      break;
  }
  return this;
};

module.exports = TrackV2;
