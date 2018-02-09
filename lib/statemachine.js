'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('./util');

/**
 * {@link StateMachine} represents a state machine. The state machine supports a
 * reentrant locking mechanism to allow asynchronous state transitions to ensure
 * they have not been preempted. Calls to {@link StateMachine#takeLock} are
 * guaranteed to be resolved in FIFO order.
 * @extends EventEmitter
 * @property {boolean} isLocked - whether or not the {@link StateMachine} is
 *   locked performing asynchronous state transition
 * @property {string} state - the current state
 * @emits {@link StateMachine#stateChanged}
 */
class StateMachine extends EventEmitter {
  /**
   * Construct a {@link StateMachine}.
   * @param {string} initialState - the intiial state
   * @param {object} states
   */
  constructor(initialState, states) {
    super();
    let lock = null;
    let state = initialState;
    states = transformStates(states);
    Object.defineProperties(this, {
      _lock: {
        get() {
          return lock;
        },
        set(_lock) {
          lock = _lock;
        }
      },
      _reachableStates: {
        value: reachable(states)
      },
      _state: {
        get() {
          return state;
        },
        set(_state) {
          state = _state;
        }
      },
      _states: {
        value: states
      },
      _whenDeferreds: {
        value: new Set()
      },
      isLocked: {
        enumerable: true,
        get() {
          return lock !== null;
        }
      },
      state: {
        enumerable: true,
        get() {
          return state;
        }
      }
    });

    this.on('stateChanged', state => {
      this._whenDeferreds.forEach(deferred => {
        deferred.when(state, deferred.resolve, deferred.reject);
      });
    });
  }

  /**
   * Returns a promise whose executor function is called on each state change.
   * @param {function(state: string, resolve: function, reject: function): void} when
   * @returns {Promise.<*>}
   * @private
   */
  _whenPromise(when) {
    if (typeof when !== 'function') {
      return Promise.reject(new Error('when() executor must be a function'));
    }

    const deferred = util.defer();

    deferred.when = when;
    this._whenDeferreds.add(deferred);

    return deferred.promise.then(payload => {
      this._whenDeferreds.delete(deferred);
      return payload;
    }, error => {
      this._whenDeferreds.delete(deferred);
      throw error;
    });
  }

  /**
   * This method takes a lock and passes the {@link StateMachine#Key} to your
   * transition function. You may perform zero or more state transitions in your
   * transition function, but you should check for preemption in each tick. You
   * may also reenter the lock. Once the Promise returned by your transition
   * function resolves or rejects, this method releases the lock it acquired for
   * you.
   * @param {string} name - a name for the lock
   * @param {function(StateMachine#Key): Promise} transitionFunction
   * @returns {Promise}
   */
  // NOTE(mroberts): This method is named after a Haskell function:
  // https://hackage.haskell.org/package/base-4.8.2.0/docs/Control-Exception.html#v:bracket
  bracket(name, transitionFunction) {
    let key;
    const self = this;

    function releaseLock(error) {
      if (self.hasLock(key)) {
        self.releaseLockCompletely(key);
      }
      if (error) {
        throw error;
      }
    }

    return this.takeLock(name).then(function gotKey(_key) {
      key = _key;
      return transitionFunction(key);
    }).then(function success(result) {
      releaseLock();
      return result;
    }, releaseLock);
  }

  /**
   * Check whether or not a {@link StateMachine#Key} matches the lock.
   * @param {StateMachine#Key} key
   * @returns {boolean}
   */
  hasLock(key) {
    return this._lock === key;
  }

