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
   * @param {boolean} [autoStart=true] - If true, then start the {@link Timeout}.
   */
  function Timeout(fn, delay) {
    var autoStart = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    _classCallCheck(this, Timeout);

    Object.defineProperties(this, {
      _delay: {
        value: delay,
        writable: true
      },
      _fn: {
        value: fn
      },
      _timeout: {
        value: null,
        writable: true
      }
    });

    if (autoStart) {
      this.start();
    }
  }

  /**
   * The {@link Timeout} delay in milliseconds.
   * @property {number}
   */


  _createClass(Timeout, [{
    key: 'setDelay',


    /**
     * Update the {@link Timeout} delay.
     * @param {number} delay
     * @returns {void}
     */
    value: function setDelay(delay) {
      this._delay = delay;
    }

    /**
     * Start the {@link Timeout}, if not already started.
     * @returns {void}
     */

  }, {
    key: 'start',
    value: function start() {
      var _this = this;

      if (!this.isSet) {
        this._timeout = setTimeout(function () {
          var fn = _this._fn;
          _this.clear();
          fn();
        }, this._delay);
      }
    }

    /**
     * Clear the {@link Timeout}.
     * @returns {void}
     */

  }, {
    key: 'clear',
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
      this.clear();
      this.start();
    }
  }, {
    key: 'delay',
    get: function get() {
      return this._delay;
    }

    /**
     * Whether the {@link Timeout} is set.
     * @property {boolean}
     */

  }, {
    key: 'isSet',
    get: function get() {
      return !!this._timeout;
    }
  }]);

  return Timeout;
}();

module.exports = Timeout;