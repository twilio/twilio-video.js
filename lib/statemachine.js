'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var util = require('./util');

/**
 * Construct a {@link StateMachine}.
 * @class
 * @classdesc {@link StateMachine} represents a state machine. The state
 * machine supports a locking mechanism to allow asynchronous state transitions
 * to ensure they have not been preempted. Calls to
 * {@link StateMachine#takeLock} are guaranteed to be resolved in FIFO order.
 * @extends {EventEmitter}
 * @param {string} initialState - the intiial state
 * @param {object} states
 * @param {?log} [log=null]
 * @property {boolean} isLocked - whether or not the {@link StateMachine} is
 * locked performing asynchronous state transition
 * @property {string} state - the current state
 * @emits {@link StateMachine#stateChanged}
 */
function StateMachine(initialState, states, log) {
  EventEmitter.call(this);
  var lock = null;
  var state = initialState;
  states = transformStates(states);
  Object.defineProperties(this, {
    _lock: {
      get: function() {
        return lock;
      },
      set: function(_lock) {
        lock = _lock;
      }
    },
    _log: {
      value: log
    },
    _state: {
      get: function() {
        return state;
      },
      set: function(_state) {
        state = _state;
      }
    },
    _states: {
      value: states
    },
    isLocked: {
      enumerable: true,
      get: function() {
        return lock !== null;
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return state;
      }
    }
  });
}

inherits(StateMachine, EventEmitter);

/**
 * This method takes a lock and passes the {@link StateMachine#Key} to your
 * transition function. You may perform zero or more state transitions in your
 * transition function, but you should check for preemption in each tick. Once
 * the Promise returned by your transition function resolves or rejects, this
 * method releases the lock it acquired for you.
 * @param {string} name - a name for the lock
 * @param {function(StateMachine#Key): Promise} transitionFunction
 * @returns {Promise}
 */
// NOTE(mroberts): This method is named after a Haskell function:
// https://hackage.haskell.org/package/base-4.8.2.0/docs/Control-Exception.html#v:bracket
StateMachine.prototype.bracket = function bracket(name, transitionFunction) {
  var key;
  var self = this;

  function releaseLock(error) {
    if (self.hasLock(key)) {
      self.releaseLock(key);
    }
    if (error) {
      throw error;
    }
  }

  return this.takeLock(name).then(function gotKey(_key) {
    key = _key;
    return transitionFunction(key);
  }).then(function success() {
    releaseLock();
  }, releaseLock);
};

/**
 * Check whether or not a {@link StateMachine#Key} matches the lock.
 * @param {StateMachine#Key} key
 * @returns {boolean}
 */
StateMachine.prototype.hasLock = function hasLock(key) {
  return this._lock === key;
};

/**
 * Preempt any pending state transitions and immediately transition to the new
 * state. If a lock name is specified, take the lock and return the
 * {@link StateMachine#Key}.
 * @param {string} newState
 * @param {?string} [name=null] - a name for the lock
 * @returns {?StateMachine#Key}
 */
StateMachine.prototype.preempt = function preempt(newState, name) {
  // 1. Check that the new state is valid.
  if (!this.valid(newState)) {
    throw new Error('Cannot transition from "' + this.state +
      '" to "' + newState + '"');
  }

  // 2. Release the old lock, if any.
  var oldLock;
  if (this.isLocked) {
    if (this._log) {
      this._log.info('Preempting ' + this._lock.name);
    }
    oldLock = this._lock;
    this._lock = null;
  }

  // 3. Take the lock, if requested.
  var error;
  var key = null;
  if (name === null || typeof name === 'undefined') {
    if (oldLock) {
      error = new Error(oldLock.name + ' was preempted');
    }
  } else {
    if (oldLock) {
      error = new Error(oldLock.name + ' was preempted by ' + name);
    }
    key = this.takeLockSync(name);
  }

  // 4. If a lock wasn't requested, take a "preemption" lock in order to
  // maintain FIFO order of those taking locks.
  var preemptionKey = key ? null : this.takeLockSync('preemption');

  // 5. Transition.
  this.transition(newState, key || preemptionKey);

  // 6. Preempt anyone blocked on the old lock.
  if (oldLock) {
    oldLock.reject(error);
  }

  // 7. Release the "preemption" lock, if we took it.
  if (preemptionKey) {
    this.releaseLock(preemptionKey);
  }

  return key;
};

