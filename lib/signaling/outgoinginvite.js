'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');
var util = require('../util');

/*
OutgoingInviteSignaling States
------------------------------

                  +----------+
                  |          |
         +------->| accepted |
         |        |          |
         |        +----------+
    +---------+   +----------+
    |         |   |          |
    | pending |-->| rejected |
    |         |   |          |
    +---------+   +----------+
         |        +----------+
         |        |          |
         +------->|  failed  |
                  |          |
                  +----------+

*/

var states = {
  pending: [
    'accepted',
    'rejected',
    'failed'
  ],
  accepted: [],
  rejected: [],
  failed: []
};

/**
 * Construct an {@link OutgoingInviteSignaling}.
 * @class
 * @classdesc An {@link OutgoingInvite} implementation
 * @extends StateMachine
 * @extends Promise<ParticipantSignaling>
 * @param {string} to - the {@link Participant} identity to invite
 * @property {string} to - the {@link Participant} identity invited
 */
function OutgoingInviteSignaling(to) {
  StateMachine.call(this, 'pending', states);
  Object.defineProperties(this, {
    _deferred: {
      value: util.defer()
    },
    to: {
      enumerable: true,
      value: to
    }
  });
}

inherits(OutgoingInviteSignaling, StateMachine);

OutgoingInviteSignaling.prototype.catch = function _catch() {
  return this._deferred.promise.catch.apply(this._deferred.promise, arguments);
};

OutgoingInviteSignaling.prototype.then = function then() {
  return this._deferred.promise.then.apply(this._deferred.promise, arguments);
};

module.exports = OutgoingInviteSignaling;
