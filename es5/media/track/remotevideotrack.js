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

    var RealIntersectionObserver = typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : null;
    options = Object.assign({
      idleTrackSwitchOff: true,
      enableDocumentVisibilityTurnOff: true,
      IntersectionObserver: RealIntersectionObserver
    }, options);

    var _this = _possibleConstructorReturn(this, (RemoteVideoTrack.__proto__ || Object.getPrototypeOf(RemoteVideoTrack)).call(this, sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options));

    Object.defineProperties(_this, {
      _enableDocumentVisibilityTurnOff: {
        value: options.enableDocumentVisibilityTurnOff
      },
      _documentVisibilityTurnOffCleanup: {
        value: null,
        writable: true
      },
      _idleTrackSwitchOff: {
        value: options.idleTrackSwitchOff
      },
      _invisibleElements: {
        value: new WeakSet()
      },
      _intersectionObserver: {
        value: options.IntersectionObserver ? new options.IntersectionObserver(function (entries) {
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
            updateRenderHints(_this);
          }
        }, { threshold: 0.25 }) : null
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
      updateRenderHints(this);
      return result;
    }
  }, {
    key: 'attach',
    value: function attach(el) {
      var result = _get(RemoteVideoTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteVideoTrack.prototype), 'attach', this).call(this, el);
      if (this._intersectionObserver) {
        this._invisibleElements.add(result);
        this._intersectionObserver.observe(result);
        // NOTE(mpatwardhan): we do not call updateRenderHints here,
        // because the dimensions are not known for freshly created
        // elements. we will get non-zero dimensions in _intersectionObserver
        // callback and then will call updateRenderHints.
      }

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
        if (_this2._intersectionObserver) {
          _this2._intersectionObserver.unobserve(element);
        }
        _this2._invisibleElements.delete(element);
      });

      if (this._attachments.size === 0) {
        if (this._documentVisibilityTurnOffCleanup) {
          this._documentVisibilityTurnOffCleanup();
          this._documentVisibilityTurnOffCleanup = null;
        }
      }

      updateRenderHints(this);
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
     *     this.outputFrame = new OffscreenCanvas(0, 0);
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrame) {
     *     this.outputFrame.width = inputFrame.width;
     *     this.outputFrame.height = inputFrame.height;
     *
     *     const context = this.outputFrame.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrame, 0, 0, inputFrame.width, inputFrame.height);
     *     return this.outputFrame;
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
     *     this.outputFrame = new OffscreenCanvas(0, 0);
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrame) {
     *     this.outputFrame.width = inputFrame.width;
     *     this.outputFrame.height = inputFrame.height;
     *
     *     const context = this.outputFrame.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrame, 0, 0, inputFrame.width, inputFrame.height);
     *     return this.outputFrame;
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
    updateRenderHints(removeVideoTrack);
  }

  documentVisibilityMonitor.onVisibilityChange(1, onVisibilityChanged);
  return function () {
    documentVisibilityMonitor.offVisibilityChange(1, onVisibilityChanged);
  };
}

/**
 * updates render hints
 */
function updateRenderHints(removeVideoTrack) {
  if (!removeVideoTrack._idleTrackSwitchOff) {
    return;
  }

  var visibleEls = removeVideoTrack._getAllAttachedElements().filter(function (el) {
    return !removeVideoTrack._invisibleElements.has(el);
  });
  var updatedRenderHint = void 0;
  if (document.visibilityState !== 'visible' || visibleEls.length === 0) {
    updatedRenderHint = { enabled: false };
  } else {
    var _visibleEls$sort = visibleEls.sort(function (el1, el2) {
      return el2.clientHeight + el2.clientWidth - el1.clientHeight - el1.clientWidth - 1;
    }),
        _visibleEls$sort2 = _slicedToArray(_visibleEls$sort, 1),
        _visibleEls$sort2$ = _visibleEls$sort2[0],
        clientHeight = _visibleEls$sort2$.clientHeight,
        clientWidth = _visibleEls$sort2$.clientWidth;

    updatedRenderHint = { enabled: true, renderDimensions: { height: clientHeight, width: clientWidth } };
  }
  removeVideoTrack._log.debug('updating render hint:', updatedRenderHint);
  removeVideoTrack._setRenderHint(updatedRenderHint);
}

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