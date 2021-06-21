'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var mixinRemoteMediaTrack = require('./remotemediatrack');
var VideoTrack = require('./videotrack');
var documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');

var _require = require('../../util/nullobserver.js'),
    NullObserver = _require.NullObserver;

var RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);

/**
 * A {@link RemoteVideoTrack} represents a {@link VideoTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @property {boolean} isEnabled - Whether the {@link RemoteVideoTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteVideoTrack}
 * @emits RemoteVideoTrack#dimensionsChanged
 * @emits RemoteVideoTrack#disabled
 * @emits RemoteVideoTrack#enabled
 * @emits RemoteVideoTrack#started
 * @emits RemoteVideoTrack#switchedOff
 * @emits RemoteVideoTrack#switchedOn
 */

var RemoteVideoTrack = function (_RemoteMediaVideoTrac) {
  _inherits(RemoteVideoTrack, _RemoteMediaVideoTrac);

  /**
   * Construct a {@link RemoteVideoTrack}.
   * @param {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
   * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
   * @param {boolean} isEnabled - whether the {@link RemoteVideoTrack} is enabled
   * @param {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
   * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
   *  {@link Track.Priority} of the {@link RemoteVideoTrack}
   * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  function RemoteVideoTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options) {
    _classCallCheck(this, RemoteVideoTrack);

    options = Object.assign({
      clientTrackSwitchOffControl: 'auto',
      contentPreferencesMode: 'auto',
      enableDocumentVisibilityTurnOff: true
    }, options);

    options = Object.assign({
      IntersectionObserver: typeof IntersectionObserver === 'undefined' || options.clientTrackSwitchOffControl !== 'auto' ? NullObserver : IntersectionObserver,
      ResizeObserver: typeof ResizeObserver === 'undefined' || options.contentPreferencesMode !== 'auto' ? NullObserver : ResizeObserver
    }, options);

    var _this = _possibleConstructorReturn(this, (RemoteVideoTrack.__proto__ || Object.getPrototypeOf(RemoteVideoTrack)).call(this, sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options));

    Object.defineProperties(_this, {
      _enableDocumentVisibilityTurnOff: {
        value: options.enableDocumentVisibilityTurnOff === true && options.clientTrackSwitchOffControl === 'auto'
      },
      _documentVisibilityTurnOffCleanup: {
        value: null,
        writable: true
      },
      _clientTrackSwitchOffControl: {
        value: options.clientTrackSwitchOffControl
      },
      _contentPreferencesMode: {
        value: options.contentPreferencesMode
      },
      _invisibleElements: {
        value: new WeakSet()
      },
      _resizeObserver: {
        value: new options.ResizeObserver(function (entries) {
          // NOTE(mpatwardhan): we ignore elements in _invisibleElements
          // to ensure that ResizeObserver does not end-up turning off a track when a fresh Video element is
          // attached and IntersectionObserver has not had its callback executed yet.
          var visibleElementResized = entries.find(function (entry) {
            return !_this._invisibleElements.has(entry.target);
          });
          if (visibleElementResized) {
            maybeUpdateRenderHints(_this);
          }
        })
      },
      _intersectionObserver: {
        value: new options.IntersectionObserver(function (entries) {
          var shouldSetRenderHint = false;
          entries.forEach(function (entry) {
            var wasVisible = !_this._invisibleElements.has(entry.target);
            if (wasVisible !== entry.isIntersecting) {
              if (entry.isIntersecting) {
                _this._log.debug('intersectionObserver detected: Off => On');
                _this._invisibleElements.delete(entry.target);
              } else {
                _this._log.debug('intersectionObserver detected: On => Off');
                _this._invisibleElements.add(entry.target);
              }
              shouldSetRenderHint = true;
            }
          });
          if (shouldSetRenderHint) {
            maybeUpdateRenderHints(_this);
          }
        }, { threshold: 0.25 })
      }
    });
    return _this;
  }

  /**
   * @private
   */


  _createClass(RemoteVideoTrack, [{
    key: '_start',
    value: function _start(dummyEl) {
      var result = _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), '_start', this).call(this, dummyEl);
      // NOTE(mpatwardhan): after emitting started, update render hints only if clientTrackSwitchOffControl is 'auto'.
      if (this._clientTrackSwitchOffControl === 'auto') {
        maybeUpdateRenderHints(this);
      }
      return result;
    }

    /**
     * Request to switch on a {@link RemoteVideoTrack}, This method is applicable only for the group rooms and only when connected with
     * clientTrackSwitchOffControl in video bandwidth profile options set to 'manual'
     * @returns {this}
     */

  }, {
    key: 'switchOn',
    value: function switchOn() {
      if (this._clientTrackSwitchOffControl !== 'manual') {
        throw new Error('Invalid state. You can call switchOn only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
      }
      this._setRenderHint({ enabled: true });
      return this;
    }

    /**
     * Request to switch off a {@link RemoteVideoTrack}, This method is applicable only for the group rooms and only when connected with
     * clientTrackSwitchOffControl in video bandwidth profile options set to 'manual'
     * @returns {this}
     */

  }, {
    key: 'switchOff',
    value: function switchOff() {
      if (this._clientTrackSwitchOffControl !== 'manual') {
        throw new Error('Invalid state. You can call switchOff only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
      }
      this._setRenderHint({ enabled: false });
      return this;
    }

    /**
     * Set the {@link RemoteVideoTrack}'s content preferences. This method is applicable only for the group rooms and only when connected with
     * videoContentPreferencesMode in video bandwidth profile options set to 'manual'
     * @param {VideoContentPreferences} contentPreferences - requested preferences.
     * @returns {this}
     */

  }, {
    key: 'setContentPreferences',
    value: function setContentPreferences(contentPreferences) {
      if (this._contentPreferencesMode !== 'manual') {
        throw new Error('Invalid state. You can call switchOn only when bandwidthProfile.video.contentPreferencesMode is set to "manual"');
      }

      if (contentPreferences.renderDimensions) {
        this._setRenderHint({ renderDimensions: contentPreferences.renderDimensions });
      }
      return this;
    }
  }, {
    key: 'attach',
    value: function attach(el) {
      var result = _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), 'attach', this).call(this, el);

      if (this._clientTrackSwitchOffControl === 'auto') {
        // start off the element as invisible. will mark it
        // visible once intersection observer calls back.
        this._invisibleElements.add(result);

        // NOTE(mpatwardhan): we do not call maybeUpdateRenderHints here,
        // because the dimensions are not known for freshly created
        // elements. we will get non-zero dimensions in _intersectionObserver
        // callback and then will call maybeUpdateRenderHints.
      }

      this._intersectionObserver.observe(result);
      this._resizeObserver.observe(result);

      if (this._enableDocumentVisibilityTurnOff) {
        this._documentVisibilityTurnOffCleanup = this._documentVisibilityTurnOffCleanup || setupDocumentVisibilityTurnOff(this);
      }

      return result;
    }
  }, {
    key: 'detach',
    value: function detach(el) {
      var _this2 = this;

      var result = _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), 'detach', this).call(this, el);
      var elements = Array.isArray(result) ? result : [result];
      elements.forEach(function (element) {
        _this2._intersectionObserver.unobserve(element);
        _this2._resizeObserver.unobserve(element);
        _this2._invisibleElements.delete(element);
      });

      if (this._attachments.size === 0) {
        if (this._documentVisibilityTurnOffCleanup) {
          this._documentVisibilityTurnOffCleanup();
          this._documentVisibilityTurnOffCleanup = null;
        }
      }

      maybeUpdateRenderHints(this);
      return result;
    }

    /**
     * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
     * When a Participant un-publishes and re-publishes a VideoTrack, a new RemoteVideoTrack is created and
     * any VideoProcessors attached to the previous RemoteVideoTrack would have to be re-added again.
     * Only Chrome supports this as of now. Calling this API from a non-supported browser will result in a log warning.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrameBuffer, outputFrameBuffer) {
     *     const context = outputFrameBuffer.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
     *   }
     * }
     *
     * const grayscaleProcessor = new GrayScaleProcessor(100);
     *
     * Array.from(room.participants.values()).forEach(participant => {
     *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
     *   remoteVideoTrack.addProcessor(grayscaleProcessor);
     * });
     */

  }, {
    key: 'addProcessor',
    value: function addProcessor() {
      return _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), 'addProcessor', this).apply(this, arguments);
    }

    /**
     * Remove the previously added {@link VideoProcessor} using `addProcessor` API.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to remove.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrameBuffer, outputFrameBuffer) {
     *     const context = outputFrameBuffer.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
     *   }
     * }
     *
     * const grayscaleProcessor = new GrayScaleProcessor(100);
     *
     * Array.from(room.participants.values()).forEach(participant => {
     *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
     *   remoteVideoTrack.addProcessor(grayscaleProcessor);
     * });
     *
     * document.getElementById('remove-button').onclick = () => {
     *   Array.from(room.participants.values()).forEach(participant => {
     *     const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
     *     remoteVideoTrack.removeProcessor(grayscaleProcessor);
     *   });
     * }
     */

  }, {
    key: 'removeProcessor',
    value: function removeProcessor() {
      return _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), 'removeProcessor', this).apply(this, arguments);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return '[RemoteVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
    }

    /**
     * Update the subscribe {@link Track.Priority} of the {@link RemoteVideoTrack}.
     * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
     *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
     *   means the {@link Track.Priority} set by the publisher is now the effective priority.
     * @returns {this}
     * @throws {RangeError}
     */

  }, {
    key: 'setPriority',
    value: function setPriority(priority) {
      return _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), 'setPriority', this).call(this, priority);
    }
  }]);

  return RemoteVideoTrack;
}(RemoteMediaVideoTrack);

