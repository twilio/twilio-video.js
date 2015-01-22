'use strict';

var Q = require('q');
var util = require('../util');

function Stream(mediaStream, options) {
  if (!(this instanceof Stream)) {
    return new Stream(mediaStream, options);
  }
  options = util.withDefaults(options, {
    'local': null,
    'muted': false,
    'paused': false
  });
  var local = options['local'];
  var muted = options['muted'];
  var paused = options['paused'];
  Object.defineProperties(this, {
    _local: {
      value: local
    },
    _muted: {
      set: function(_muted) {
        muted = _muted;
      }
    },
    _paused: {
      set: function(_paused) {
        paused = _paused;
      }
    },
    'mediaStream': {
      value: mediaStream
    },
    'muted': {
      get: function() {
        return muted;
      }
    },
    'paused': {
      get: function() {
        return paused;
      }
    }
  });
  return Object.freeze(this);
}

function _getUserMedia(constraints, onSuccess, onFailure) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      navigator.webkitGetUserMedia(constraints, onSuccess, onFailure);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      navigator.mozGetUserMedia(constraints, onSuccess, onFailure);
    }
    return;
  }
  onFailure(new Error('getUserMedia is not supported'));
}

Stream.getUserMedia = function getUserMedia(constraints, options) {
  var deferred = Q.defer();
  constraints = constraints || { 'audio': true, 'video': true };
  options = util.withDefaults(options, {
    'local': true
  });
  _getUserMedia(constraints, onSuccess, onFailure);
  function onSuccess(mediaStream) {
    deferred.resolve(new Stream(mediaStream, options));
  }
  function onFailure(error) {
    deferred.reject(error);
  }
  return deferred.promise;
};

Stream.prototype.attach = function attach(video) {
  if (!video && typeof document === 'undefined') {
    throw new Error('Cannot create <video> element');
  }
  video = video || document.createElement('video');
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      var vendorURL = window.URL || window.webkitURL;
      video.src = vendorURL.createObjectURL(this.mediaStream);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      video.mozSrcObject = this.mediaStream;
    }
    if (this._local) {
      video.muted = true;
    }
    video.play();
    return video;
  }
  throw new Error('Cannot attach to <video> element');
};

Stream.prototype.pauseVideo = function pauseVideo(pause) {
  if (pause && !this.paused) {
    toggleVideoTracks(this.mediaStream, !pause);
    this._paused = true;
  } else if (!pause && this.paused) {
    toggleVideoTracks(this.mediaStream, !pause);
    this._paused = false;
  }
  return this;
};

Stream.prototype.muteAudio = function muteAudio(mute) {
  if (mute && !this.muted) {
    toggleAudioTracks(this.mediaStream, !mute);
    this._muted = true;
  } else if (!mute && this.muted) {
    toggleAudioTracks(this.mediaStream, !mute);
    this._muted = false;
  }
  return this;
};

function toggleVideoTracks(mediaStream, enabled) {
  mediaStream.getVideoTracks().forEach(function(videoTrack) {
    videoTrack.enabled = enabled;
  });
}

function toggleAudioTracks(mediaStream, enabled) {
  mediaStream.getAudioTracks().forEach(function(audioTrack) {
    audioTrack.enabled = enabled;
  });
}

module.exports = Stream;
