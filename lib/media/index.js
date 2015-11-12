'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var Track = require('./track');
var AudioTrack = require('./track/audiotrack');
var VideoTrack = require('./track/videotrack');

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
 * @property {Map<string, AudioTrack>} audioTracks - A Map of {@link AudioTrack}s on
 *   this {@link Media} object, keyed by {@link AudioTrack} ID
 * @property {boolean} isMuted - True if every {@link AudioTrack} on this
 *   {@link Media} object is disabled
 * @property {boolean} isPaused - True if every {@link VideoTrack} on this
 *   {@link Media} object is disabled
 * @property {Set<MediaStream>} mediaStreams - The MediaStreams associated with
 *   the {@link Track}s on this {@link Media} object
 * @property {Map<string, Track>} tracks - The Map of {@link AudioTrack}s and
 *   {@link VideoTrack}s on this {@link Media} object, keyed by {@link Track} ID
 * @property {Map<string, VideoTrack>} videoTracks - The Set of {@link VideoTrack}s on
 *   this {@link Media} object, keyed by {@link VideoTrack} ID
 * @fires Media#trackAdded
 * @fires Media#trackDimensionsChanged
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 * @fires Media#trackEnded
 * @fires Media#trackRemoved
 * @fires Media#trackStarted
 */
function Media() {
  EventEmitter.call(this);

  var attachments = new Map();
  var audioTracks = new Map();
  var mediaStreams = new Set();
  var tracks = new Map();
  var videoTracks = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    attachments: {
      enumerable: true,
      value: attachments
    },
    audioTracks: {
      enumerable: true,
      value: audioTracks
    },
    isMuted: {
      enumerable: true,
      get: function() {
        var isMuted = true;
        audioTracks.forEach(function(track) {
          isMuted = isMuted && !track.isEnabled;
        });
        return isMuted;
      }
    },
    isPaused: {
      enumerable: true,
      get: function() {
        var isPaused = true;
        videoTracks.forEach(function(track) {
          isPaused = isPaused && !track.isEnabled;
        });
        return isPaused;
      }
    },
    mediaStreams: {
      enumerable: true,
      value: mediaStreams
    },
    tracks: {
      enumerable: true,
      value: tracks
    },
    videoTracks: {
      enumerable: true,
      value: videoTracks
    }
  });
  return this;
}

var TRACK_ADDED = Media.TRACK_ADDED = 'trackAdded';
var TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED = 'trackDimensionsChanged';
var TRACK_DISABLED = Media.TRACK_DISABLED = 'trackDisabled';
var TRACK_ENABLED = Media.TRACK_ENABLED = 'trackEnabled';
var TRACK_ENDED = Media.TRACK_ENDED = 'trackEnded';
var TRACK_REMOVED = Media.TRACK_REMOVED = 'trackRemoved';
var TRACK_STARTED = Media.TRACK_STARTED = 'trackStarted';

inherits(Media, EventEmitter);

Media.prototype._addStream = function _addStream(mediaStream) {
  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new AudioTrack(mediaStream, mediaStreamTrack);
    this._addTrack(audioTrack);
  }, this);
  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new VideoTrack(mediaStream, mediaStreamTrack);
    this._addTrack(videoTrack);
  }, this);
  return this;
};

Media.prototype._updateMediaStreams = function _updateMediaStreams() {
  this.mediaStreams.clear();
  this.tracks.forEach(function(track) {
    this.mediaStreams.add(track.mediaStream);
  }, this);
  return this.mediaStreams;
};

Media.prototype._addTrack = function _addTrack(track) {
  if (this.tracks.has(track.id)) {
    return this;
  }

  var self = this;
  this.mediaStreams.add(track.mediaStream);

  this.tracks.set(track.id, track);
  this._reemitTrackEvent(track, VideoTrack.DIMENSIONS_CHANGED, TRACK_DIMENSIONS_CHANGED);
  this._reemitTrackEvent(track, Track.DISABLED, TRACK_DISABLED);
  this._reemitTrackEvent(track, Track.ENABLED, TRACK_ENABLED);
  this._reemitTrackEvent(track, Track.ENDED, TRACK_ENDED);
  this._reemitTrackEvent(track, Track.STARTED, TRACK_STARTED);
  if (track.kind === 'audio') {
    this._addAudioTrack(track);
  } else {
    this._addVideoTrack(track);
  }
  this._updateMediaStreams();

  track.once(Track.ENDED, function ended() {
    self._removeTrack(track);
  });

  this.emit(TRACK_ADDED, track);

  return this;
};

