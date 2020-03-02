'use strict';

const MediaStream = require('@twilio/webrtc').MediaStream;
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
      _isStarted: {
        get() {
          return isStarted;
        },
        set(_isStarted) {
          isStarted = _isStarted;
        }
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
        value: mediaTrackTransceiver.track
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

module.exports = MediaTrack;
