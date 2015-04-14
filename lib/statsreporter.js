'use strict';

var constants = require('./util/constants');

function StatsReporter(eventGateway, dialog) {
  if (!(this instanceof StatsReporter)) {
    return new StatsReporter(eventGateway, dialog);
  }
  var self = this;
  var initialStatsPublished = null;
  var queuedStatistics = [];
  var token = dialog.userAgent.token;

  var initialStats = {
    'callsid': dialog.sid,
    'sip': {
      'invite_to_180': dialog.inviteTo180
    },
    'platform': {
      // FIXME(mroberts): ...
      'name': 'Chrome',
      'version': '0.0.0',
      'media_engine': 'WebRTC',
      'sdk': constants.SDK_VERSION
    }
  };

  Object.defineProperties(this, {
    '_initialStatsPublished': {
      get: function() {
        return initialStatsPublished;
      },
      set: function(_initialStatsPublished) {
        initialStatsPublished = _initialStatsPublished;
      }
    },
    '_queuedStatistics': {
      get: function() {
        return queuedStatistics;
      },
      set: function(_queuedStatistics) {
        queuedStatistics = _queuedStatistics;
      }
    },
    'dialog': {
      enumerable: true,
      value: dialog
    },
    'initialStats': {
      enumerable: true,
      value: initialStats
    },
    'token': {
      enumerable: true,
      value: token
    }
  });
  dialog.on('stats', function(stats) {
    if (self._initialStatsPublished === null) {
      self._queuedStatistics.push(stats);
    } else if (self._initialStatsPublished === true) {
      publishStats(eventGateway, token, stats);
    }
  });
  publishInitialStats(eventGateway, token, initialStats, function(error) {
    if (error) {
      self._initialStatsPublished = false;
      self._queuedStatistics = null;
      return;
    }
    self._initialStatsPublished = true;
    self._queuedStatistics.forEach(function(stats) {
      publishStats(eventGateway, token, stats);
    });
    self._queuedStatistics = null;
  });
}

function publishInitialStats(eventGateway, token, stats, next) {
  next(new Error('Publishing stats is disabled'));
  /*
  if (typeof XMLHttpRequest === 'undefined') {
    return;
  }
  var callSid = stats['callsid'];
  var xhr = new XMLHttpRequest();
  xhr.open('POST',
    'https://' + eventGateway + '/v1/Calls', true);
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 200:
          console.log('Successfully posted initial stats to event gateway');
          next();
          break;
        default:
          console.error('Failed to post initial stats to event gateway');
          next(new Error('Failed to post initial stats to event gateway'));
      }
    }
  };
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-Twilio-Token', token.capabilityTokenString);
  // xhr.withCredentials = true;
  xhr.send(JSON.stringify(stats));
  */
}

function publishStats(eventGateway, token, stats) {
  if (typeof XMLHttpRequest === 'undefined') {
    return;
  }
  var callSid = stats['callsid'];
  var xhr = new XMLHttpRequest();
  xhr.open('POST',
    'https://' + eventGateway + '/v1/Calls/' + callSid + '/Statistics', true);
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 200:
          console.log('Successfully posted stats to event gateway');
          break;
        default:
          console.error('Failed to post stats to event gateway');
      }
    }
  };
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-Twilio-Token', token.capabilityTokenString);
  // xhr.withCredentials = true;
  xhr.send(JSON.stringify(stats));
}

module.exports = StatsReporter;
