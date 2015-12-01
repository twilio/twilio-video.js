'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./');

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
function TimeoutPromise(original, initialTimeout) {
  if (!(this instanceof TimeoutPromise)) {
    return new TimeoutPromise(original, initialTimeout);
  }
  EventEmitter.call(this);

  var deferred = util.defer();
  var isTimedOut = false;
  var timedOut = new Error('Timed out');
  var timeout = null;
  var timer = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deferred: {
      value: deferred
    },
    _isTimedOut: {
      get: function() {
        return isTimedOut;
      },
      set: function(_isTimedOut) {
        isTimedOut = _isTimedOut;
      }
    },
    _timedOut: {
      value: timedOut
    },
    _timeout: {
      get: function() {
        return timeout;
      },
      set: function(_timeout) {
        timeout = _timeout;
      }
    },
    _timer: {
      get: function() {
        return timer;
      },
      set: function(_timer) {
        timer = _timer;
      }
    },
    _promise: {
      value: deferred.promise
    },
    isTimedOut: {
      enumerable: true,
      get: function() {
        return isTimedOut;
      }
    },
    timeout: {
      enumerable: true,
      get: function() {
        return timeout;
      }
    }
  });

  var self = this;
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

inherits(TimeoutPromise, EventEmitter);

TimeoutPromise.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

/**
 * Start the timer that will time out the {@link TimeoutPromise} if the
 * original Promise has neither resolved nor rejected. Subsequent calls have no
 * effect once the {@link TimeoutPromise} is started.
 * @param {number} timeout - the timeout, in milliseconds
 * @returns {this}
 */
TimeoutPromise.prototype.start = function start(timeout) {
  if (this._timer) {
    return this;
  }
  var self = this;
  this._timeout = timeout;
  this._timer = setTimeout(function timer() {
    if (self._timer) {
      self._isTimedOut = true;
      self.emit('timedOut', self);
      self._deferred.reject(self._timedOut);
    }
  }, this.timeout);
  return this;
};

TimeoutPromise.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link TimeoutPromise} timed out.
 * @param {TimeoutPromise} promise - The {@link TimeoutPromise}
 * @event TimeoutPromise#timedOut
 */

module.exports = TimeoutPromise;
