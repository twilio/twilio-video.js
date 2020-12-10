'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require.guessBrowser;

var _require2 = require('@twilio/webrtc'),
    MediaStream = _require2.MediaStream;

var _require3 = require('../../util'),
    waitForEvent = _require3.waitForEvent,
    waitForSometime = _require3.waitForSometime;

var localMediaRestartDeferreds = require('../../util/localmediarestartdeferreds');
var Track = require('./');

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

var MediaTrack = function (_Track) {
  _inherits(MediaTrack, _Track);

  /**
   * Construct a {@link MediaTrack}.
   * @param {MediaTrackTransceiver} mediaTrackTransceiver
   * @param {{log: Log}} options
   */
  function MediaTrack(mediaTrackTransceiver, options) {
    _classCallCheck(this, MediaTrack);

    options = Object.assign({
      playPausedElementsIfNotBackgrounded: guessBrowser() === 'safari' && (typeof document === 'undefined' ? 'undefined' : _typeof(document)) === 'object' && typeof document.addEventListener === 'function' && typeof document.visibilityState === 'string'
    }, options);

    var _this = _possibleConstructorReturn(this, (MediaTrack.__proto__ || Object.getPrototypeOf(MediaTrack)).call(this, mediaTrackTransceiver.id, mediaTrackTransceiver.kind, options));

    var isStarted = false;

    options = Object.assign({
      MediaStream: MediaStream
    }, options);

    /* istanbul ignore next */
    Object.defineProperties(_this, {
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
        get: function get() {
          return isStarted;
        },
        set: function set(_isStarted) {
          isStarted = _isStarted;
        }
      },
      _playPausedElementsIfNotBackgrounded: {
        value: options.playPausedElementsIfNotBackgrounded
      },
      _shouldShimAttachedElements: {
        value: options.workaroundWebKitBug212780 || options.playPausedElementsIfNotBackgrounded
      },
      _MediaStream: {
        value: options.MediaStream
      },
      isStarted: {
        enumerable: true,
        get: function get() {
          return isStarted;
        }
      },
      mediaStreamTrack: {
        enumerable: true,
        get: function get() {
          return mediaTrackTransceiver.track;
        }
      }
    });

    _this._initialize();
    return _this;
  }

  /**
   * @private
   */


  _createClass(MediaTrack, [{
    key: '_start',
    value: function _start() {
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

  }, {
    key: '_initialize',
    value: function _initialize() {
      var self = this;

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

  }, {
    key: '_end',
    value: function _end() {
      this._log.debug('Ended');
      if (this._dummyEl) {
        this._detachElement(this._dummyEl);
        this._dummyEl.oncanplay = null;
      }
    }
  }, {
    key: 'attach',
    value: function attach(el) {
      var _this2 = this;

      if (typeof el === 'string') {
        el = this._selectElement(el);
      } else if (!el) {
        el = this._createElement();
      }
      this._log.debug('Attempting to attach to element:', el);
      el = this._attach(el);

      if (this._shouldShimAttachedElements && !this._elShims.has(el)) {
        var onUnintentionallyPaused = this._playPausedElementsIfNotBackgrounded ? function () {
          return playIfPausedAndNotBackgrounded(el, _this2._log);
        } : null;
        this._elShims.set(el, shimMediaElement(el, onUnintentionallyPaused));
      }

      return el;
    }

    /**
     * @private
     */

  }, {
    key: '_attach',
    value: function _attach(el) {
      var mediaStream = el.srcObject;
      if (!(mediaStream instanceof this._MediaStream)) {
        mediaStream = new this._MediaStream();
      }

      var getTracks = this.mediaStreamTrack.kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks';

      mediaStream[getTracks]().forEach(function (mediaStreamTrack) {
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

  }, {
    key: '_selectElement',
    value: function _selectElement(selector) {
      var el = document.querySelector(selector);

      if (!el) {
        throw new Error('Selector matched no element: ' + selector);
      }

      return el;
    }

    /**
     * @private
     */

  }, {
    key: '_createElement',
    value: function _createElement() {
      return typeof document !== 'undefined' ? document.createElement(this.kind) : null;
    }
  }, {
    key: 'detach',
    value: function detach(el) {
      var els = void 0;

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

  }, {
    key: '_detachElements',
    value: function _detachElements(elements) {
      return elements.map(this._detachElement.bind(this));
    }

    /**
     * @private
     */

  }, {
    key: '_detachElement',
    value: function _detachElement(el) {
      if (!this._attachments.has(el)) {
        return el;
      }

      var mediaStream = el.srcObject;
      if (mediaStream instanceof this._MediaStream) {
        mediaStream.removeTrack(this.mediaStreamTrack);
      }

      this._attachments.delete(el);

      if (this._shouldShimAttachedElements && this._elShims.has(el)) {
        var shim = this._elShims.get(el);
        shim.unShim();
        this._elShims.delete(el);
      }

      return el;
    }

    /**
     * @private
     */

  }, {
    key: '_getAllAttachedElements',
    value: function _getAllAttachedElements() {
      var els = [];

      this._attachments.forEach(function (el) {
        els.push(el);
      });

      return els;
    }
  }]);

  return MediaTrack;
}(Track);

/**
 * Play an HTMLMediaElement if it is paused and not backgrounded.
 * @private
 * @param {HTMLMediaElement} el
 * @param {Log} log
 * @returns {void}
 */


function playIfPausedAndNotBackgrounded(el, log) {
  var tag = el.tagName.toLowerCase();
  log.warn('Unintentionally paused:', el);

  // NOTE(mmalavalli): When the element is unintentionally paused, we wait one
  // second for the "onvisibilitychange" event on the HTMLDocument to see if the
  // app will be backgrounded. If not, then the element can be safely played.
  Promise.race([waitForEvent(document, 'visibilitychange'), waitForSometime(1000)]).then(function () {
    if (document.visibilityState === 'visible') {
      // NOTE(mmalavalli): We play the inadvertently paused elements only after
      // the LocalAudioTrack is unmuted to work around WebKit Bug 213853.
      //
      // Bug: https://bugs.webkit.org/show_bug.cgi?id=213853
      //
      localMediaRestartDeferreds.whenResolved('audio').then(function () {
        log.info('Playing unintentionally paused <' + tag + '> element');
        log.debug('Element:', el);
        return el.play();
      }).then(function () {
        log.info('Successfully played unintentionally paused <' + tag + '> element');
        log.debug('Element:', el);
      }).catch(function (error) {
        log.warn('Error while playing unintentionally paused <' + tag + '> element:', { error: error, el: el });
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
function shimMediaElement(el) {
  var onUnintentionallyPaused = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var origPause = el.pause;
  var origPlay = el.play;

  var _pausedIntentionally = false;

  el.pause = function () {
    _pausedIntentionally = true;
    return origPause.call(el);
  };

  el.play = function () {
    _pausedIntentionally = false;
    return origPlay.call(el);
  };

  var onPause = onUnintentionallyPaused ? function () {
    if (!_pausedIntentionally) {
      onUnintentionallyPaused();
    }
  } : null;

  if (onPause) {
    el.addEventListener('pause', onPause);
  }

  return {
    pausedIntentionally: function pausedIntentionally() {
      return _pausedIntentionally;
    },
    unShim: function unShim() {
      el.pause = origPause;
      el.play = origPlay;
      if (onPause) {
        el.removeEventListener('pause', onPause);
      }
    }
  };
}

module.exports = MediaTrack;