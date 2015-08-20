'use strict';

var EventEmitter = require('events').EventEmitter;
var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var Q = require('q');

var Track = require('./track');
var AudioTrack = Track.AudioTrack;
var VideoTrack = Track.VideoTrack;

/**
 * Construct a {@link Media} object.
 * @class
 * @classdesc A {@link Media} object contains a number of {@link AudioTrack}s
 *   and {@link VideoTrack}s. You can call {@link Media#attach} with a
 *   &lt;div&gt; to automatically update your application's user interface with
 *   &lt;audio&gt; and &lt;video&gt; elements as {@link Track}s are added and
 *   removed.
 * @property {Map<HTMLElement, Map<Track, HTMLElement>>} attachments - A Map
 *   from &lt;div&gt; elements to a Map from {@link Track}s to their attached
 *   HTMLElements (managed by {@link Media#attach} and {@link Media#detach})
 * @property {Set<AudioTrack>} audioTracks - The Set of {@link AudioTrack}s on
 *   this {@link Media} object
 * @property {Set<MediaStream>} mediaStreams - The MediaStreams associated with
 *   the {@link Track}s on this {@link Media} object
 * @property {Boolean} muted - Gets or sets the muted property of all AudioStreams.
 *   If multiple audio streams exist, will return false unless all streams are muted.
 * @property {Boolean} paused - Gets or sets the paused property of all VideoStreams.
 *   If multiple video streams exist, will return false unless all streams are paused.
 * @property {Set<VideoTrack>} videoTracks - The Set of {@link VideoTrack}s on
 *   this {@link Media} object
 * @fires trackAdded
 * @fires trackRemoved
 */
function Media(peerConnection) {
  EventEmitter.call(this);

  var attachments = new Map();
  var audioTracks = new Set();
  var mediaStreams = new Set();
  var videoTracks = new Set();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    'attachments': {
      enumerable: true,
      value: attachments
    },
    'audioTracks': {
      enumerable: true,
      value: audioTracks
    },
    'mediaStreams': {
      enumerable: true,
      value: mediaStreams
    },
    'muted': {
      enumerable: true,
      get: function() {
        var muted = true;
        audioTracks.forEach(function(track) {
          muted = muted && track.muted;
        });
        return muted;
      },
      set: function(_muted) {
        audioTracks.forEach(function(track) { track.muted = _muted; });
      }
    },
    'paused': {
      enumerable: true,
      get: function() {
        var paused = true;
        videoTracks.forEach(function(track) {
          paused = paused && track.paused;
        });
        return paused;
      },
      set: function(_paused) {
        videoTracks.forEach(function(track) { track.paused = _paused; });
      }
    },
    'videoTracks': {
      enumerable: true,
      value: videoTracks
    }
  });
  return this;
}

var TRACK_MUTED = Media.TRACK_MUTED = 'trackMuted';
var TRACK_UNMUTED = Media.TRACK_UNMUTED = 'trackUnmuted';
var TRACK_PAUSED = Media.TRACK_PAUSED = 'trackPaused';
var TRACK_UNPAUSED = Media.TRACK_UNPAUSED = 'trackUnpaused';
var TRACK_EVENTS = Media.TRACK_EVENTS = [
  TRACK_MUTED,
  TRACK_UNMUTED,
  TRACK_PAUSED,
  TRACK_UNPAUSED
];

inherits(Media, EventEmitter);

Media.prototype._addStream = addStream;

Media.prototype._addTrack = function _addTrack(track) {
  var self = this;
  this.mediaStreams.add(track.mediaStream);

  // NOTE(mroberts): When a Track emits mute or pause events, we want to
  // re-emit them at the Media-level.

  var trackSet;
  var muteEventPairs = [
    [AudioTrack.MUTED, TRACK_MUTED],
    [AudioTrack.UNMUTED, TRACK_UNMUTED]
  ];
  var pauseEventPairs = [
    [VideoTrack.PAUSED, TRACK_PAUSED],
    [VideoTrack.UNPAUSED, TRACK_UNPAUSED]
  ];
  var eventPairs;

  if (track.kind === 'audio') {
    trackSet = this.audioTracks;
    eventPairs = muteEventPairs;
  } else {
    trackSet = this.videoTracks;
    eventPairs = pauseEventPairs;
  }

  trackSet.add(track);

  eventPairs.forEach(function(pair) {
    var trackEvent = pair[0];
    var mediaEvent = pair[1];
    track.on(trackEvent, function() {
      // FIXME(mroberts): Lazily remove the event handler, but what happens
      // if we add the Track twice? We only want to emit the event once.
      if (!trackSet.has(track)) {
        return track.removeListener(trackEvent, this);
      }
      self.emit(mediaEvent, track);
    });
  });

  track.once('ended', function ended(event) {
    self._removeTrack(track);
  });

  this.emit('trackAdded', track);

  return this;
};

