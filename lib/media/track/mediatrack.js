'use strict';

const { guessBrowser } = require('@twilio/webrtc/lib/util');
const { MediaStream } = require('@twilio/webrtc');

const { waitForEvent, waitForSometime } = require('../../util');
const localMediaRestartDeferreds = require('../../util/localmediarestartdeferreds');
const Track = require('./');

/**
 * A {@link MediaTrack} represents audio or video that can be sent to or
 * received from a {@link Room}.
 * @extends Track
 * @property {Track.ID} id - This {@link Track}'s ID
 * @property {boolean} isStarted - Whether or not the {@link MediaTrack} has
 *   started
 * @property {boolean} isEnabled - Whether or not the {@link MediaTrack} is
 *   enabled (i.e., whether it is paused or muted)
 * @property {Track.Kind} kind - The kind of the underlying
 *   MediaStreamTrack, "audio" or "video"
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 * @emits MediaTrack#disabled
 * @emits MediaTrack#enabled
 * @emits MediaTrack#started
 */
class MediaTrack extends Track {
  /**
   * Construct a {@link MediaTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  constructor(mediaTrackTransceiver, options) {
    options = Object.assign({
      playPausedElementsIfNotBackgrounded: guessBrowser() === 'safari'
        && typeof document === 'object'
        && typeof document.addEventListener === 'function'
        && typeof document.visibilityState === 'string'
    }, options);

    super(mediaTrackTransceiver.id, mediaTrackTransceiver.kind, options);
    let isStarted = false;

    options = Object.assign({
      MediaStream
    }, options);

    /* istanbul ignore next */
    Object.defineProperties(this, {
      _attachments: {
        value: new Set()
      },
      _dummyEl: {
        value: null,
        writable: true
      },
      _elShims: {
        value: new WeakMap()
      },
      _isStarted: {
        get() {
          return isStarted;
        },
        set(_isStarted) {
          isStarted = _isStarted;
        }
      },
      _playPausedElementsIfNotBackgrounded: {
        value: options.playPausedElementsIfNotBackgrounded
      },
      _shouldShimAttachedElements: {
        value: options.workaroundWebKitBug212780
          || options.playPausedElementsIfNotBackgrounded
      },
      _MediaStream: {
        value: options.MediaStream
      },
      isStarted: {
        enumerable: true,
        get() {
          return isStarted;
        }
      },
      mediaStreamTrack: {
        enumerable: true,
        get() {
          return mediaTrackTransceiver.track;
        }
      }
    });

    this._initialize();
  }

  /**
   * @private
   */
  _start() {
    this._log.debug('Started');
    this._isStarted = true;
    if (this._dummyEl) {
      this._dummyEl.oncanplay = null;
    }
    // eslint-disable-next-line no-use-before-define
    this.emit('started', this);
  }

  /**
   * @private
   */
  _initialize() {
    const self = this;

    this._log.debug('Initializing');
    this._dummyEl = this._createElement();

    this.mediaStreamTrack.addEventListener('ended', function onended() {
      self._end();
      self.mediaStreamTrack.removeEventListener('ended', onended);
    });

    if (this._dummyEl) {
      this._dummyEl.muted = true;
      this._dummyEl.oncanplay = this._start.bind(this, this._dummyEl);
      this._attach(this._dummyEl);
      this._attachments.delete(this._dummyEl);
    }
  }

  /**
   * @private
   */
  _end() {
    this._log.debug('Ended');
    if (this._dummyEl) {
      this._detachElement(this._dummyEl);
      this._dummyEl.oncanplay = null;
    }
  }

  attach(el) {
    if (typeof el === 'string') {
      el = this._selectElement(el);
    } else if (!el) {
      el = this._createElement();
    }
    this._log.debug('Attempting to attach to element:', el);
    el = this._attach(el);

    if (this._shouldShimAttachedElements && !this._elShims.has(el)) {
      const onUnintentionallyPaused = this._playPausedElementsIfNotBackgrounded
        ? () => playIfPausedAndNotBackgrounded(el, this._log)
        : null;
      this._elShims.set(el, shimMediaElement(el, onUnintentionallyPaused));
    }

    return el;
  }

  /**
   * @private
   */
  _attach(el) {
    let mediaStream = el.srcObject;
    if (!(mediaStream instanceof this._MediaStream)) {
      mediaStream = new this._MediaStream();
    }

    const getTracks = this.mediaStreamTrack.kind === 'audio'
      ? 'getAudioTracks'
      : 'getVideoTracks';

    mediaStream[getTracks]().forEach(mediaStreamTrack => {
      mediaStream.removeTrack(mediaStreamTrack);
    });
    mediaStream.addTrack(this.mediaStreamTrack);

    // NOTE(mpatwardhan): resetting `srcObject` here, causes flicker (JSDK-2641), but it lets us
    // to sidestep the a chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=1052353
    //
    el.srcObject = mediaStream;
    el.autoplay = true;
    el.playsInline = true;

    if (!this._attachments.has(el)) {
      this._attachments.add(el);
    }

    return el;
  }

  /**
   * @private
   */
  _selectElement(selector) {
    const el = document.querySelector(selector);

    if (!el) {
      throw new Error(`Selector matched no element: ${selector}`);
    }

    return el;
  }

  /**
   * @private
   */
  _createElement() {
    return typeof document !== 'undefined'
      ? document.createElement(this.kind)
      : null;
  }

  detach(el) {
    let els;

    if (typeof el === 'string') {
      els = [this._selectElement(el)];
    } else if (!el) {
      els = this._getAllAttachedElements();
    } else {
      els = [el];
    }

    this._log.debug('Attempting to detach from elements:', els);
    this._detachElements(els);
    return el ? els[0] : els;
  }

  /**
   * @private
   */
  _detachElements(elements) {
    return elements.map(this._detachElement.bind(this));
  }

  /**
   * @private
   */
  _detachElement(el) {
    if (!this._attachments.has(el)) {
      return el;
    }

    const mediaStream = el.srcObject;
    if (mediaStream instanceof this._MediaStream) {
      mediaStream.removeTrack(this.mediaStreamTrack);
    }

    this._attachments.delete(el);

    if (this._shouldShimAttachedElements && this._elShims.has(el)) {
      const shim = this._elShims.get(el);
      shim.unShim();
      this._elShims.delete(el);
    }

    return el;
  }

  /**
   * @private
   */
  _getAllAttachedElements() {
    const els = [];

    this._attachments.forEach(el => {
      els.push(el);
    });

    return els;
  }
}

