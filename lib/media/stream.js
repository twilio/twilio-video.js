'use strict';

var Q = require('q');
var util = require('../util');

/**
 * Construct a new {@link Stream} from a MediaStream.
 * @class
 * @classdesc {@link Stream} wraps a MediaStream object (either from
 *   <code>navigator.getUserMedia</code> or elsewhere), and provides it with a
 *   high-level API for mute/unmute, pause/unpause, and attaching to
 *   HTML &lt;video&gt; elements.
 *   <br><br>
 *   You should not call {@link Stream}'s construct directly; most methods,
 *   such as {@link Endpoint#createSession}, will construct a {@link Stream}
 *   when necessary.
 * @param {MediaStream} mediaStream - the MediaStream to wrap
 * @property {MediaStream} mediaStream - the wrapped MediaStream
 * @property {boolean} muted - whether or not the {@link Stream}'s audio is
 *   muted. Set this property to true or false to mute or unmute audio,
 *   respectively
 * @property {boolean} paused - whether or not the {@link Stream}'s video is
 *   paused. Set this property to true or false to pause or unpause video,
 *   respectively
 */
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
    'mediaStream': {
      value: mediaStream
    },
    'muted': {
      get: function() {
        if (local) {
          return muted;
        }
        return mediaStream.getAudioTracks().reduce(function(muted, audioTrack) {
          return muted || audioTrack.muted;
        }, false);
      },
      set: function(_muted) {
        if (local) {
          toggleAudioTracks(mediaStream, !_muted);
          muted = !!_muted;
        }
      }
    },
    'paused': {
      get: function() {
        if (local) {
          return paused;
        }
        return mediaStream.getVideoTracks().reduce(function(paused, videoTrack) {
          return paused || videoTrack.muted;
        }, false);
      },
      set: function(_paused) {
        if (local) {
          toggleVideoTracks(mediaStream, !_paused);
          paused = !!_paused;
        }
      }
    },
    'audioTracks': {
      get: function() {
        return mediaStream.getAudioTracks();
      }
    },
    'videoTracks': {
      get: function() {
        return mediaStream.getVideoTracks();
      }
    }
  });
  if (local) {
    toggleAudioTracks(mediaStream, !muted);
    toggleVideoTracks(mediaStream, !paused);
  }
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

/**
 * This function is very similar to <code>navigator.getUserMedia</code> except
 * that it does not use callbacks and returns a Promise for a {@link Stream}.
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}] - the
 *   MediaStreamConstraints object specifying what kind of LocalMediaStream to
 *   request from the browser (by default both audio and video)
 * @returns Promise<Stream>
 */
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

/**
 * This function invokes {@link Stream.getUserMedia} with the appropriate
 * MediaStreamConstraints for screen sharing.
 * <br><br>
 * In order for this to work and until screen sharing support is
 * fully-supported, you must have started Google Chrome with
 * the flags
 * <ul>
 *   <li><code>--enable-usermedia-screen-capturing</code></li>
 *   <li><code>--usermedia-screen-capturing</code></li>
 * </ul>
 * @returns Promise<Stream>
 */
Stream.getScreen = function getScreen(options) {
  return Stream.getUserMedia({
    'video': {
      'mandatory': {
        'chromeMediaSource': 'screen'
      }
    }
  });
};

/**
 * Attaches the {@link Stream} to an HTML &lt;video&gt; element.
 * If the &lt;video&gt; element is omitted, one will be created.
 * @instance
 * @param {HTMLVideoElement} [video=a new <video> element] - an existing
 *  &lt;video&gt; element
 * @param {number} [index=0] - the index of the video track to attach
 * @returns {HTMLVideoElement}
 */
Stream.prototype.attach = function attach(video, index) {
  if (!video && typeof document === 'undefined') {
    throw new Error('Cannot create <video> element');
  }
  video = video || document.createElement('video');
  if (!index) {
    return _attach(video, this.mediaStream, this._local);
  } else {
    var videoTracks = this.videoTracks;
    if (videoTracks.length >= index) {
      throw new Error('Video track index out of range');
    }
    if (typeof webkitMediaStream === 'undefined') {
      return _attach(video, this.mediaStream, this._local);
    }
    var mediaStream = new webkitMediaStream();
    this.audioTracks.forEach(function(track) {
      mediaStream.addTrack(track);
    });
    mediaStream.addTrack(this.videoTracks[index]);
    return _attach(video, mediaStream, this._local);
  }
  throw new Error('Cannot attach to <video> element');
};

function _attach(video, mediaStream, local) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      var vendorURL = window.URL || window.webkitURL;
      video.src = vendorURL.createObjectURL(mediaStream);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      video.mozSrcObject = mediaStream;
    }
    if (local) {
      video.muted = true;
    }
    video.play();
    return video;
  }
}

Stream.prototype.combine = function combine(stream) {
  var mediaStream;
  if (typeof webkitMediaStream !== 'undefined') {
    mediaStream = new webkitMediaStream();
  } else if (typeof mozMediaStream !== 'undefined') {
    mediaStream = new mozMediaStream();
  } else {
    throw new Error('Cannot create new Stream object');
  }
  [this, stream].forEach(function(stream) {
    ['getAudioTracks', 'getVideoTracks'].forEach(function(getTracks) {
      stream.mediaStream[getTracks]().forEach(function(track) {
        mediaStream.addTrack(track);
      });
    });
  });
  return new Stream(mediaStream);
};

/**
 * Stop the {@link Stream}.
 * @instance
 * @returns {Stream}
 */
Stream.prototype.stop = function stop() {
  this.mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    mediaStreamTrack.stop();
  });
  this.mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    mediaStreamTrack.stop();
  });
  try {
    this.mediaStream.stop();
  } catch (e) {
    // Do nothing.
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
