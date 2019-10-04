'use strict';

/**
 * A {@link Timeout} represents a resettable and clearable timeout.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Timeout = function () {
  /**
   * Construct a {@link Timeout}.
   * @param {function} fn - Function to call
   * @param {number} delay - Delay in milliseconds
   */
  function Timeout(fn, delay) {
    _classCallCheck(this, Timeout);

    Object.defineProperties(this, {
      _delay: {
        value: delay
      },
      _fn: {
        value: fn
      },
      _timeout: {
        value: null,
        writable: true
      }
    });

    this._start();
  }

  /**
   * Start the {@link Timeout}.
   * @private
   */


  _createClass(Timeout, [{
    key: '_start',
    value: function _start() {
      this._timeout = setTimeout(this._fn, this._delay);
    }

    /**
     * Whether the {@link Timeout} is set.
     * @property {boolean}
     */

  }, {
    key: 'clear',


    /**
     * Clear the {@link Timeout}.
     * @returns {void}
     */
    value: function clear() {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    /**
     * Reset the {@link Timeout}.
     * @returns {void}
     */

  }, {
    key: 'reset',
    value: function reset() {
      clearTimeout(this._timeout);
      this._start();
    }
  }, {
    key: 'isSet',
    get: function get() {
      return !!this._timeout;
    }
  }]);

  return Timeout;
}();

module.exports = Timeout;