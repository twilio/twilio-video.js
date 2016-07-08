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

module.exports = TrackSignaling;
