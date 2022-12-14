'use strict';

const { defer } = require('./');

const states = {
  high: new Set(['low']),
  low: new Set(['high'])
};

/**
 * Construct a {@link Latch}.
 * @class
 * @classdesc A {@link Latch} has two states ("high" and "low") and methods for
 * transitioning between them ({@link Latch#raise} and {@link Latch#lower}).
 * @param {string} [initialState="low"] - either "high" or "low"
 */
class Latch {
  constructor(initialState = 'low') {
    let state = initialState;
    Object.defineProperties(this, {
      _state: {
        set: function(_state) {
          if (state !== _state) {
            state = _state;
            const whenDeferreds = this._whenDeferreds.get(state);
            whenDeferreds.forEach(deferred => deferred.resolve(this));
            whenDeferreds.clear();
          }
        },
        get: function() {
          return state;
        }
      },
      _whenDeferreds: {
        value: new Map([
          ['high', new Set()],
          ['low', new Set()]
        ])
      }
    });
  }

  get state() {
    return this._state;
  }

  /**
   * Transition to "low".
   * @returns {this}
   * @throws {Error}
   */
  lower() {
    return this.transition('low');
  }

  /**
   * Transition to "high".
   * @returns {this}
   * @throws {Error}
   */
  raise() {
    return this.transition('high');
  }

  /**
   * Transition to a new state.
   * @param {string} newState
   * @returns {this}
   * @throws {Error}
   */
  transition(newState) {
    if (!states[this.state].has(newState)) {
      throw createUnreachableStateError(this.state, newState);
    }
    this._state = newState;
    return this;
  }

  /**
   * Return a Promise that resolves when the {@link Latch} transitions to
   * the specified state.
   * @param {string} state
   * @returns {Promise<this>}
   */
  when(state) {
    if (this.state === state) {
      return Promise.resolve(this);
    }
    if (!states[this.state].has(state)) {
      return Promise.reject(createUnreachableStateError(this.state, state));
    }
    const deferred = defer();
    this._whenDeferreds.get(state).add(deferred);
    return deferred.promise;
  }
}

/**
   * Create an unreachable state Error.
   * @param {string} from - state to be transitioned from
   * @param {string} to - state to be transitioned to
   * @return {Error}
   */
function createUnreachableStateError(from, to) {
  return new Error(`Cannot transition from "${from}" to "${to}"`);
}

module.exports = Latch;
