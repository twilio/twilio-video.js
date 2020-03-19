'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('../../util/constants'),
    ICE_ACTIVITY_CHECK_PERIOD_MS = _require.ICE_ACTIVITY_CHECK_PERIOD_MS,
    ICE_INACTIVITY_THRESHOLD_MS = _require.ICE_INACTIVITY_THRESHOLD_MS;

/**
 * Monitors a {@link RTCPeerConnection}'s stats and notifies
 * caller when inactivity is detected.
 */


var IceConnectionMonitor = function () {
  /**
   * Construct an {@link IceConnectionMonitor}.
   * @param {RTCPeerConnection} peerConnection
   * @param {object} [options]
   */
  function IceConnectionMonitor(peerConnection, options) {
    _classCallCheck(this, IceConnectionMonitor);

    options = Object.assign({
      activityCheckPeriodMs: ICE_ACTIVITY_CHECK_PERIOD_MS,
      inactivityThresholdMs: ICE_INACTIVITY_THRESHOLD_MS
    }, options);

    Object.defineProperties(this, {
      _activityCheckPeriodMs: {
        value: options.activityCheckPeriodMs
      },
      _inactivityThresholdMs: {
        value: options.inactivityThresholdMs
      },
      _lastActiveStats: {
        value: null,
        writable: true
      },
      _peerConnection: {
        value: peerConnection
      },
      _timer: {
        value: null,
        writable: true
      }
    });
  }

  /**
   * Get ICE connection stats, and extract received and send bytes.
   * @returns Promise<?RTCIceCandidatePairStats>
   */


  _createClass(IceConnectionMonitor, [{
    key: '_getIceConnectionStats',
    value: function _getIceConnectionStats() {
      return this._peerConnection.getStats().then(function (stats) {
        return Array.from(stats.values()).find(function (stat) {
          return stat.type === 'candidate-pair' && stat.nominated;
        });
      }).then(function (activePairStat) {
        // NOTE(mpatwardhan): sometimes (JSDK-2667) after getting disconnected while switching network
        // we may not find active pair. Treat this as 0 bytesReceived so that we count it towards inactivity.
        return activePairStat || {
          bytesReceived: 0,
          timestamp: Math.round(new Date().getTime())
        };
      }).catch(function () {
        return null;
      });
    }

    /**
     * Start monitoring the ICE connection.
     * Monitors bytes received on active ice connection pair,
     * invokes onIceConnectionInactive when inactivity is detected.
     * @param {function} onIceConnectionInactive
     */

  }, {
    key: 'start',
    value: function start(onIceConnectionInactive) {
      var _this = this;

      this.stop();
      this._timer = setInterval(function () {
        _this._getIceConnectionStats().then(function (iceStats) {
          if (!iceStats) {
            return;
          }

          if (!_this._lastActivity || _this._lastActivity.bytesReceived !== iceStats.bytesReceived) {
            _this._lastActivity = iceStats;
          }

          if (iceStats.timestamp - _this._lastActivity.timestamp >= _this._inactivityThresholdMs) {
            onIceConnectionInactive();
          }
        });
      }, this._activityCheckPeriodMs);
    }

    /**
     * Stop monitoring the ICE connection state.
     * @returns {void}
     */

  }, {
    key: 'stop',
    value: function stop() {
      if (this._timer !== null) {
        clearInterval(this._timer);
        this._timer = null;
        this._lastActivity = null;
      }
    }
  }]);

  return IceConnectionMonitor;
}();

module.exports = IceConnectionMonitor;