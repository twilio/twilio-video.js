'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

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
 */
function TrackSignaling(id, kind, initialState) {
  StateMachine.call(this, initialState, states);
  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    }
  });
}

inherits(TrackSignaling, StateMachine);

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
 * Disable the {@link TrackSignaling} if it is not already disabled.
 * @return {this}
 */
TrackSignaling.prototype.disable = function disable() {
  return this.enable(false);
};

module.exports = TrackSignaling;
