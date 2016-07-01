'use strict';

var inherits = require('util').inherits;
var Media = require('../media');
var StateMachine = require('../statemachine');

/*
ParticipantSignaling States
----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

              +--------+
              |        |
              | failed |
              |        |
              +--------+

*/

var states = {
  failed: [],
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link ParticipantSignaling}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends StateMachine
 * @param {Participant.SID} sid
 * @param {string} identity
 * @param {string} initialState - "connected" or "failed"
 * @property {string} identity
 * @property {Participant.SID} sid
 * @property {string} state - "connected", "disconnected" or "failed"
 */
function ParticipantSignaling(sid, identity, initialState) {
  var media = new Media();
  StateMachine.call(this, initialState, states);
  Object.defineProperties(this, {
    identity: {
      enumerable: true,
      value: identity
    },
    media: {
      enumerable: true,
      value: media
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

inherits(ParticipantSignaling, StateMachine);

module.exports = ParticipantSignaling;
