'use strict';
/**
 * Monitor the network connection status to detect interruptions and handoffs.
 */
var NetworkMonitor = /** @class */ (function () {
    /**
     * Construct a {@link NetworkMonitor}.
     * @param {function} onNetworkChanged
     * @param {*} [options]
     */
    function NetworkMonitor(onNetworkChanged, options) {
        var _this = this;
        options = Object.assign({
            navigator: navigator,
            window: window,
        }, options);
        var nav = options.navigator;
        var connection = nav.connection || { type: null };
        var type = connection.type;
        var _a = connection.type ? {
            _events: {
                value: ['change', 'typechange']
            },
            _listener: {
                value: function () {
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
        }, _events = _a._events, _listener = _a._listener, _target = _a._target;
        Object.defineProperties(this, {
            isOnline: {
                enumerable: true,
                get: function () {
                    return typeof nav.onLine === 'boolean'
                        ? nav.onLine
                        : true;
                }
            },
            type: {
                enumerable: true,
                get: function () {
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
    NetworkMonitor.prototype.start = function () {
        var _this = this;
        this._events.forEach(function (event) {
            _this._target.addEventListener(event, _this._listener);
        });
    };
    /**
     * Stop the {@link NetworkMonitor}.
     */
    NetworkMonitor.prototype.stop = function () {
        var _this = this;
        this._events.forEach(function (event) {
            _this._target.removeEventListener(event, _this._listener);
        });
    };
    return NetworkMonitor;
}());
module.exports = NetworkMonitor;
//# sourceMappingURL=networkmonitor.js.map