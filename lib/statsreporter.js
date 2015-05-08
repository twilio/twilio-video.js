'use strict';

var util = require('./util');
var version = require('../package.json').version;
var request = require('./util/request');
var Log = require('./util/log');

var browserSpecs = { name: 'Unknown', version: '0.0' };
if (typeof navigator !== 'undefined') {
  browserSpecs = util.parseUserAgent(navigator.userAgent);
} else if (typeof process !== 'undefined') {
  browserSpecs = { name: 'Node', version: process.version.node };
}

function StatsReporter(eventGateway, dialog, logLevel) {
  if (!(this instanceof StatsReporter)) {
    return new StatsReporter(eventGateway, dialog, logLevel);
  }

  var self = this;
  var shouldPublish = false;
  var queuedSamples = [];
  var token = dialog.userAgent.token;
  var log = new Log('StatsReporter', logLevel || 'warn');

  Object.defineProperties(this, {
    '_log': {
      value: log
    },
    'dialog': {
      enumerable: true,
      value: dialog
    },
    'eventGateway': {
      enumerable: true,
      value: eventGateway
    },
    'token': {
      enumerable: true,
      value: token
    }
  });

  dialog.on('stats', function(sample) {
    if (shouldPublish && queuedSamples.length >= 10) {
      var samples = queuedSamples.splice(0, queuedSamples.length);
      publishSamples(self, samples);
    } else {
      queuedSamples.push(sample);
    }
  });

  dialog.once('ended', function() {
    if(shouldPublish) {
      var samples = queuedSamples.splice(0, queuedSamples.length);
      publishSamples(self, samples);
    }
  });

  publishInitialStats(this).then(function() {
    shouldPublish = true;
  });
}

function publishSamples(reporter, samples) {
  var url = 'https://' + reporter.eventGateway + '/v1/Calls/' + reporter.dialog.callSid + '/Statistics';
  var stats = {
    'callsid': reporter.dialog.callSid,
    'samples': samples
  };

  var log = reporter._log;
  return publishStats(url, reporter.token.capabilityTokenString, stats).then(
      log.debug.bind(log, 'Post to gateway succeeded'),
      log.debug.bind(log, 'Post to gateway failed'));
}

function publishInitialStats(reporter) {
  var url = 'https://' + reporter.eventGateway + '/v1/Calls';
  var stats = {
    'callsid': reporter.dialog.callSid,
    'sip': { 'invite_to_180': reporter.dialog.inviteTo180 },
    'platform': {
      'name': browserSpecs.name,
      'version': browserSpecs.version,
      'media_engine': 'WebRTC',
      'sdk': version
    }
  };

  var log = reporter._log;
  return publishStats(url, reporter.token.capabilityTokenString, stats).then(
      log.debug.bind(log, 'Initial post to gateway succeeded'),
      log.debug.bind(log, 'Initial post to gateway failed'));
}

function publishStats(url, token, stats) {
  var requestParams = {
    url: url,
    body: stats,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': token
    }
  };

  return request.post(requestParams);
}

module.exports = StatsReporter;