/**
 * Play an HTMLMediaElement if it is paused and not backgrounded.
 * @private
 * @param {HTMLMediaElement} el
 * @param {Log} log
 * @returns {void}
 */
function playIfPausedAndNotBackgrounded(el, log) {
  const tag = el.tagName.toLowerCase();
  log.warn('Unintentionally paused:', el);

  // NOTE(mmalavalli): When the element is unintentionally paused, we wait one
  // second for the "onvisibilitychange" event on the HTMLDocument to see if the
  // app will be backgrounded. If not, then the element can be safely played.
  Promise.race([
    waitForEvent(document, 'visibilitychange'),
    waitForSometime(1000)
  ]).then(() => {
    if (document.visibilityState === 'visible') {
      // NOTE(mmalavalli): We play the inadvertently paused elements only after
      // the LocalAudioTrack is unmuted to work around WebKit Bug 213853.
      //
      // Bug: https://bugs.webkit.org/show_bug.cgi?id=213853
      //
      localMediaRestartDeferreds.whenResolved('audio').then(() => {
        log.info(`Playing unintentionally paused <${tag}> element`);
        log.debug('Element:', el);
        return el.play();
      }).then(() => {
        log.info(`Successfully played unintentionally paused <${tag}> element`);
        log.debug('Element:', el);
      }).catch(error => {
        log.warn(`Error while playing unintentionally paused <${tag}> element:`, { error, el });
      });
    }
  });
}

/**
 * Shim the pause() and play() methods of the given HTMLMediaElement so that
 * we can detect if it was paused unintentionally.
 * @param {HTMLMediaElement} el
 * @param {?function} [onUnintentionallyPaused=null]
 * @returns {{pausedIntentionally: function, unShim: function}}
 */
function shimMediaElement(el, onUnintentionallyPaused = null) {
  const origPause = el.pause;
  const origPlay = el.play;

  let pausedIntentionally = false;

  el.pause = () => {
    pausedIntentionally = true;
    return origPause.call(el);
  };

  el.play = () => {
    pausedIntentionally = false;
    return origPlay.call(el);
  };

  const onPause = onUnintentionallyPaused ? () => {
    if (!pausedIntentionally) {
      onUnintentionallyPaused();
    }
  } : null;

  if (onPause) {
    el.addEventListener('pause', onPause);
  }

  return {
    pausedIntentionally() {
      return pausedIntentionally;
    },
    unShim() {
      el.pause = origPause;
      el.play = origPlay;
      if (onPause) {
        el.removeEventListener('pause', onPause);
      }
    }
  };
}

module.exports = MediaTrack;
