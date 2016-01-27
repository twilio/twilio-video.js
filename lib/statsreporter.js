'use strict';

var C = require('./util/constants');
var Log = require('./util/log');
var request = require('./util/request');
var util = require('./util');
var version = require('lib/../../package.json').version;

var browserSpecs = { name: 'Unknown', version: '0.0' };
var userAgent = 'Unknown';

/* istanbul ignore next: Browser-specific logic */
if (typeof navigator !== 'undefined' && navigator.userAgent) {
  userAgent = navigator.userAgent;
  browserSpecs = util.parseUserAgent(navigator.userAgent);
} else if (typeof process !== 'undefined') {
  browserSpecs = { name: 'Node', version: process.versions.node };
}

function StatsReporter(eventGateway, dialog, options) {
  if (!(this instanceof StatsReporter)) {
    return new StatsReporter(eventGateway, dialog, options);
  }

  function defaultPost(requestParams) {
    return request.post(requestParams);
  }

  options = util.extend({
    logLevel: C.DEFAULT_LOG_LEVEL,
    post: defaultPost
  }, options);

  var log = new Log('StatsReporter', options.logLevel);
  var self = this;
  var shouldPublish = false;
  var accessManager = dialog.userAgent.accessManager;
  var queuedSamples = [];

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _log: {
      value: log
    },
    _samples: {
      value: queuedSamples
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    dialog: {
      enumerable: true,
      value: dialog
    },
    eventGateway: {
      enumerable: true,
      value: eventGateway
    }
  });

  function publish() {
    if (shouldPublish && queuedSamples.length) {
      var samples = queuedSamples.splice(0, queuedSamples.length);
      publishSamples(options.post, self, samples);
    }
  }

  dialog.on('stats', function(sample) {
    queuedSamples.push(sample);
    if (queuedSamples.length >= 10) { publish(); }
  });

  dialog.once('ended', publish);

  publishInitialStats(options.post, this).then(function() {
    shouldPublish = true;
    if (queuedSamples.length >= 10 || dialog.ended) {
      publish();
    }
  });
}

function publishSamples(post, reporter, samples) {
  var url = 'https://' + reporter.eventGateway + '/v1/Calls/' + reporter.dialog.callSid + '/Statistics';
  var stats = {
    callsid: reporter.dialog.callSid,
    samples: samples
  };

  var log = reporter._log;
  return publishStats(post, url, reporter.accessManager.token, stats).then(
      log.debug.bind(log, 'Post to gateway succeeded'),
      log.debug.bind(log, 'Post to gateway failed'));
}

function publishInitialStats(post, reporter) {
  var url = 'https://' + reporter.eventGateway + '/v1/Calls';
  /* eslint camelcase:0 */
  var stats = {
    callsid: reporter.dialog.callSid,
    sip: {
      invite_to_180: reporter.dialog.inviteTo180
    },
    platform: {
      name: browserSpecs.name,
      version: browserSpecs.version,
      media_engine: 'WebRTC',
      sdk: version,
      user_agent: userAgent
    }
  };

  var log = reporter._log;
  return publishStats(post, url, reporter.accessManager.token, stats).then(
    log.debug.bind(log, 'Initial post to gateway succeeded'),
    log.debug.bind(log, 'Initial post to gateway failed'));
}

function publishStats(post, url, token, stats) {
  var requestParams = {
    url: url,
    body: stats,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': token
    }
  };

  return post(requestParams);
}

module.exports = StatsReporter;
