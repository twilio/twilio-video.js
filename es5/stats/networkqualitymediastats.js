'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkQualitySendStats = require('./networkqualitysendstats');
var NetworkQualityRecvStats = require('./networkqualityrecvstats');

/**
 * Network quality statistics shared between a {@link Participant}'s audio or video.
 * @property {NetworkQualityLevel} send - {@link NetworkQualityLevel} of the
 *  {@link Participant}'s published audio or video
 * @property {number} recv - {@link NetworkQualityLevel} of the
 *  {@link Participant}'s subscribed audio or video
 * @property {?NetworkQualitySendOrRecvStats} sendStats - {@link NetworkQualitySendOrRecvStats}
 *   based on which {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code>
 *   is calculated
 * @property {?NetworkQualitySendOrRecvStats} recvStats - {@link NetworkQualitySendOrRecvStats}
 *   based on which {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code>
 *   is calculated
 */

var NetworkQualityMediaStats =
/**
 * Construct a {@link NetworkQualityMediaStats}.
 * @param {MediaLevels} mediaLevels
 */
function NetworkQualityMediaStats(_ref) {
  var send = _ref.send,
      recv = _ref.recv,
      _ref$sendStats = _ref.sendStats,
      sendStats = _ref$sendStats === undefined ? null : _ref$sendStats,
      _ref$recvStats = _ref.recvStats,
      recvStats = _ref$recvStats === undefined ? null : _ref$recvStats;

  _classCallCheck(this, NetworkQualityMediaStats);

  Object.defineProperties(this, {
    send: {
      value: send,
      enumerable: true
    },
    recv: {
      value: recv,
      enumerable: true
    },
    sendStats: {
      value: sendStats ? new NetworkQualitySendStats(sendStats) : null,
      enumerable: true
    },
    recvStats: {
      value: recvStats ? new NetworkQualityRecvStats(recvStats) : null,
      enumerable: true
    }
  });
};

module.exports = NetworkQualityMediaStats;