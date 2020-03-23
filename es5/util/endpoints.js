'use strict';

var USE_NEW_INSIGHTS_ENDPOINTS = true;

function getVsgHostName(environment, region) {
  var isGlobal = region === 'gll' || region === 'roaming';
  region = isGlobal ? 'global' : encodeURIComponent(region);
  return environment === 'prod' ? 'wss://' + region + '.vss.twilio.com' : 'wss://' + region + '.vss.' + environment + '.twilio.com';
}

function getInsightsEndpoint(environment, region) {
  return USE_NEW_INSIGHTS_ENDPOINTS ? getVsgHostName(environment, region) + '/insights' : 'wss://sdkgw.' + environment + '-us1.twilio.com';
}

function getSignalingEndpoint(environment, region) {
  return getVsgHostName(environment, region) + '/signaling';
}

exports.getInsightsEndpoint = getInsightsEndpoint;
exports.getSignalingEndpoint = getSignalingEndpoint;