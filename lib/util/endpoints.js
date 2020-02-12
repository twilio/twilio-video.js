'use strict';

module.exports.getSignalingEndpoint = (environment, region) => {
  region = region === 'gll' ? 'global' : encodeURIComponent(region);
  return environment === 'prod'
    ? `wss://${region}.vss.twilio.com/signaling`
    : `wss://${region}.vss.${environment}.twilio.com/signaling`;
};

module.exports.getECSEndpoint = (environment, realm) => {
  return environment === 'prod'
    ? `https://ecs.${realm}.twilio.com`
    : `https://ecs.${environment}-${realm}.twilio.com`;
};

module.exports.getDefaultIceServers = environment => {
  return environment === 'prod'
    ? [{ urls: 'stun:global.stun.twilio.com:3478?transport=udp' }]
    : [{ urls: `stun:global.stun.${environment}.twilio.com:3478?transport=udp` }];
};

module.exports.getInsightsEndpoint = (environment, region) => {
  return environment === 'prod'
    ? `wss://${region}.vss.twilio.com/insights`
    : `wss://${region}.vss.${environment}.twilio.com/insights`;
};

