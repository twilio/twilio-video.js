'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
Latch States
------------

    +------+    +------+
    |      |<---|      |
    | high |    | low  |
    |      |--->|      |
    +------+    +------+

*/

var states = {
  high: ['low'],
  low: ['high']
};

/**
 * Construct a {@link Latch}.
 * @class
 * @classdesc A {@link Latch} is just a {@link StateMachine} with two states
 *   ("high" and "low") and methods for transitioning between them
 *   ({@link Latch#raise} and {@link Latch#lower}).
 * @extends StateMachine
 * @param {string} [initialState="low"] - either "high" or "low"
 */
function Latch(initialState) {
  if (!(this instanceof Latch)) {
    return new Latch(initialState);
  }
  StateMachine.call(this, initialState || 'low', states);
}

inherits(Latch, StateMachine);

/**
 * Transition to "high".
 * @returns {this}
 * @throws {Error}
 */
Latch.prototype.raise = function raise() {
  return transition(this, 'high');
};

/**
 * Transition to "low".
 * @returns {this}
 * @throws {Error}
 */
Latch.prototype.lower = function lower() {
  return transition(this, 'low');
};

/**
 * Transition a {@link Latch}.
 * @private
 * @param {Latch} latch
 * @param {string} newState - either "high" or "low"
 * @returns {Latch}
 * @throws {Error}
 */
function transition(latch, newState) {
  latch.transition(newState);
  return latch;
}

module.exports = Latch;