  /**
   * Preempt any pending state transitions and immediately transition to the new
   * state. If a lock name is specified, take the lock and return the
   * {@link StateMachine#Key}.
   * @param {string} newState
   * @param {?string} [name=null] - a name for the lock
   * @param {Array<*>} [payload=[]]
   * @returns {?StateMachine#Key}
   */
  preempt(newState, name, payload) {
    // 1. Check that the new state is valid.
    if (!isValidTransition(this._states, this.state, newState)) {
      throw new Error(`Cannot transition from "${this.state}" to "${newState}"`);
    }

    // 2. Release the old lock, if any.
    let oldLock;
    if (this.isLocked) {
      oldLock = this._lock;
      this._lock = null;
    }

    // 3. Take the lock, if requested.
    let key = null;
    if (name) {
      key = this.takeLockSync(name);
    }

    // 4. If a lock wasn't requested, take a "preemption" lock in order to
    // maintain FIFO order of those taking locks.
    const preemptionKey = key ? null : this.takeLockSync('preemption');

    // 5. Transition.
    this.transition(newState, key || preemptionKey, payload);

    // 6. Preempt anyone blocked on the old lock.
    if (oldLock) {
      oldLock.resolve();
    }

    // 7. Release the "preemption" lock, if we took it.
    if (preemptionKey) {
      this.releaseLock(preemptionKey);
    }

    return key;
  }

  /**
   * Release a lock. This method succeeds only if the {@link StateMachine} is
   * still locked and has not been preempted.
   * @param {StateMachine#Key} key
   * @throws Error
   */
  releaseLock(key) {
    if (!this.isLocked) {
      throw new Error(`Could not release the lock for ${key.name} because the StateMachine is not locked`);
    } else if (!this.hasLock(key)) {
      throw new Error(`Could not release the lock for ${key.name} because ${this._lock.name} has the lock`);
    }
    if (key.depth === 0) {
      this._lock = null;
      key.resolve();
    } else {
      key.depth--;
    }
  }

  /**
   * Release a lock completely, even if it has been reentered. This method
   * succeeds only if the {@link StateMachine} is still locked and has not been
   * preempted.
   * @param {StateMachine#Key} key
   * @throws Error
   */
  releaseLockCompletely(key) {
    if (!this.isLocked) {
      throw new Error(`Could not release the lock for ${key.name} because the StateMachine is not locked`);
    } else if (!this.hasLock(key)) {
      throw new Error(`Could not release the lock for ${key.name} because ${this._lock.name} has the lock`);
    }
    key.depth = 0;
    this._lock = null;
    key.resolve();
  }

  /**
   * Take a lock, returning a Promise for the {@link StateMachine#Key}. You should
   * take a lock anytime you intend to perform asynchronous transitions. Calls to
   * this method are guaranteed to be resolved in FIFO order. You may reenter
   * a lock by passing its {@link StateMachine#Key}.
   * @param {string|StateMachine#Key} nameOrKey - a name for the lock or an
   * existing {@link StateMachine#Key}
   * @returns {Promise<object>}
   */
  takeLock(nameOrKey) {
    // Reentrant lock
    if (typeof nameOrKey === 'object') {
      const key = nameOrKey;
      return new Promise(resolve => {
        resolve(this.takeLockSync(key));
      });
    }

    // New lock
    const name = nameOrKey;
    if (this.isLocked) {
      var takeLock = this.takeLock.bind(this, name);
      return this._lock.promise.then(takeLock);
    }
    return Promise.resolve(this.takeLockSync(name));
  }

  /**
   * Take a lock, returning the {@Link StateMachine#Key}. This method throws if
   * the {@link StateMachine} is locked or the wrong {@link StateMachine#Key} is
   * provided. You may reenter a lock by passing its {@link StateMachine#Key}.
   * @param {string|StateMachine#Key} nameOrKey - a name for the lock or an
   * existing {@link StateMachine#Key}
   * @returns {object}
   * @throws Error
   */
  takeLockSync(nameOrKey) {
    const key = typeof nameOrKey === 'string' ? null : nameOrKey;
    const name = key ? key.name : nameOrKey;

    if (key && !this.hasLock(key) || !key && this.isLocked) {
      throw new Error(`Could not take the lock for ${name} because the lock for ${this._lock.name} was not released`);
    }

    // Reentrant lock
    if (key) {
      key.depth++;
      return key;
    }

    // New lock
    const lock = makeLock(name);
    this._lock = lock;
    return lock;
  }

