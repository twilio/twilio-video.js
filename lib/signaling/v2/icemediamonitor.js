/* eslint callback-return:0 */
'use strict';

const EventEmitter = require('events');
const { getStats } = require('@twilio/webrtc');


/**
 * @emits IceMediaMonitor#updated
 */
class IceMediaMonitor extends EventEmitter {
  /**
   * Construct a {@link IceMediaMonitor}.
   * @param {PeerConnectionV2} pc
   */
  constructor(pc) {
    super();
    Object.defineProperties(this, {
      _pc: {
        value: pc
      },
      _lastIceState: {
        value: null,
        writable: true
      }
    });
    pc.on('iceConnectionStateChanged', () => {
      // TODO, can pc emit iceConnectionState, along with this event?
      this._lastIceState = pc.iceConnectionState;
    });
  }


  // _restartIceIfInactiveForLong() {
  //   const kInactivityThresholdMs = 3000; // ms
  //   this._getMediaStats().then(mediaStats => {
  //     this._makarandlog('mediaStats: ', mediaStats);
  //     if (!this._lastActivity ||
  //         this._lastActivity.bytesReceived !== mediaStats.bytesReceived ||
  //         this._lastActivity.bytesSent !== mediaStats.bytesSent) {
  //       this._lastActivity = mediaStats;
  //     }
  //     if (mediaStats.timestamp - this._lastActivity.timestamp > kInactivityThresholdMs) {
  //       this.emit('oninactive');
  //     }
  //   }).catch((err) => {
  //     this._makarandlog('error in _restartIceIfInactiveForLong', err);
  //   });
  // }

  _makarandlog() {
    var newArgs = ['makarand: '];
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console.log, newArgs.concat(args));
  }
  /**
   * Start monitoring.
   * @returns {void}
   */
  start() {
    this._makarandlog('starting MediaTimer');
    const kActivityCheckPeriod = 10000; // ms
    this.stop();
    this._timer = setInterval(() => {
      const kInactivityThresholdMs = 3000; // ms
      this._pc.getMediaStats().then(mediaStats => {
        this._makarandlog('mediaStats: ', mediaStats);
        if (!mediaStats) {
          this._makarandlog('no mediastat found.');
          // TODO: what should we do when no media stats found?
          return;
        }
        if (!this._lastActivity ||
            this._lastActivity.bytesReceived !== mediaStats.bytesReceived ||
            this._lastActivity.bytesSent !== mediaStats.bytesSent) {
          this._lastActivity = mediaStats;
        }
        if (mediaStats.timestamp - this._lastActivity.timestamp > kInactivityThresholdMs) {
          this.emit('oninactive');
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
