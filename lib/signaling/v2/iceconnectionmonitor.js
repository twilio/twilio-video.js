'use strict';

const { ICE_ACTIVITY_CHECK_PERIOD_MS, ICE_INACTIVITY_THRESHOLD_MS } = require('../../util/constants');

/**
 * Monitors a {@link RTCPeerConnection}'s stats and notifies
 * caller when inactivity is detected.
 */
class IceConnectionMonitor {
  /**
   * Construct an {@link IceConnectionMonitor}.
   * @param {RTCPeerConnection} peerConnection
   * @param {object} [options]
   */
  constructor(peerConnection, options) {
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

  _getActivePairStat(stats) {
    const statsArray = Array.from(stats.values());
    const activePairStats = statsArray.find(stat => stat.type === 'candidate-pair' && stat.nominated);
    // NOTE(mpatwardhan): sometimes (JSDK-2667) after getting disconnected while switching network
    // we may not find active pair. Treat this as 0 bytesReceived so that we count it towards inactivity.
    return activePairStats || {
      bytesReceived: 0,
      timestamp: Math.round((new Date()).getTime())
    };
  }

  /**
   * Get ICE connection stats, and extract received and send bytes.
   * @returns Promise<?RTCIceCandidatePairStats>
   */
  _getIceConnectionStats() {
    return this._peerConnection.getStats().then(stats => this._getActivePairStat(stats)).catch(() => {
      return null;
    });
  }

  /**
   * schedules/un-schedules inactivity callback.
   */
  _scheduleInactivityCallback(callback) {
    if (callback && this._onIceConnectionStateChanged === null) {
      // schedule callback
      this._onIceConnectionStateChanged = () => {
        if (this._peerConnection.iceConnectionState === 'disconnected') {
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
  start(onIceConnectionInactive) {
    this.stop();

    this._timer = setInterval(() => {
      this._getIceConnectionStats().then(iceStats => {
        if (!iceStats) {
          return;
        }

        // NOTE(mpatwardhan): We look at bytesReceived on active candidate pair as an indication of active ice connection.
        // As per spec (https://w3c.github.io/webrtc-stats/#dom-rtcicecandidatepairstats-bytesreceived) this value
        // includes RTCP traffic and is +ve even when there are no tracks subscribed to.
        if (!this._lastActivity || this._lastActivity.bytesReceived !== iceStats.bytesReceived) {
          this._lastActivity = iceStats;
          // detected activity, cancel scheduled callback if any.
          this._scheduleInactivityCallback(null);
        }

        if (iceStats.timestamp - this._lastActivity.timestamp >= this._inactivityThresholdMs) {
          // detected inactivity.
          if (this._peerConnection.iceConnectionState === 'disconnected') {
            onIceConnectionInactive();
          } else if (this._onIceConnectionStateChanged === null) {
            this._scheduleInactivityCallback(onIceConnectionInactive);
          }
        }
      });
    }, this._activityCheckPeriodMs);
  }

  /**
   * Stop monitoring the ICE connection state.
   * @returns {void}
   */
  stop() {
    this._scheduleInactivityCallback(null);
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
      this._lastActivity = null;
    }
  }
}

module.exports = IceConnectionMonitor;
