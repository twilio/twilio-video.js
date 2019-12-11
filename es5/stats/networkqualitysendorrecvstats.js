'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NetworkQualityBandwidthStats = require('./networkqualitybandwidthstats');
var NetworkQualityFractionLostStats = require('./networkqualityfractionloststats');
var NetworkQualityLatencyStats = require('./networkqualitylatencystats');

/**
 * Network quality statistics shared between {@link NetworkQualitySendStats} and
 * {@link NetworkQualityRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code> or
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code> is calculated.
 * @property {?NetworkQualityBandwidthStats} bandwidth - bandwidth statistics
 * @property {?NetworkQualityLatencyStats} latency - latency statistics
 * @property {?NetworkQualityFractionLostStats} fractionLost - fraction lost statistics
 */

var NetworkQualitySendOrRecvStats =
/**
 * Construct a {@link NetworkQualitySendOrRecvStats}.
 * @param {SendOrRecvStats} sendOrRecvStats
 */
function NetworkQualitySendOrRecvStats(_ref) {
  var _ref$bandwidth = _ref.bandwidth,
      bandwidth = _ref$bandwidth === undefined ? null : _ref$bandwidth,
      _ref$fractionLost = _ref.fractionLost,
      fractionLost = _ref$fractionLost === undefined ? null : _ref$fractionLost,
      _ref$latency = _ref.latency,
      latency = _ref$latency === undefined ? null : _ref$latency;

  _classCallCheck(this, NetworkQualitySendOrRecvStats);

  Object.defineProperties(this, {
    bandwidth: {
      value: bandwidth ? new NetworkQualityBandwidthStats(bandwidth) : null,
      enumerable: true
    },
    fractionLost: {
      value: fractionLost ? new NetworkQualityFractionLostStats(fractionLost) : null,
      enumerable: true
    },
    latency: {
      value: latency ? new NetworkQualityLatencyStats(latency) : null,
      enumerable: true
    }
  });
};

module.exports = NetworkQualitySendOrRecvStats;