Media.prototype._addAudioTrack = function _addAudioTrack(track) {
  this.audioTracks.set(track.id, track);
  return this;
};

Media.prototype._addVideoTrack = function _addVideoTrack(track) {
  this.videoTracks.set(track.id, track);
  return this;
};

Media.prototype._reemitTrackEvent = function _reemitTrackEvent(track, trackEvent, event) {
  var self = this;
  var trackSet = track.kind === 'audio' ? this.audioTracks : this.videoTracks;
  track.on(trackEvent, function onTrackEvent() {
    // FIXME(mroberts): Lazily remove the event handler, but what happens
    // if we add the Track twice? We only want to emit the event once.
    if (!trackSet.has(track.id)) {
      return track.removeListener(trackEvent, onTrackEvent);
    }
    self.emit(event, track);
  });
  return this;
};

/**
 * Add any new {@link Track}s that did not trigger the onaddtrack event. WebRTC
 * does not always call this callback, so we have to check ourselves.
 * @private
 * @returns {Media}
 */
Media.prototype._refreshTracks = function _refreshTracks() {
  this.mediaStreams.forEach(this._addStream, this);
  return this;
};

Media.prototype._attachTrack = function _attachTrack(el, attachments, track) {
  var self = this;
  var trackEl = track.attach();
  // NOTE(mroberts): We want to mute local audio, otherwise we get feedback.
  if (this.constructor !== Media && track instanceof AudioTrack) {
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
  this.tracks.delete(track.id);
  (track.kind === 'audio' ? this.audioTracks : this.videoTracks).delete(track.id);
  this._updateMediaStreams();
  this.emit(TRACK_REMOVED, track);
  return this;
};

/**
 * Attach the {@link Media} to a newly created &lt;div&gt; element.
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = media.attach();
 * document.getElementById('div#remote-media-container').appendChild(remoteMediaEl);
*//**
 * Attach the {@link Media} to an existing HTMLElement.
 * @param {HTMLElement} el - The HTMLElement to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = document.getElementById('remote-media');
 * media.attach(remoteMediaEl);
*//**
 * Attach the {@link Media} to an HTMLElement selected by
 * <code>document.querySelector</code>.
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
  }
  return attachToElement(this, el);
};

function attachToElement(media, el) {
  if (media.attachments.has(el)) {
    return el;
  }
  var attachments = new Map();
  // Attach existing audio and video tracks to the element,
  media.tracks.forEach(function(track) {
    media._attachTrack(el, attachments, track);
  }, media);
  // And update the element as tracks are added,
  media.on(TRACK_ADDED, function trackAdded(track) {
    // But stop updating the element if we've been detached.
    if (!media.attachments.has(el)) {
      return media.removeListener(TRACK_ADDED, trackAdded);
    }
    media._attachTrack(el, attachments, track);
  });
  media.on(TRACK_REMOVED, function trackRemoved(track) {
    if (!media.attachments.has(el)) {
      return media.removeListener(TRACK_REMOVED, trackRemoved);
    }
    media._detachTrack(el, attachments, track);
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
 * Detach the {@link Media} from any and all previously attached HTMLElements.
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedMediaEls = media.detach();
*//**
 * Detach the {@link Media} from a previously attached HTMLElement.
 * @param {HTMLElement} el - The HTMLElement to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = document.getElementById('remote-media');
 * media.detach(remoteMediaEl);
*//**
 * Detach the {@link Media} from a previously attached HTMLElement selected by
 * <code>document.querySelector</code>.
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
  }
  return detachFromElement(this, el);
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
 * A {@link Track} was added to this {@link Media} object.
 * @param {Track} track - The {@link Track} that was added
 * @event Media#trackAdded
 */

/**
 * The dimensions of a {@link VideoTrack} on this {@link Media} object changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Media#trackDimensionsChanged
 */

/**
 * A {@link Track} on this {@link Media} object was disabled.
 * @param {Track} track - The {@link Track} that was disabled
 * @event Media#trackDisabled
 */

/**
 * A {@link Track} on this {@link Media} object was enabled.
 * @param {Track} track - The {@link Track} that was enabled
 * @event Media#trackEnabled
 */

/**
 * A {@link Track} on this {@link Media} object ended.
 * @param {Track} track - The {@link Track} that ended
 * @event Media#trackEnded
 */

/**
 * A {@link Track} was removed from this {@link Media} object.
 * @param {Track} track - The {@link Track} that was removed
 * @event Media#trackRemoved
 */

/**
 * A {@link Track} on this {@link Media} object was started.
 * @param {Track} track - The {@link Track} that was started
 * @event Media#trackStarted
 */

module.exports = Media;
