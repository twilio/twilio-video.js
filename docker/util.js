'use strict';

const NTSIceServerSource = require('../lib/iceserversource/nts');

/**
 * Get the regionalized RTCIceServers[].
 * @param {string} token
 * @param {string} region
 * @param {object} options
 * @returns {Promise<RTCIceServer[]>}
 */
async function getRegionalizedIceServers(token, region, options) {
  const iceServerSource = new NTSIceServerSource(token, options);
  const iceServers = await iceServerSource.start();
  iceServerSource.stop();
  iceServers.forEach(iceServer => {
    iceServer.urls = iceServer.urls.replace(/global/, region);
  });
  return iceServers;
}

exports.getRegionalizedIceServers = getRegionalizedIceServers;

exports.DOCKER_PROXY_VERSION = 1.00;
exports.DOCKER_PROXY_SERVER_PORT = 3032;
exports.DOCKER_PROXY_SERVER_URL = 'http://localhost:3032/';
exports.DOCKER_PROXY_TURN_REGIONS = ['au1', 'us1', 'us2'];
exports.DOCKER_PROXY_TURN_IP_RANGES = {
  au1: [
    '13.210.2.128-13.210.2.159',
    '54.252.254.64-54.252.254.127'
  ],
  us1: [
    '34.203.254.0-34.203.254.255',
    '54.172.60.0-54.172.61.255',
    '34.203.250.0-34.203.251.255'
  ],
  us2: [
    '34.216.110.128-34.216.110.159',
    '54.244.51.0-54.244.51.255'
  ]
};