Media.prototype._attachTrack = function _attachTrack(el, attachments, track) {
  var self = this;
  var trackEl = track.attach();
  // NOTE(mroberts): We want to mute local audio, otherwise we get feedback.
  if (this instanceof LocalMedia && track instanceof AudioTrack) {
    trackEl.muted = true;
  }
  el.appendChild(trackEl);
  attachments.set(track, trackEl);
  track.once('ended', function() {
    self._detachTrack(el, attachments, track);
  });
  return this;
};

Media.prototype._detachTrack = function _detachTrack(el, attachments, track) {
  var trackEl = attachments.get(track);
  if (!trackEl) {
    return this;
  }
  track.detach(trackEl);
  el.removeChild(trackEl);
  attachments.delete(track);
  return this;
};

Media.prototype._removeTrack = function _removeTrack(track) {
  this.mediaStreams.delete(track.mediaStream);
  (track.kind === 'audio' ? this.audioTracks : this.videoTracks).delete(track);
  this.emit('trackRemoved', track);
  return this;
};

/**
 * Attach {@link Media} to a newly created &lt;div&gt; element.
 * @instance
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = media.attach();
 * document.getElementById('div#remote-media-container').appendChild(remoteMediaEl);
*//**
 * Attach {@link Media} to an existing HTMLElement.
 * @instance
 * @param {HTMLElement} el - The HTMLElement to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = document.getElementById('remote-media');
 * media.attach(remoteMediaEl);
*//**
 * Attach {@link Media} to an HTMLElement selected by
 * <code>document.querySelector</code>.
 * @instance
 * @param {string} selector - A query selector for the HTMLElement to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = media.attach('div#remote-media');
 */
Media.prototype.attach = function attach(el) {
  if (!el) {
    return createDivAndAttach(this);
  } else if (typeof el === 'string') {
    return selectElementAndAttach(this, el);
  } else {
    return attachToElement(this, el);
  }
};

function attachToElement(media, el) {
  if (media.attachments.has(el)) {
    return el;
  }
  var attachments = new Map();
  // Attach existing audio and video tracks to the element,
  [media.audioTracks, media.videoTracks].forEach(function(tracks) {
    tracks.forEach(function(track) {
      media._attachTrack(el, attachments, track);
    }, media);
  }, media);
  // And update the element as tracks are added,
  media.on('trackAdded', function trackAdded(track) {
    // But stop updating the element if we've been detached.
    if (!media.attachments.has(el)) {
      return media.removeListener('trackAdded', trackAdded);
    }
    media._attachTrack(el, attachments, track);
  });
  media.attachments.set(el, attachments);
  return el;
}

function selectElementAndAttach(media, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return media.attach(el);
}

function createDivAndAttach(media) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  return media.attach(document.createElement('div'));
}

/**
 * Detach {@link Media} from any and all previously attached HTMLElements.
 * @instance
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedMediaEls = media.detach();
*//**
 * Detach {@link Media} from a previously attached HTMLElement.
 * @instance
 * @param {HTMLElement} el - The HTMLElement to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = document.getElementById('remote-media');
 * media.detach(remoteMediaEl);
*//**
 * Detach {@link Media} from a previously attached HTMLElement selected by
 * <code>document.querySelector</code>.
 * @instance
 * @param {string} selector - A query selector for the HTMLElement to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedMediaEl = media.detach('div#remote-media');
 */
Media.prototype.detach = function detach(el) {
  if (!el) {
    return detachFromAllElements(this);
  } else if (typeof el === 'string') {
    return selectElementAndDetach(this, el);
  } else {
    return detachFromElement(this, el);
  }
};

function detachFromElement(media, el) {
  if (!media.attachments.has(el)) {
    return el;
  }
  var attachments = media.attachments.get(el);
  media.attachments.delete(el);
  attachments.forEach(function(trackEl, track) {
    media._detachTrack(el, attachments, track);
  });
  return el;
}

function selectElementAndDetach(media, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return detachFromElement(media, el);
}

function detachFromAllElements(media) {
  var els = [];
  media.attachments.forEach(function(attachments, el) {
    els.push(el);
    detachFromElement(media, el);
  });
  return els;
}

/**
 * Construct a {@link Twilio.LocalMedia} object.
 * @memberof Twilio
 * @class
 * @classdesc A {@link Twilio.LocalMedia} object is a {@link Media} object representing
 *   {@link AudioTrack}s and {@link VideoTrack}s that your {@link Endpoint} may
 *   share in a {@link Conversation}.
 * @augments Media
 */
function LocalMedia() {
  if (!(this instanceof LocalMedia)) {
    return new LocalMedia();
  }
  Media.call(this);
  var nextUserMedia = null;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _needs: {
      value: new Set()
    },
    _nextUserMedia: {
      get: function() {
        return nextUserMedia;
      },
      set: function(_nextUserMedia) {
        nextUserMedia = _nextUserMedia;
      }
    }
  });
  return Object.freeze(this);
}


LocalMedia.TRACK_MUTED = Media.TRACK_MUTED;
LocalMedia.TRACK_UNMUTED = Media.TRACK_UNMUTED;
LocalMedia.TRACK_PAUSED = Media.TRACK_PAUSED;
LocalMedia.TRACK_UNPAUSED = Media.TRACK_UNPAUSED;
LocalMedia.TRACK_EVENTS = Media.TRACK_EVENTS;

