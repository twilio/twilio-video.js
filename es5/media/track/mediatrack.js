'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaStream = require('@twilio/webrtc').MediaStream;
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
      _isStarted: {
        get: function get() {
          return isStarted;
        },
        set: function set(_isStarted) {
          isStarted = _isStarted;
        }
      },
      _MediaStream: {
        value: options.MediaStream
      },
      isStarted: {
        get: function get() {
          return isStarted;
        }
      },
      mediaStreamTrack: {
        enumerable: true,
        value: mediaTrackTransceiver.track
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
      if (typeof el === 'string') {
        el = this._selectElement(el);
      } else if (!el) {
        el = this._createElement();
      }
      this._log.debug('Attempting to attach to element:', el);
      el = this._attach(el);

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

      // NOTE(mroberts): Although we don't necessarily need to reset `srcObject`,
      // we've been doing it here for a while, and it turns out it has allowed us
      // to sidestep the following issue:
      //
      //   https://bugs.chromium.org/p/chromium/issues/detail?id=720258
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
        // NOTE(mroberts): It's as if, in Chrome and Safari, the <audio> element's
        // `srcObject` setter is taking a "snapshot" of the MediaStream's
        // MediaStreamTracks in order to playback; hence, calls to `removeTrack`
        // don't take effect unless you set the <audio> element's `srcObject` again.
        //
        //   https://bugs.chromium.org/p/chromium/issues/detail?id=749928
        //
        el.srcObject = mediaStream;
      }

      this._attachments.delete(el);
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

module.exports = MediaTrack;