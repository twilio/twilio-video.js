'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;
var util = require('./');

/**
 * A Promise that can time out.
 * @extends EventEmitter
 * @implements Promise
 * @property {?number} timeout - the timeout, in milliseconds
 * @property {boolean} isTimedOut - whether or not the
 *   {@link TimeoutPromise} timed out
 * @emits TimeoutPromise#timedOut
 */

var TimeoutPromise = function (_EventEmitter) {
  _inherits(TimeoutPromise, _EventEmitter);

  /**
   * Construct a new {@link TimeoutPromise}.
   * @param {Promise} original - a Promise
   * @param {?number} [timeout] - the timeout, in milliseconds; providing this in
   *   the constructor invokes {@link TimeoutPromise#start} (otherwise, you must
   *   call {@link TimeoutPromise#start} yourself)
   */
  function TimeoutPromise(original, initialTimeout) {
    _classCallCheck(this, TimeoutPromise);

    var _this = _possibleConstructorReturn(this, (TimeoutPromise.__proto__ || Object.getPrototypeOf(TimeoutPromise)).call(this));

    var deferred = util.defer();
    var isTimedOut = false;
    var timedOut = new Error('Timed out');
    var timeout = null;
    var timer = null;

    /* istanbul ignore next */
    Object.defineProperties(_this, {
      _deferred: {
        value: deferred
      },
      _isTimedOut: {
        get: function get() {
          return isTimedOut;
        },
        set: function set(_isTimedOut) {
          isTimedOut = _isTimedOut;
        }
      },
      _timedOut: {
        value: timedOut
      },
      _timeout: {
        get: function get() {
          return timeout;
        },
        set: function set(_timeout) {
          timeout = _timeout;
        }
      },
      _timer: {
        get: function get() {
          return timer;
        },
        set: function set(_timer) {
          timer = _timer;
        }
      },
      _promise: {
        value: deferred.promise
      },
      isTimedOut: {
        enumerable: true,
        get: function get() {
          return isTimedOut;
        }
      },
      timeout: {
        enumerable: true,
        get: function get() {
          return timeout;
        }
      }
    });

    original.then(function (result) {
      clearTimeout(_this._timer);
      deferred.resolve(result);
    }, function (reason) {
      clearTimeout(_this._timer);
      deferred.reject(reason);
    });

    if (initialTimeout) {
      _this.start(initialTimeout);
    }
    return _this;
  }

  _createClass(TimeoutPromise, [{
    key: 'catch',
    value: function _catch() {
      var _promise;

      return (_promise = this._promise).catch.apply(_promise, arguments);
    }

    /**
     * Start the timer that will time out the {@link TimeoutPromise} if the
     * original Promise has neither resolved nor rejected. Subsequent calls have no
     * effect once the {@link TimeoutPromise} is started.
     * @param {number} timeout - the timeout, in milliseconds
     * @returns {this}
     */

  }, {
    key: 'start',
    value: function start(timeout) {
      var _this2 = this;

      if (this._timer) {
        return this;
      }
      this._timeout = timeout;
      this._timer = setTimeout(function () {
        if (_this2._timer) {
          _this2._isTimedOut = true;
          _this2.emit('timedOut', _this2);
          _this2._deferred.reject(_this2._timedOut);
        }
      }, this.timeout);
      return this;
    }
  }, {
    key: 'then',
    value: function then() {
      var _promise2;

      return (_promise2 = this._promise).then.apply(_promise2, arguments);
    }
  }]);

  return TimeoutPromise;
}(EventEmitter);

/**
 * The {@link TimeoutPromise} timed out.
 * @param {TimeoutPromise} promise - The {@link TimeoutPromise}
 * @event TimeoutPromise#timedOut
 */

module.exports = TimeoutPromise;