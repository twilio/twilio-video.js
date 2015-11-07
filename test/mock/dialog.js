'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('lib/media');
var QueueingEventEmitter = require('lib/queueingeventemitter');
var sinon = require('sinon');
var UserAgent = require('lib/signaling/useragent');
var util = require('lib/util');

var Dialog = module.exports = function Dialog(name, accessManager) {
  QueueingEventEmitter.call(this);

  var createPromise = function() {
    var spy = new sinon.spy(function() {
      return new Promise(function(resolve, reject) {
        if (spy.rejectNext) { reject(); }
        else { resolve(); }
      });
    });

    return spy;
  };

  var remoteMedia = new Media();
  remoteMedia.audioTracks.set('audio', { });
  remoteMedia.videoTracks.set('video', { });

  Object.defineProperties(this, {
    end: {
      value: createPromise()
    },
    getStats: {
      value: createPromise()
    },
    participantSid: {
      value: util.makeUUID()
    },
    peerConnection: {
      value: new EventEmitter()
    },
    refer: {
      value: createPromise()
    },
    remote: {
      value: 'sip:' + name
    },
    remoteMedia: {
      value: remoteMedia
    },
    userAgent: {
      value: new UserAgent(accessManager)
    }
  });
};

inherits(Dialog, QueueingEventEmitter);
