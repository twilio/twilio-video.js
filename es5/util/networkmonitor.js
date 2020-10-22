'use strict';

/**
 * Monitor the network connection status to detect interruptions and handoffs.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkMonitor = function () {
  /**
   * Construct a {@link NetworkMonitor}.
   * @param {function} onNetworkChanged
   * @param {*} [options]
   */
  function NetworkMonitor(onNetworkChanged, options) {
    var _this = this;

    _classCallCheck(this, NetworkMonitor);

    options = Object.assign({
      navigator: navigator,
      window: window
    }, options);

    var nav = options.navigator;
    var connection = nav.connection || { type: null };
    var type = connection.type;

    var _ref = connection.type ? {
      _events: {
        value: ['change', 'typechange']
      },
      _listener: {
        value: function value() {
          var networkChanged = type !== _this.type && _this.isOnline;
          type = _this.type;
          if (networkChanged) {
            onNetworkChanged();
          }
        }
      },
      _target: {
        value: connection
      }
    } : {
      _events: {
        value: ['online']
      },
      _listener: {
        value: onNetworkChanged
      },
      _target: {
        value: options.window
      }
    },
        _events = _ref._events,
        _listener = _ref._listener,
        _target = _ref._target;

    Object.defineProperties(this, {
      isOnline: {
        enumerable: true,
        get: function get() {
          return typeof nav.onLine === 'boolean' ? nav.onLine : true;
        }
      },
      type: {
        enumerable: true,
        get: function get() {
          return connection.type || null;
        }
      },
      _listener: _listener,
      _events: _events,
      _target: _target
    });
  }

  /**
   * Start the {@link NetworkMonitor}.
   */


  _createClass(NetworkMonitor, [{
    key: 'start',
    value: function start() {
      var _this2 = this;

      this._events.forEach(function (event) {
        _this2._target.addEventListener(event, _this2._listener);
      });
    }

    /**
     * Stop the {@link NetworkMonitor}.
     */

  }, {
    key: 'stop',
    value: function stop() {
      var _this3 = this;

      this._events.forEach(function (event) {
        _this3._target.removeEventListener(event, _this3._listener);
      });
    }
  }]);

  return NetworkMonitor;
}();

module.exports = NetworkMonitor;