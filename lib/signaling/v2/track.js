'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('../track');

/**
 * Construct a {@link TrackV2}.
 * @class
 * @extends TrackSignaling
 * @param {object} trackState
 */
function TrackV2(trackState) {
  TrackSignaling.call(this,
    trackState.id,
    trackState.kind,
    trackState.enabled ? 'enabled' : 'disabled');
}

inherits(TrackV2, TrackSignaling);

TrackV2.getState = function getState(track) {
  return {
    enabled: track.state === 'enabled',
    id: track.id,
    kind: track.kind
  };
};

TrackV2.prototype.update = function update(trackState) {
  this.enable(trackState.enabled);
  return this;
};

module.exports = TrackV2;
