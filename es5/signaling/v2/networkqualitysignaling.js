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
var MediaSignaling = require('./mediasignaling');
var AsyncVar = require('../../util/asyncvar');
var Timeout = require('../../util/timeout');
var NETWORK_QUALITY_RESPONSE_TIME_MS = 5000;
/**
 * @interface MediaSignalingTransport
 * @property {function(object): boolean} send
 * @emits MediaSignalingTransport#message
 */
/**
 * The {@link MediaSignalingTransport} received a message.
 * @event MediaSignalingTransport#message
 * @param {object} message
 */
/**
 * @interface LatencyStats
 * @property {number} jitter
 * @property {number} rtt
 * @property {number} level
 */
/**
 * @interface FractionLostStats
 * @property {number} fractionLost
 * @property {number} level
 */
/**
 * @interface BandwidthStats
 * @property {number} actual
 * @property {number} available
 * @property {number} level
 */
/**
 * @interface SendOrRecvStats
 * @property {BandwidthStats} bandwidth
 * @property {FractionLostStats} fractionLost
 * @property {LatencyStats} latency
 */
/**
 * @interface MediaLevels
 * @property {number} send
 * @property {SendOrRecvStats} sendStats
 * @property {number} recv
 * @property {SendOrRecvStats} recvStats
 */
/**
 * @interface NetworkQualityLevels
 * @property {number} level
 * @property {MediaLevels} audio
 * @property {MediaLevels} video
 */
/**
 * @typedef {PeerConnectionSummary} NetworkQualityInputs
 */
/**
 * @classdesc The {@link NetworkQualitySignaling} class allows submitting
 *   {@link NetworkQualityInputs} for computing {@link NetworkQualityLevel}. It
 *   does so by sending and receiving messages over a
 *   {@link MediaSignalingTransport}. The exact transport used depends on the
 *   topology of the {@link Room} that {@link NetworkQualitySignaling} is being
 *   used within: for P2P Rooms, we re-use the {@link TransportV2}; and for
 *   Group Rooms, we use a {@link DataTransport}.
 * @emits NetworkQualitySignaling#updated
 */
