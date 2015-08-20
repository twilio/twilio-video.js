'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('lib/media');
var sinon = require('sinon');
var UserAgent = require('lib/signaling/useragent');

var Dialog = module.exports = function Dialog(name, token) {
  EventEmitter.call(this);

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
    peerConnection: {
      value: new EventEmitter()
    },
    refer: {
      value: createPromise()
    },
    remote: {
      value: name
    },
    remoteMedia: {
      value: remoteMedia
    },
    userAgent: {
      value: new UserAgent(token)
    }
  });
};

inherits(Dialog, EventEmitter);
