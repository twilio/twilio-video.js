/* eslint callback-return:0 */
'use strict';

const { getStats } = require('@twilio/webrtc');


/**
 * @emits IceMediaMonitor#updated
 */
class IceMediaMonitor {
  /**
   * Construct a {@link IceMediaMonitor}.
   * @param {PeerConnectionV2} pc
   */
  constructor(pc) {
    Object.defineProperties(this, {
      _pc: {
        value: pc
      }
    });
  }

  // TODO: remove this before merging.
  _makarandlog() {
    var newArgs = ['makarand: '];
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console.log, newArgs.concat(args));
  }

  _getMediaStats() {
    return this._pc.getMediaStats();
  }
  /**
   * Start monitoring.
   * @returns {void}
   */
  start(onIncativeCallback) {
    this._makarandlog('starting MediaTimer');
    const kActivityCheckPeriod = 1000; // ms
    this.stop();
    this._timer = setInterval(() => {
      const kInactivityThresholdMs = 3000; // ms
      this._getMediaStats().then(mediaStats => {
        if (!mediaStats) {
          return;
        }

        if (this._lastActivity ) {
          this._makarandlog('Diff: ', {
            time: mediaStats.timestamp - this._lastActivity.timestamp,
            received: mediaStats.bytesReceived - this._lastActivity.bytesReceived,
            sent: mediaStats.bytesSent - this._lastActivity.bytesSent
          });
        }

        // if there has been any change in bytesReceived since last time mark it as lastActiveiy.
        if (!this._lastActivity || this._lastActivity.bytesReceived !== mediaStats.bytesReceived) {
          this._lastActivity = mediaStats;
        }

        // if its been too long since lastActivity, fire inactiveCallback.
        if (mediaStats.timestamp - this._lastActivity.timestamp > kInactivityThresholdMs) {
          onIncativeCallback();
        }
      }).catch((err) => {
        this._makarandlog('error in _restartIceIfInactiveForLong', err);
      });
    }, kActivityCheckPeriod);
  }

  /**
   * Stop monitoring.
   * @returns {void}
   */
  stop() {
    if (this._timer !== null) {
      this._makarandlog('stopping MediaTimer');
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = IceMediaMonitor;
