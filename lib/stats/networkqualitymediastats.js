'use strict';

const NetworkQualitySendStats = require('./networkqualitysendstats');
const NetworkQualityRecvStats = require('./networkqualityrecvstats');

/**
 * Network quality statistics for audio or video.
 * @property {number} send - send score of participant's audio or video
 * @property {number} recv - recv score of participant's audio or video
 * @property {?NetworkQualitySendOrRecvStats} sendStats - stats based on which the send score is calculated
 * @property {?NetworkQualitySendOrRecvStats} recvStats - stats based on which the recv score is calculated
 */
class NetworkQualityMediaStats {
  /**
   * Construct a {@link NetworkQualityMediaStats}.
   * @param {MediaLevels} mediaLevels
   */
  constructor({ send, recv, sendStats = null, recvStats = null }) {
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
  }
}

module.exports = NetworkQualityMediaStats;