LocalMedia.getLocalMedia = function getLocalMedia(options) {
  options = options || {};
  if (options['localMedia']) {
    return new Q(options['localMedia']);
  }
  var localMedia = new LocalMedia();
  if (options['localStream']) {
    localMedia.addStream(options['localStream']);
    return new Q(localMedia.addStream(options['localStream']));
  }
  return getUserMedia(options['localStreamConstraints'])
    .then(function(mediaStream) {
      return localMedia.addStream(mediaStream);
    });
};

inherits(LocalMedia, Media);

/**
 * Adds an {@link AudioTrack} representing your browser's microphone to the
 * {@link Twilio.LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ audio: true })</code>.
 * @instance
 * @returns {Promise<AudioTrack>}
 */
LocalMedia.prototype.addMicrophone = function addMicrophone() {
  var self = this;
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || (audioTrack.label === 'microphone' && audioTrack);
  });
  if (microphone) {
    return new Q(microphone);
  }
  return getUserMedia({ 'audio': true, 'video': false })
    .then(function gotMicrophone(mediaStream) {
      var audioTracks = mediaStream.getAudioTracks();
      var mediaStreamTrack = audioTracks[0];
      var audioTrack = new AudioTrack(mediaStream, mediaStreamTrack);
      self._addTrack(audioTrack);
      return audioTrack;
    });
};

/**
 * Removes the {@link AudioTrack} representing your browser's microphone, if it
 * has been added.
 * @instance
 * @returns {?AudioTrack}
 */
LocalMedia.prototype.removeMicrophone = function removeMicrophone() {
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || (audioTrack.label === 'microphone' && audioTrack);
  });
  if (microphone) {
    return this._removeTrack(microphone);
  }
  return null;
};

/**
 * Adds a {@link VideoTrack} representing your browser's camera to the
 * {@link Twilio.LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ video: true })</code>.
 * @instance
 * @returns {Promise<VideoTrack>}
 */
LocalMedia.prototype.addCamera = function addCamera() {
  var self = this;
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || (videoTrack.label === 'camera' && videoTrack);
  });
  if (camera) {
    return new Q(camera);
  }
  return getUserMedia({ 'audio': false, 'video': true })
    .then(function gotCamera(mediaStream) {
      var videoTracks = mediaStream.getVideoTracks();
      var mediaStreamTrack = videoTracks[0];
      var videoTrack = new VideoTrack(mediaStream, mediaStreamTrack);
      self._addTrack(videoTrack);
      return videoTrack;
    });
};

/**
 * Removes the {@link VideoTrack} representing your browser's camera, if it
 * has been added.
 * @instance
 * @returns {?VideoTrack}
 */
LocalMedia.prototype.removeCamera = function removeCamera() {
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || (videoTrack.label === 'camera' && videoTrack);
  });
  if (camera) {
    return this._removeTrack(camera);
  }
  return null;
};

LocalMedia.prototype.addStream = addStream;

function addStream(mediaStream) {
  /* jshint validthis:true */
  this.mediaStreams.add(mediaStream);
  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new AudioTrack(mediaStream, mediaStreamTrack);
    this._addTrack(audioTrack);
  }, this);
  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new VideoTrack(mediaStream, mediaStreamTrack);
    this._addTrack(videoTrack);
  }, this);
  return this;
}

LocalMedia.prototype._removeTrack = function _removeTrack(track) {
  var self = this;
  Media.prototype._removeTrack.call(this, track);
  track.mediaStream.stop();
  [this.audioTracks, this.videoTracks].forEach(function(tracks) {
    tracks.forEach(function(_track) {
      if (_track.mediaStream === track.mediaStream) {
        this._removeTrack(_track);
        this._needs.add(_track.label);
        if (!this._nextUserMedia) {
          this._nextUserMedia = setTimeout(function() {
            self._nextUserMedia = null;
            var needsCamera = self._needs.has('camera');
            self._needs.delete('camera');
            var needsMicrophone = self._needs.has('microphone');
            self._needs.delete('microphone');
            if (needsCamera || needsMicrophone) {
              if (needsCamera && !needsMicrophone) {
                self.addCamera();
              } else if (needsMicrophone && !needsCamera) {
                self.addMicrophone();
              } else {
                getUserMedia().then(self.addStream.bind(self));
              }
            }
          });
        }
      }
    }, this);
  }, this);
  this._needs.delete(track.label);
  return track;
};

/**
 * Stop all audio and video {@link Track}s on this {@link Twilio.LocalMedia} object.
 * @instance
 * @returns {Twilio.LocalMedia}
 */
LocalMedia.prototype.stop = function stop() {
  [this.audioTracks, this.videoTracks].forEach(function(tracks) {
    tracks.forEach(function(track) {
      track.stop();
    });
  });
  return this;
};

Media.LocalMedia = LocalMedia;

module.exports = Media;
