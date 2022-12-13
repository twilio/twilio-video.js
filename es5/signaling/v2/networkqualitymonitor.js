/* eslint callback-return:0 */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var EventEmitter = require('events');
var PeerConnectionReportFactory = require('../../stats/peerconnectionreportfactory');
/**
 * @emits NetworkQualityMonitor#updated
 */
var NetworkQualityMonitor = /** @class */ (function (_super) {
    __extends(NetworkQualityMonitor, _super);
    /**
     * Construct a {@link NetworkQualityMonitor}.
     * @param {PeerConnectionManager} manager
     * @param {NetworkQualitySignaling} signaling
     */
    function NetworkQualityMonitor(manager, signaling) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _factories: {
                value: new WeakMap()
            },
            _manager: {
                value: manager
            },
            _signaling: {
                value: signaling
            }
        });
        signaling.on('updated', function () { return _this.emit('updated'); });
        return _this;
    }
    Object.defineProperty(NetworkQualityMonitor.prototype, "level", {
        /**
         * Get the current {@link NetworkQualityLevel}, if any.
         * @returns {?NetworkQualityLevel} level - initially null
         */
        get: function () {
            return this._signaling.level;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NetworkQualityMonitor.prototype, "levels", {
        /**
         * Get the current {@link NetworkQualityLevels}, if any.
         * @returns {?NetworkQualityLevels} levels - initially null
         */
        get: function () {
            return this._signaling.levels;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NetworkQualityMonitor.prototype, "remoteLevels", {
        /**
         * Get the current {@link NetworkQualityLevels} of remote participants, if any.
         * @returns {Map<String, NetworkQualityLevels>} remoteLevels
         */
        get: function () {
            return this._signaling.remoteLevels;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Start monitoring.
     * @returns {void}
     */
    NetworkQualityMonitor.prototype.start = function () {
        var _this = this;
        this.stop();
        var timeout = setTimeout(function () {
            if (_this._timeout !== timeout) {
                return;
            }
            next(_this).then(function (reports) {
                if (_this._timeout !== timeout) {
                    return;
                }
                if (reports.length) {
                    var _a = __read(reports, 1), report = _a[0];
                    _this._signaling.put(report);
                }
                _this.start();
            });
        }, 200);
        this._timeout = timeout;
    };
    /**
     * Stop monitoring.
     * @returns {void}
     */
    NetworkQualityMonitor.prototype.stop = function () {
        clearTimeout(this._timeout);
        this._timeout = null;
    };
    return NetworkQualityMonitor;
}(EventEmitter));
/**
 * @param {NetworkQualityMonitor}
 * @returns {Promise<NetworkQualityInputs>}
 */
function next(monitor) {
    var pcv2s = monitor._manager._peerConnections
        ? Array.from(monitor._manager._peerConnections.values())
        : [];
    var pcs = pcv2s
        .map(function (pcv2) { return pcv2._peerConnection; })
        .filter(function (pc) { return pc.signalingState !== 'closed'; });
    var factories = pcs.map(function (pc) {
        if (monitor._factories.has(pc)) {
            return monitor._factories.get(pc);
        }
        var factory = new PeerConnectionReportFactory(pc);
        monitor._factories.set(pc, factory);
        return factory;
    });
    var reportsOrNullPromises = factories.map(function (factory) { return factory.next().catch(function () { return null; }); });
    return Promise.all(reportsOrNullPromises).then(function (reportsOrNull) { return reportsOrNull
        .filter(function (reportOrNull) { return reportOrNull; })
        .map(function (report) { return report.summarize(); }); });
}
/**
 * The {@link NetworkQualityLevel} changed.
 * @event NetworkQualityMonitor#updated
 */
module.exports = NetworkQualityMonitor;
//# sourceMappingURL=networkqualitymonitor.js.map