function setupDocumentVisibilityTurnOff(removeVideoTrack) {
  function onVisibilityChanged() {
    maybeUpdateRenderHints(removeVideoTrack);
  }

  documentVisibilityMonitor.onVisibilityChange(1, onVisibilityChanged);
  return function () {
    documentVisibilityMonitor.offVisibilityChange(1, onVisibilityChanged);
  };
}

function maybeUpdateRenderHints(removeVideoTrack) {
  // maybeUpdateRenderHints is applicable only for "auto" modes.
  if (removeVideoTrack._clientTrackSwitchOffControl !== 'auto' && removeVideoTrack._contentPreferencesMode !== 'auto') {
    return;
  }

  var elements = removeVideoTrack._getAllAttachedElements();
  var updatedRenderHint = {};
  if (removeVideoTrack._clientTrackSwitchOffControl === 'auto') {
    // consider only visible elements.
    elements = elements.filter(function (el) {
      return !removeVideoTrack._invisibleElements.has(el);
    });
    updatedRenderHint.enabled = document.visibilityState === 'visible' && elements.length > 0;
  }

  if (removeVideoTrack._contentPreferencesMode === 'auto' && elements.length > 0) {
    var _elements$sort = elements.sort(function (el1, el2) {
      return el2.clientHeight + el2.clientWidth - el1.clientHeight - el1.clientWidth - 1;
    }),
        _elements$sort2 = _slicedToArray(_elements$sort, 1),
        _elements$sort2$ = _elements$sort2[0],
        clientHeight = _elements$sort2$.clientHeight,
        clientWidth = _elements$sort2$.clientWidth;

    updatedRenderHint.renderDimensions = { height: clientHeight, width: clientWidth };
  }

  removeVideoTrack._log.debug('updating render hint:', updatedRenderHint);
  removeVideoTrack._setRenderHint(updatedRenderHint);
}
/**
 * @typedef {object} VideoContentPreferences
 * @property {VideoTrack.Dimensions} [renderDimensions] - Render Dimensions to request for the {@link RemoteVideoTrack}.
 */

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "resumed".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that started
 * @event RemoteVideoTrack#started
 */

/**
 * A {@link RemoteVideoTrack} was switched off.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched off
 * @event RemoteVideoTrack#switchedOff
 */

/**
 * A {@link RemoteVideoTrack} was switched on.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched on
 * @event RemoteVideoTrack#switchedOn
 */

module.exports = RemoteVideoTrack;