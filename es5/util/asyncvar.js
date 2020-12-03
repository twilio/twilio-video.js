'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('./'),
    defer = _require.defer;

/**
 * An {@link AsyncVar} is an "asynchronous variable" which may or may not
 * contain a value of some type T. You can put a value into the {@link AsyncVar}
 * with {@link AsyncVar#put}. Callers can take a value out of the
 * {@link AsyncVar} by queueing up with {@link AsyncVar#take}. N calls to
 * {@link AsyncVar#take} require N calls to {@link AsyncVar#put} to resolve, and
 * they resolve in order.
 */


var AsyncVar = function () {
  /**
   * Construct an {@link AsyncVar}.
   */
  function AsyncVar() {
    _classCallCheck(this, AsyncVar);

    Object.defineProperties(this, {
      _deferreds: {
        value: []
      },
      _hasValue: {
        value: false,
        writable: true
      },
      _value: {
        value: null,
        writable: true
      }
    });
  }

  /**
   * Put a value into the {@link AsyncVar}.
   * @param {T} value
   * @returns {this}
   */


  _createClass(AsyncVar, [{
    key: 'put',
    value: function put(value) {
      this._hasValue = true;
      this._value = value;
      var deferred = this._deferreds.shift();
      if (deferred) {
        deferred.resolve(value);
      }
      return this;
    }

    /**
     * Take the value out of the {@link AsyncVar}.
     * @returns {Promise<T>}
     */

  }, {
    key: 'take',
    value: function take() {
      var _this = this;

      if (this._hasValue && !this._deferreds.length) {
        this._hasValue = false;
        return Promise.resolve(this._value);
      }
      var deferred = defer();
      this._deferreds.push(deferred);
      return deferred.promise.then(function (value) {
        _this._hasValue = false;
        return value;
      });
    }
  }]);

  return AsyncVar;
}();

module.exports = AsyncVar;