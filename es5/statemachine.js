'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;
var util = require('./util');

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

var StateMachine = function (_EventEmitter) {
  _inherits(StateMachine, _EventEmitter);

  /**
   * Construct a {@link StateMachine}.
   * @param {string} initialState - the intiial state
   * @param {object} states
   */
  function StateMachine(initialState, states) {
    _classCallCheck(this, StateMachine);

    var _this = _possibleConstructorReturn(this, (StateMachine.__proto__ || Object.getPrototypeOf(StateMachine)).call(this));

    var lock = null;
    var state = initialState;
    states = transformStates(states);
    Object.defineProperties(_this, {
      _lock: {
        get: function get() {
          return lock;
        },
        set: function set(_lock) {
          lock = _lock;
        }
      },
      _reachableStates: {
        value: reachable(states)
      },
      _state: {
        get: function get() {
          return state;
        },
        set: function set(_state) {
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
        get: function get() {
          return lock !== null;
        }
      },
      state: {
        enumerable: true,
        get: function get() {
          return state;
        }
      }
    });

    _this.on('stateChanged', function (state) {
      _this._whenDeferreds.forEach(function (deferred) {
        deferred.when(state, deferred.resolve, deferred.reject);
      });
    });
    return _this;
  }

  /**
   * Returns a promise whose executor function is called on each state change.
   * @param {function(state: string, resolve: function, reject: function): void} when
   * @returns {Promise.<*>}
   * @private
   */


  _createClass(StateMachine, [{
    key: '_whenPromise',
    value: function _whenPromise(when) {
      var _this2 = this;

      if (typeof when !== 'function') {
        return Promise.reject(new Error('when() executor must be a function'));
      }

      var deferred = util.defer();

      deferred.when = when;
      this._whenDeferreds.add(deferred);

      return deferred.promise.then(function (payload) {
        _this2._whenDeferreds.delete(deferred);
        return payload;
      }, function (error) {
        _this2._whenDeferreds.delete(deferred);
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

  }, {
    key: 'bracket',
    value: function bracket(name, transitionFunction) {
      var key = void 0;
      var self = this;

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

  }, {
    key: 'hasLock',
    value: function hasLock(key) {
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

  }, {
    key: 'preempt',
    value: function preempt(newState, name, payload) {
      // 1. Check that the new state is valid.
      if (!isValidTransition(this._states, this.state, newState)) {
        throw new Error('Cannot transition from "' + this.state + '" to "' + newState + '"');
      }

      // 2. Release the old lock, if any.
      var oldLock = void 0;
      if (this.isLocked) {
        oldLock = this._lock;
        this._lock = null;
      }

      // 3. Take the lock, if requested.
      var key = null;
      if (name) {
        key = this.takeLockSync(name);
      }

      // 4. If a lock wasn't requested, take a "preemption" lock in order to
      // maintain FIFO order of those taking locks.
      var preemptionKey = key ? null : this.takeLockSync('preemption');

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

  }, {
    key: 'releaseLock',
    value: function releaseLock(key) {
      if (!this.isLocked) {
        throw new Error('Could not release the lock for ' + key.name + ' because the StateMachine is not locked');
      } else if (!this.hasLock(key)) {
        throw new Error('Could not release the lock for ' + key.name + ' because ' + this._lock.name + ' has the lock');
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

  }, {
    key: 'releaseLockCompletely',
    value: function releaseLockCompletely(key) {
      if (!this.isLocked) {
        throw new Error('Could not release the lock for ' + key.name + ' because the StateMachine is not locked');
      } else if (!this.hasLock(key)) {
        throw new Error('Could not release the lock for ' + key.name + ' because ' + this._lock.name + ' has the lock');
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

  }, {
    key: 'takeLock',
    value: function takeLock(nameOrKey) {
      var _this3 = this;

      // Reentrant lock
      if ((typeof nameOrKey === 'undefined' ? 'undefined' : _typeof(nameOrKey)) === 'object') {
        var key = nameOrKey;
        return new Promise(function (resolve) {
          resolve(_this3.takeLockSync(key));
        });
      }

      // New lock
      var name = nameOrKey;
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

  }, {
    key: 'takeLockSync',
    value: function takeLockSync(nameOrKey) {
      var key = typeof nameOrKey === 'string' ? null : nameOrKey;
      var name = key ? key.name : nameOrKey;

      if (key && !this.hasLock(key) || !key && this.isLocked) {
        throw new Error('Could not take the lock for ' + name + ' because the lock for ' + this._lock.name + ' was not released');
      }

      // Reentrant lock
      if (key) {
        key.depth++;
        return key;
      }

      // New lock
      var lock = makeLock(name);
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

  }, {
    key: 'transition',
    value: function transition(newState, key, payload) {
      payload = payload || [];

      // 1. If we're locked, required the key.
      if (this.isLocked) {
        if (!key) {
          throw new Error('You must provide the key in order to ' + 'transition');
        } else if (!this.hasLock(key)) {
          throw new Error('Could not transition using the key for ' + key.name + ' because ' + this._lock.name + ' has the lock');
        }
      } else if (key) {
        throw new Error('Key provided for ' + key.name + ', but the StateMachine was not locked (possibly due to preemption)');
      }

      // 2. Check that the new state is valid.
      if (!isValidTransition(this._states, this.state, newState)) {
        throw new Error('Cannot transition from "' + this.state + '" to "' + newState + '"');
      }

      // 3. Update the state and emit an event.
      this._state = newState;
      this.emit.apply(this, _toConsumableArray(['stateChanged', newState].concat(payload)));
    }

    /**
     * Attempt to transition to a new state. Unlike {@link StateMachine#transition},
     * this method does not throw.
     * @param {string} newState
     * @param {?StateMachine#Key} [key=null]
     * @param {Array<*>} [payload=[]]
     * @returns {boolean}
     */

  }, {
    key: 'tryTransition',
    value: function tryTransition(newState, key, payload) {
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

  }, {
    key: 'when',
    value: function when(state) {
      var _this4 = this;

      if (this.state === state) {
        return Promise.resolve(this);
      } else if (!isValidTransition(this._reachableStates, this.state, state)) {
        return Promise.reject(createUnreachableError(this.state, state));
      }
      return this._whenPromise(function (newState, resolve, reject) {
        if (newState === state) {
          resolve(_this4);
        } else if (!isValidTransition(_this4._reachableStates, newState, state)) {
          reject(createUnreachableError(newState, state));
        }
      });
    }
  }]);

  return StateMachine;
}(EventEmitter);

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
  var lock = util.defer();
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
  return Array.from(graph.keys()).reduce(function (newGraph, from) {
    return newGraph.set(from, reachableFrom(graph, from));
  }, new Map());
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
  graph.get(from).forEach(function (node) {
    if (!to.has(node)) {
      to.add(node);
      reachableFrom(graph, node, to).forEach(to.add, to);
    }
  });
  return to;
}

function transformStates(states) {
  var newStates = new Map();
  for (var key in states) {
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
  return new Error('"' + there + '" cannot be reached from "' + here + '"');
}

module.exports = StateMachine;