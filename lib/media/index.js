'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../util');
var nInstances = 0;

var Track = require('./track');
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
 * @property {Map<Track.ID, AudioTrack>} audioTracks - The {@link AudioTrack}s on
 *   this {@link Media} object
 * @property {boolean} isMuted - True if every {@link AudioTrack} on this
 *   {@link Media} object is disabled
 * @property {boolean} isPaused - True if every {@link VideoTrack} on this
 *   {@link Media} object is disabled
 * @property {Set<MediaStream>} mediaStreams - The MediaStreams associated with
 *   the {@link Track}s on this {@link Media} object
 * @property {Map<Track.ID, Track>} tracks - The {@link AudioTrack}s and
 *   {@link VideoTrack}s on this {@link Media} object
 * @property {Map<Track.ID, VideoTrack>} videoTracks - The {@link VideoTrack}s on
 *   this {@link Media} object
 * @fires Media#trackAdded
 * @fires Media#trackDimensionsChanged
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 * @fires Media#trackRemoved
 * @fires Media#trackStarted
 */
function Media(options) {
  EventEmitter.call(this);

  options = options || { };

  var attachments = new Map();
  var audioTracks = new Map();
  var mediaStreams = new Set();
  var tracks = new Map();
  var trackEventListeners = new Map();
  var videoTracks = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _instanceId: {
      value: ++nInstances
    },
    _log: {
      value: options.log.createLog('media', this)
    },
    _trackEventListeners: {
      value: trackEventListeners
    },
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

  var log = this._log;
  log.info('Created a new Media');

  return this;
}

var TRACK_ADDED = Media.TRACK_ADDED = 'trackAdded';
var TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED = 'trackDimensionsChanged';
var TRACK_DISABLED = Media.TRACK_DISABLED = 'trackDisabled';
var TRACK_ENABLED = Media.TRACK_ENABLED = 'trackEnabled';
var TRACK_REMOVED = Media.TRACK_REMOVED = 'trackRemoved';
var TRACK_STARTED = Media.TRACK_STARTED = 'trackStarted';

inherits(Media, EventEmitter);

Media.prototype.toString = function toString() {
  return '[Media #' + this._instanceId + ']';
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

  this.mediaStreams.add(track.mediaStream);

  this.tracks.set(track.id, track);

  this._reemitTrackEvents(track);

  if (track.kind === 'audio') {
    this.audioTracks.set(track.id, track);
  } else {
    this.videoTracks.set(track.id, track);
  }

  this.emit(TRACK_ADDED, track);

  var log = this._log;
  log.info('Added ' + util.trackClass(track) + ':', track.id);

  return this;
};

Media.prototype._reemitTrackEvents = function _reemitTrackEvents(track) {
  if (this._trackEventListeners.has(track)) {
    return;
  }

  var trackEventListeners = [
    [VideoTrack.DIMENSIONS_CHANGED, TRACK_DIMENSIONS_CHANGED],
    [Track.DISABLED, TRACK_DISABLED],
    [Track.ENABLED, TRACK_ENABLED],
    [Track.STARTED, TRACK_STARTED]
  ].map(function(pair) {
    var trackEvent = pair[0];
    var mediaEvent = pair[1];
    var eventListener = this._reemitTrackEvent(track, trackEvent, mediaEvent);
    return [trackEvent, eventListener];
  }, this);

  this._trackEventListeners.set(track, trackEventListeners);
};

Media.prototype._reemitTrackEvent = function _reemitTrackEvent(track, trackEvent, mediaEvent) {
  var self = this;
  function eventListener() {
    self.emit(mediaEvent, track);
  }
  track.on(trackEvent, eventListener);
  return eventListener;
};

Media.prototype._createTrackElement = function _createTrackElement(track) {
  return track.attach();
};

Media.prototype._attachTrack = function _attachTrack(el, attachments, track) {
  var trackEl = this._createTrackElement(track);
  el.appendChild(trackEl);
  attachments.set(track, trackEl);
  this._log.debug('Attached ' + track + 'to element:', trackEl);
  return this;
};

Media.prototype._detachTrack = function _detachTrack(attachments, track) {
  var trackEl = attachments.get(track);
  if (!trackEl) {
    return this;
  }
  track.detach(trackEl);
  if (trackEl.parentNode) {
    trackEl.parentNode.removeChild(trackEl);
  }
  attachments.delete(track);
  this._log.debug('Detached ' + track + ' from element:', trackEl);
  return this;
};

Media.prototype._removeTrack = function _removeTrack(track) {
  if (!this.tracks.has(track.id)) {
    return this;
  }
  this.tracks.delete(track.id);
  (track.kind === 'audio' ? this.audioTracks : this.videoTracks).delete(track.id);

  this._removeTrackEventListeners(track);

  this._updateMediaStreams();
  this.emit(TRACK_REMOVED, track);

  var log = this._log;
  log.info('Removed a ' + util.trackClass(track) + ':', track.id);

  return this;
};

Media.prototype._removeTrackEventListeners = function _removeTrackEventListeners(track) {
  var trackEventListeners = this._trackEventListeners.get(track) || [];
  this._trackEventListeners.delete(track);
  trackEventListeners.forEach(function(trackEventListener) {
    track.removeListener.apply(track, trackEventListener);
  });
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
  if (typeof el === 'string') {
    el = this._selectContainer(el);
  } else if (!el) {
    el = this._createContainer();
  }

  return this._attach(el);
};

Media.prototype._createContainer = function() {
  return document.createElement('div');
};

Media.prototype._selectContainer = function(selector) {
  var el = document.querySelector(selector);

  if (!el) {
    throw new Error('Selector matched no element: ' + selector);
  }

  return el;
};

Media.prototype._attach = function(el) {
  if (this.attachments.has(el)) {
    return el;
  }

  var attachments = new Map();
  var self = this;

  // Attach existing audio and video tracks to the element,
  this.tracks.forEach(function(track) {
    self._attachTrack(el, attachments, track);
  });

  // And update the element as tracks are added,
  this.on(TRACK_ADDED, function trackAdded(track) {
    // But stop updating the element if we've been detached.
    if (!self.attachments.has(el)) {
      return self.removeListener(TRACK_ADDED, trackAdded);
    }

    self._attachTrack(el, attachments, track);
  });

  this.on(TRACK_REMOVED, function trackRemoved(track) {
    if (!self.attachments.has(el)) {
      return self.removeListener(TRACK_REMOVED, trackRemoved);
    }

    self._detachTrack(attachments, track);
  });

  this.attachments.set(el, attachments);
  return el;
};

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
  var els;

  if (typeof el === 'string') {
    els = [this._selectContainer(el)];
  } else if (!el) {
    els = this._getAllAttachedContainers();
  } else {
    els = [el];
  }

  this._detachContainers(els);
  return el ? els[0] : els;
};

Media.prototype._detachContainers = function(containers) {
  return containers.map(this._detachContainer.bind(this));
};

Media.prototype._detachContainer = function(el) {
  if (!this.attachments.has(el)) {
    return el;
  }

  var attachments = this.attachments.get(el);
  var self = this;

  this.attachments.delete(el);
  attachments.forEach(function(trackEl, track) {
    self._detachTrack(attachments, track);
  });

  return el;
};

Media.prototype._getAllAttachedContainers = function() {
  var els = [];

  this.attachments.forEach(function(attachments, el) {
    els.push(el);
  });

  return els;
};

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
