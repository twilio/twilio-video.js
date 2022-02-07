'use strict';
var _a = require('../../util/constants'), ICE_ACTIVITY_CHECK_PERIOD_MS = _a.ICE_ACTIVITY_CHECK_PERIOD_MS, ICE_INACTIVITY_THRESHOLD_MS = _a.ICE_INACTIVITY_THRESHOLD_MS;
/**
 * Monitors a {@link RTCPeerConnection}'s stats and notifies
 * caller when inactivity is detected.
 */
var IceConnectionMonitor = /** @class */ (function () {
    /**
     * Construct an {@link IceConnectionMonitor}.
     * @param {RTCPeerConnection} peerConnection
     * @param {object} [options]
     */
    function IceConnectionMonitor(peerConnection, options) {
        options = Object.assign({
            activityCheckPeriodMs: ICE_ACTIVITY_CHECK_PERIOD_MS,
            inactivityThresholdMs: ICE_INACTIVITY_THRESHOLD_MS,
        }, options);
        Object.defineProperties(this, {
            _activityCheckPeriodMs: {
                value: options.activityCheckPeriodMs
            },
            _inactivityThresholdMs: {
                value: options.inactivityThresholdMs
            },
            _lastActivity: {
                value: null,
                writable: true
            },
            _peerConnection: {
                value: peerConnection
            },
            _timer: {
                value: null,
                writable: true,
            },
            _onIceConnectionStateChanged: {
                value: null,
                writable: true
            }
        });
    }
    IceConnectionMonitor.prototype._getActivePairStat = function (stats) {
        var statsArray = Array.from(stats.values());
        var activePairStats = statsArray.find(function (stat) { return stat.type === 'candidate-pair' && stat.nominated; });
        // NOTE(mpatwardhan): sometimes (JSDK-2667) after getting disconnected while switching network
        // we may not find active pair. Treat this as 0 bytesReceived so that we count it towards inactivity.
        return activePairStats || {
            bytesReceived: 0,
            timestamp: Math.round((new Date()).getTime())
        };
    };
    /**
     * Get ICE connection stats, and extract received and send bytes.
     * @returns Promise<?RTCIceCandidatePairStats>
     */
    IceConnectionMonitor.prototype._getIceConnectionStats = function () {
        var _this = this;
        return this._peerConnection.getStats().then(function (stats) { return _this._getActivePairStat(stats); }).catch(function () {
            return null;
        });
    };
    /**
     * schedules/un-schedules inactivity callback.
     */
    IceConnectionMonitor.prototype._scheduleInactivityCallback = function (callback) {
        var _this = this;
        if (callback && this._onIceConnectionStateChanged === null) {
            // schedule callback
            this._onIceConnectionStateChanged = function () {
                if (_this._peerConnection.iceConnectionState === 'disconnected') {
                    // eslint-disable-next-line callback-return
                    callback();
                }
            };
            this._peerConnection.addEventListener('iceconnectionstatechange', this._onIceConnectionStateChanged);
        }
        else if (!callback && this._onIceConnectionStateChanged) {
            // unschedule callback
            this._peerConnection.removeEventListener('iceconnectionstatechange', this._onIceConnectionStateChanged);
            this._onIceConnectionStateChanged = null;
        }
    };
    /**
     * Start monitoring the ICE connection.
     * Monitors bytes received on active ice connection pair,
     * invokes onIceConnectionInactive when inactivity is detected.
     * @param {function} onIceConnectionInactive
     */
    IceConnectionMonitor.prototype.start = function (onIceConnectionInactive) {
        var _this = this;
        this.stop();
        this._timer = setInterval(function () {
            _this._getIceConnectionStats().then(function (iceStats) {
                if (!iceStats) {
                    return;
                }
                // NOTE(mpatwardhan): We look at bytesReceived on active candidate pair as an indication of active ice connection.
                // As per spec (https://w3c.github.io/webrtc-stats/#dom-rtcicecandidatepairstats-bytesreceived) this value
                // includes RTCP traffic and is +ve even when there are no tracks subscribed to.
                if (!_this._lastActivity || _this._lastActivity.bytesReceived !== iceStats.bytesReceived) {
                    _this._lastActivity = iceStats;
                    // detected activity, cancel scheduled callback if any.
                    _this._scheduleInactivityCallback(null);
                }
                if (iceStats.timestamp - _this._lastActivity.timestamp >= _this._inactivityThresholdMs) {
                    // detected inactivity.
                    if (_this._peerConnection.iceConnectionState === 'disconnected') {
                        onIceConnectionInactive();
                    }
                    else if (_this._onIceConnectionStateChanged === null) {
                        _this._scheduleInactivityCallback(onIceConnectionInactive);
                    }
                }
            });
        }, this._activityCheckPeriodMs);
    };
    /**
     * Stop monitoring the ICE connection state.
     * @returns {void}
     */
    IceConnectionMonitor.prototype.stop = function () {
        this._scheduleInactivityCallback(null);
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
            this._lastActivity = null;
        }
    };
    return IceConnectionMonitor;
}());
module.exports = IceConnectionMonitor;
//# sourceMappingURL=iceconnectionmonitor.js.map