  /**
   * Transition to a new state. If the {@link StateMachine} is locked, you must
   * provide the {@link StateMachine#Key}. An invalid state or the wrong
   * {@link StateMachine#Key} will throw an error.
   * @param {string} newState
   * @param {?StateMachine#Key} [key=null]
   * @param {Array<*>} [payload=[]]
   * @throws {Error}
   */
  transition(newState, key, payload) {
    payload = payload || [];

    // 1. If we're locked, required the key.
    if (this.isLocked) {
      if (!key) {
        throw new Error('You must provide the key in order to ' +
          'transition');
      } else if (!this.hasLock(key)) {
        throw new Error(`Could not transition using the key for ${key.name} because ${this._lock.name} has the lock`);
      }
    } else if (key) {
      throw new Error(`Key provided for ${key.name}, but the StateMachine was not locked (possibly due to preemption)`);
    }

    // 2. Check that the new state is valid.
    if (!isValidTransition(this._states, this.state, newState)) {
      throw new Error(`Cannot transition from "${this.state}" to "${newState}"`);
    }

    // 3. Update the state and emit an event.
    this._state = newState;
    this.emit(...['stateChanged', newState].concat(payload));
  }

  /**
   * Attempt to transition to a new state. Unlike {@link StateMachine#transition},
   * this method does not throw.
   * @param {string} newState
   * @param {?StateMachine#Key} [key=null]
   * @param {Array<*>} [payload=[]]
   * @returns {boolean}
   */
  tryTransition(newState, key, payload) {
    try {
      this.transition(newState, key, payload);
    } catch (error) {
      return false;
    }
    return true;
  }

  /**
   * Return a Promise that resolves when the {@link StateMachine} transitions to
   * the specified state. If the {@link StateMachine} transitions such that the
   * requested state becomes unreachable, the Promise rejects.
   * @param {string} state
   * @returns {Promise<this>}
   */
  when(state) {
    if (this.state === state) {
      return Promise.resolve(this);
    } else if (!isValidTransition(this._reachableStates, this.state, state)) {
      return Promise.reject(createUnreachableError(this.state, state));
    }
    return this._whenPromise((newState, resolve, reject) => {
      if (newState === state) {
        resolve(this);
      } else if (!isValidTransition(this._reachableStates, newState, state)) {
        reject(createUnreachableError(newState, state));
      }
    });
  }
}

/**
 * @event StateMachine#stateChanged
 * @param {string} newState
 */

/**
 * Check if a transition is valid.
 * @private
 * @param {Map<*, Set<*>>} graph
 * @param {*} from
 * @param {*} to
 * @returns {boolean}
 */
function isValidTransition(graph, from, to) {
  return graph.get(from).has(to);
}

/**
 * @typedef {object} StateMachine#Key
 */

function makeLock(name) {
  const lock = util.defer();
  lock.name = name;
  lock.depth = 0;
  return lock;
}

/**
 * Compute the transitive closure of a graph (i.e. what nodes are reachable from
 * where).
 * @private
 * @param {Map<*, Set<*>>} graph
 * @returns {Map<*, Set<*>>}
 */
function reachable(graph) {
  return Array.from(graph.keys()).reduce((newGraph, from) => newGraph.set(from, reachableFrom(graph, from)), new Map());
}

/**
 * Compute the Set of node reachable from a particular node in the graph.
 * @private
 * @param {Map<*, Set<*>>} graph
 * @param {*} from
 * @param {Set<*>} [to]
 * @returns {Set<*>}
 */
function reachableFrom(graph, from, to) {
  to = to || new Set();
  graph.get(from).forEach(node => {
    if (!to.has(node)) {
      to.add(node);
      reachableFrom(graph, node, to).forEach(to.add, to);
    }
  });
  return to;
}

function transformStates(states) {
  const newStates = new Map();
  for (const key in states) {
    newStates.set(key, new Set(states[key]));
  }
  return newStates;
}

/**
 * Create an "unreachable state" Error.
 * @param {string} here
 * @param {string} there
 * @returns {Error}
 */
function createUnreachableError(here, there) {
  return new Error(`"${there}" cannot be reached from "${here}"`);
}

module.exports = StateMachine;
