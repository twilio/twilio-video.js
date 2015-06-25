var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('lib/media');
var sinon = require('sinon');

var Dialog = module.exports = function Dialog(name) {
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
  remoteMedia.audioTracks.add({ });
  remoteMedia.videoTracks.add({ });

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
    }
  });
};

inherits(Dialog, EventEmitter);