var NetworkQualitySignaling = /** @class */ (function (_super) {
    __extends(NetworkQualitySignaling, _super);
    /**
     * Construct a {@link NetworkQualitySignaling}.
     * @param {Promise<DataTrackReceiver>} getReceiver
     * @param {NetworkQualityConfigurationImpl} networkQualityConfiguration
     */
    function NetworkQualitySignaling(getReceiver, networkQualityConfiguration, options) {
        var _this = _super.call(this, getReceiver, 'network_quality', options) || this;
        Object.defineProperties(_this, {
            _level: {
                value: null,
                writable: true
            },
            _levels: {
                value: null,
                writable: true
            },
            _remoteLevels: {
                value: new Map(),
                writable: true
            },
            _networkQualityInputs: {
                value: new AsyncVar()
            },
            _resendTimer: {
                value: new Timeout(function () {
                    // and schedule next timer at x1.5 the delay..
                    _this._resendTimer.setDelay(_this._resendTimer.delay * 1.5);
                    _this._sendNetworkQualityInputs();
                }, NETWORK_QUALITY_RESPONSE_TIME_MS, false),
            },
            _networkQualityReportLevels: {
                get: function () {
                    return {
                        reportLevel: networkQualityConfiguration.local,
                        remoteReportLevel: networkQualityConfiguration.remote
                    };
                }
            }
        });
        _this.on('ready', function (transport) {
            transport.on('message', function (message) {
                _this._log.debug('Incoming: ', message);
                switch (message.type) {
                    case 'network_quality':
                        _this._handleNetworkQualityMessage(message);
                        break;
                    default:
                        break;
                }
            });
        });
        _this._sendNetworkQualityInputs();
        return _this;
    }
    Object.defineProperty(NetworkQualitySignaling.prototype, "level", {
        /**
         * Get the current {@link NetworkQualityLevel}, if any.
         * @returns {?NetworkQualityLevel} level - initially null
         */
        get: function () {
            return this._level;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NetworkQualitySignaling.prototype, "levels", {
        /**
         * Get the current {@link NetworkQualityLevels}, if any.
         * @returns {?NetworkQualityLevels} levels - initially null
         */
        get: function () {
            return this._levels;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NetworkQualitySignaling.prototype, "remoteLevels", {
        /**
         * Get the current {@link NetworkQualityLevels} of remote participants, if any.
         * @returns {Map<String, NetworkQualityLevels>} remoteLevels
         */
        get: function () {
            return this._remoteLevels;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Check to see if the {@link NetworkQualityLevel} is new, and raise an
     * event if necessary.
     * @private
     * @param {object} message
     * @returns {void}
     */
    NetworkQualitySignaling.prototype._handleNetworkQualityMessage = function (message) {
        var _this = this;
        var updated = false;
        var level = null;
        var local = message ? message.local : null;
        if (typeof local === 'number') {
            // NOTE(mroberts): In prod, we plan to only send the level.
            level = local;
            this._levels = null;
        }
        else if (typeof local === 'object' && local) {
            // NOTE(mroberts): In dev, we plan to send the decomposed levels. An early
            // VMS version does not compute `level` for us, so we fallback to taking
            // the minimum ourselves.
            this._levels = local;
            level = typeof local.level === 'number'
                ? local.level
                : Math.min(local.audio.send, local.audio.recv, local.video.send, local.video.recv);
        }
        if (level !== null && this.level !== level) {
            this._level = level;
            updated = true;
        }
        this._remoteLevels = message && message.remotes
            ? message.remotes.reduce(function (levels, obj) {
                var oldObj = _this._remoteLevels.get(obj.sid) || {};
                if (oldObj.level !== obj.level) {
                    updated = true;
                }
                return levels.set(obj.sid, obj);
            }, new Map())
            : this._remoteLevels;
        if (updated) {
            this.emit('updated');
        }
        // score is received. so reset the timer to default timeout.
        this._resendTimer.setDelay(NETWORK_QUALITY_RESPONSE_TIME_MS);
        // timer is cleared only while we are sending inputs.
        // if we are already sending inputs do not send them again.
        if (this._resendTimer.isSet) {
            setTimeout(function () { return _this._sendNetworkQualityInputs(); }, 1000);
        }
    };
    /**
     * Start sending {@link NetworkQualityInputs}.
     * @private
     * @returns {Promise<void>}
     */
    NetworkQualitySignaling.prototype._sendNetworkQualityInputs = function () {
        var _this = this;
        this._resendTimer.clear();
        return this._networkQualityInputs.take().then(function (networkQualityInputs) {
            if (_this._transport) {
                _this._transport.publish(createNetworkQualityInputsMessage(networkQualityInputs, _this._networkQualityReportLevels));
            }
        }).finally(function () {
            _this._resendTimer.start();
        });
    };
    /**
     * Put {@link NetworkQualityInputs} to be used for computing
     * {@link NetworkQualityLevel}.
     * @param {NetworkQualityInputs} networkQualityInputs
     * @returns {void}
     */
    NetworkQualitySignaling.prototype.put = function (networkQualityInputs) {
        this._networkQualityInputs.put(networkQualityInputs);
    };
    return NetworkQualitySignaling;
}(MediaSignaling));
/**
 * The {@link NetworkQualityLevel} changed.
 * @event NetworkQualitySignaling#updated
 */
/**
 * @typedef {object} NetworkQualityReportLevels
 * @param {number} reportLevel
 * @param {number} remoteReportLevel
 */
/**
 * @param {NetworkQualityInputs} networkQualityInputs
 * @param {NetworkQualityReportLevels} networkQualityReportLevels
 * @returns {object} message
 */
function createNetworkQualityInputsMessage(networkQualityInputs, networkQualityReportLevels) {
    return Object.assign({ type: 'network_quality' }, networkQualityInputs, networkQualityReportLevels);
}
module.exports = NetworkQualitySignaling;
//# sourceMappingURL=networkqualitysignaling.js.map