'use strict';

function getECSEndpoint(environment, realm) {
  return environment === 'prod'
    ? `https://ecs.${realm}.twilio.com`
    : `https://ecs.${environment}-${realm}.twilio.com`;
}

function getDefaultIceServers(environment) {
  return environment === 'prod'
    ? [{ urls: 'stun:global.stun.twilio.com:3478?transport=udp' }]
    : [{ urls: `stun:global.stun.${environment}.twilio.com:3478?transport=udp` }];
}

function getVsgHostName(environment, region) {
  region = region === 'gll' ? 'global' : encodeURIComponent(region);
  return environment === 'prod'
    ? `wss://${region}.vss.twilio.com`
    : `wss://${region}.vss.${environment}.twilio.com`;
}

function getInsightsEndpoint(/* environment, region */) {
  return 'wss://sdkgw.us1.twilio.com/v1/VideoEvents';
  // TODO: change to:
  // return `${getVsgHostName(environment, region)}/insights`;
}

function getSignalingEndpoint(environment, region) {
  return `${getVsgHostName(environment, region)}/signaling`;
}

exports.getDefaultIceServers = getDefaultIceServers;
exports.getECSEndpoint = getECSEndpoint;
exports.getInsightsEndpoint = getInsightsEndpoint;
exports.getSignalingEndpoint = getSignalingEndpoint;
