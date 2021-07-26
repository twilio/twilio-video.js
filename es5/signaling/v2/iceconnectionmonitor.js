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
      _lastActivity: {
        value: null,
        writable: true
      },
      _peerConnection: {
        value: peerConnection
      },
      _timer: {
        value: null,
        writable: true
      },
      _onIceConnectionStateChanged: {
        value: null,
        writable: true
      }
    });
  }

  _createClass(IceConnectionMonitor, [{
    key: '_getActivePairStat',
    value: function _getActivePairStat(stats) {
      var statsArray = Array.from(stats.values());
      var hasInBoundTracks = statsArray.find(function (stat) {
        return stat.type === 'inbound-rtp';
      });
      if (!hasInBoundTracks) {
        // NOTE(mpatwardhan): when there are no tracks shared on a peerConnection
        // we may see inactivity on bytesReceived - but that is not real inactivity,
        // ignore it.
        return null;
      }

      var activePairStats = statsArray.find(function (stat) {
        return stat.type === 'candidate-pair' && stat.nominated;
      });
      // NOTE(mpatwardhan): sometimes (JSDK-2667) after getting disconnected while switching network
      // we may not find active pair. Treat this as 0 bytesReceived so that we count it towards inactivity.
      return activePairStats || {
        bytesReceived: 0,
        timestamp: Math.round(new Date().getTime())
      };
    }

    /**
     * Get ICE connection stats, and extract received and send bytes.
     * @returns Promise<?RTCIceCandidatePairStats>
     */

  }, {
    key: '_getIceConnectionStats',
    value: function _getIceConnectionStats() {
      var _this = this;

      return this._peerConnection.getStats().then(function (stats) {
        return _this._getActivePairStat(stats);
      }).catch(function () {
        return null;
      });
    }

    /**
     * schedules/un-schedules inactivity callback.
     */

  }, {
    key: '_scheduleInactivityCallback',
    value: function _scheduleInactivityCallback(callback) {
      var _this2 = this;

      if (callback && this._onIceConnectionStateChanged === null) {
        // schedule callback
        this._onIceConnectionStateChanged = function () {
          if (_this2._peerConnection.iceConnectionState === 'disconnected') {
            // eslint-disable-next-line callback-return
            callback();
          }
        };
        this._peerConnection.addEventListener('iceconnectionstatechange', this._onIceConnectionStateChanged);
      } else if (!callback && this._onIceConnectionStateChanged) {
        // unschedule callback
        this._peerConnection.removeEventListener('iceconnectionstatechange', this._onIceConnectionStateChanged);
        this._onIceConnectionStateChanged = null;
      }
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
      var _this3 = this;

      this.stop();

      this._timer = setInterval(function () {
        _this3._getIceConnectionStats().then(function (iceStats) {
          if (!iceStats) {
            return;
          }

          if (!_this3._lastActivity || _this3._lastActivity.bytesReceived !== iceStats.bytesReceived) {
            _this3._lastActivity = iceStats;
            // detected activity, cancel scheduled callback if any.
            _this3._scheduleInactivityCallback(null);
          }

          if (iceStats.timestamp - _this3._lastActivity.timestamp >= _this3._inactivityThresholdMs) {
            // detected inactivity.
            if (_this3._peerConnection.iceConnectionState === 'disconnected') {
              onIceConnectionInactive();
            } else if (_this3._onIceConnectionStateChanged === null) {
              _this3._scheduleInactivityCallback(onIceConnectionInactive);
            }
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
      this._scheduleInactivityCallback(null);
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