/**
 * Release a lock. This method succeeds only if the {@link StateMachine} is
 * still locked and has not been preempted.
 * @param {StateMachine#Key} key
 * @throws Error
 */
StateMachine.prototype.releaseLock = function releaseLock(key) {
  if (!this.isLocked) {
    throw new Error('Could not release the lock for ' + key.name +
      ' because the StateMachine is not locked');
  } else if (!this.hasLock(key)) {
    throw new Error('Could not release the lock for ' + key.name +
      ' because ' + this._lock.name + ' has the lock');
  }
  this._lock = null;
  key.resolve();
};

/**
 * Take a lock, returning a Promise for the {@link StateMachine#Key}. You should
 * take a lock anytime you intend to perform asynchronous transitions. Calls to
 * this method are guaranteed to be resolved in FIFO order.
 * @param {string} name - a name for the lock
 * @returns {Promise<object>}
 */
StateMachine.prototype.takeLock = function takeLock(name) {
  if (this.isLocked) {
    var takeLock = this.takeLock.bind(this, name);
    return this._lock.promise.then(takeLock, takeLock);
  }
  return Promise.resolve(this.takeLockSync(name));
};

/**
 * Take a lock, returning the {@Link StateMachine#Key}. This method throws if
 * the {@link StateMachine} is locked.
 * @param {string} name - a name for the lock
 * @returns {object}
 * @throws Error
 */
StateMachine.prototype.takeLockSync = function takeLockSync(name) {
  if (this.isLocked) {
    throw new Error('Could not take the lock for ' + name + ' ' +
      'because the lock for ' + this._lock.name + ' was not released');
  }
  var lock = makeLock(name);
  this._lock = lock;
  return lock;
};

/**
 * Transition to a new state. If the {@link StateMachine} is locked, you must
 * provide the {@link StateMachine#Key}. An invalid state or the wrong
 * {@link StateMachine#Key} will throw an error.
 * @param {string} newState
 * @param {?StateMachine#Key} [key=null]
 * @throws {Error}
 */
StateMachine.prototype.transition = function transition(newState, key) {
  // 1. If we're locked, required the key.
  if (this.isLocked) {
    if (!key) {
      throw new Error('You must provide the key in order to ' +
        'transition');
    } else if (!this.hasLock(key)) {
      throw new Error('Could not transition using the key for ' +
        key.name + ' because ' + this._lock.name + ' has the lock');
    }
  } else if (key) {
    throw new Error('Key provided for ' + key.name + ', but the ' +
      'StateMachine was not locked (possibly due to preemption)');
  }

  // 2. Check that the new state is valid.
  if (!this.valid(newState)) {
    throw new Error('Cannot transition from "' + this.state +
      '" to "' + newState + '"');
  }

  // 3. Update the state and emit an event.
  this._state = newState;
  this.emit('stateChanged', newState);
};

/**
 * Check if transitioning to the given state is valid.
 * @param {string} newState
 * @returns {boolean}
 */
StateMachine.prototype.valid = function valid(newState) {
  var validStates = this._states.get(this.state);
  return validStates.has(newState);
};

/**
 * @event StateMachine#stateChanged
 * @param {string} newState
 */

/**
 * @typedef {object} StateMachine#Key
 */

function makeLock(name) {
  var lock = util.defer();
  lock.name = name;
  return lock;
}

function transformStates(states) {
  var newStates = new Map();
  for (var key in states) {
    newStates.set(key, new Set(states[key]));
  }
  return newStates;
}

module.exports = StateMachine;
