'use strict';

const EventEmitter = require('events').EventEmitter;
const util = require('./');

/**
 * Construct a new {@link TimeoutPromise}.
 * @class
 * @classdesc A Promise that can time out.
 * @extends Promise
 * @param {Promise} original - a Promise
 * @param {?number} [timeout] - the timeout, in milliseconds; providing this in
 *   the constructor invokes {@link TimeoutPromise#start} (otherwise, you must
 *   call {@link TimeoutPromise#start} yourself)
 * @property {?number} timeout - the timeout, in milliseconds
 * @property {boolean} isTimedOut - whether or not the
 *   {@link TimeoutPromise} timed out
 * @fires TimeoutPromise#timedOut
 */
class TimeoutPromise extends EventEmitter {
  constructor(original, initialTimeout) {
    super();

    const deferred = util.defer();
    let isTimedOut = false;
    const timedOut = new Error('Timed out');
    let timeout = null;
    let timer = null;

    /* istanbul ignore next */
    Object.defineProperties(this, {
      _deferred: {
        value: deferred
      },
      _isTimedOut: {
        get() {
          return isTimedOut;
        },
        set(_isTimedOut) {
          isTimedOut = _isTimedOut;
        }
      },
      _timedOut: {
        value: timedOut
      },
      _timeout: {
        get() {
          return timeout;
        },
        set(_timeout) {
          timeout = _timeout;
        }
      },
      _timer: {
        get() {
          return timer;
        },
        set(_timer) {
          timer = _timer;
        }
      },
      _promise: {
        value: deferred.promise
      },
      isTimedOut: {
        enumerable: true,
        get() {
          return isTimedOut;
        }
      },
      timeout: {
        enumerable: true,
        get() {
          return timeout;
        }
      }
    });

    const self = this;
    original.then(function originalResolved() {
      clearTimeout(self._timer);
      deferred.resolve.apply(deferred.promise, arguments);
    }, function originalRejected() {
      clearTimeout(self._timer);
      deferred.reject.apply(deferred.promise, arguments);
    });

    if (initialTimeout) {
      this.start(initialTimeout);
    }
  }

  catch() {
    return this._promise.catch(...arguments);
  }

  /**
   * Start the timer that will time out the {@link TimeoutPromise} if the
   * original Promise has neither resolved nor rejected. Subsequent calls have no
   * effect once the {@link TimeoutPromise} is started.
   * @param {number} timeout - the timeout, in milliseconds
   * @returns {this}
   */
  start(timeout) {
    if (this._timer) {
      return this;
    }
    const self = this;
    this._timeout = timeout;
    this._timer = setTimeout(function timer() {
      if (self._timer) {
        self._isTimedOut = true;
        self.emit('timedOut', self);
        self._deferred.reject(self._timedOut);
      }
    }, this.timeout);
    return this;
  }

  then() {
    return this._promise.then(...arguments);
  }
}

/**
 * The {@link TimeoutPromise} timed out.
 * @param {TimeoutPromise} promise - The {@link TimeoutPromise}
 * @event TimeoutPromise#timedOut
 */

module.exports = TimeoutPromise;
