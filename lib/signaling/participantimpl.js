'use strict';

var inherits = require('util').inherits;
var Media = require('../media');
var StateMachine = require('../statemachine');

/*
ParticipantImpl States
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
 * Construct a {@link ParticipantImpl}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends StateMachine
 * @param {Participant.SID} sid
 * @param {string} identity
 * @param {string} initialState - one of "connected" or "failed"
 * @param {Signaling} signaling
 * @property {string} identity
 * @property {Participant.SID} sid
 */
function ParticipantImpl(sid, identity, initialState, signaling) {
  var media = new Media();
  StateMachine.call(this, initialState, states);
  Object.defineProperties(this, {
    _signaling: {
      value: signaling
    },
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

inherits(ParticipantImpl, StateMachine);

module.exports = ParticipantImpl;
