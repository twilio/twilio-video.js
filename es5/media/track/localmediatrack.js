/* eslint new-cap:0 */
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('@twilio/webrtc'),
    getUserMedia = _require.getUserMedia;

var _require2 = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require2.guessBrowser;

var _require3 = require('../../util'),
    capitalize = _require3.capitalize,
    defer = _require3.defer,
    waitForSometime = _require3.waitForSometime,
    waitForEvent = _require3.waitForEvent;

var _require4 = require('../../util/constants'),
    ILLEGAL_INVOKE = _require4.typeErrors.ILLEGAL_INVOKE;

var detectSilentAudio = require('../../util/detectsilentaudio');
var detectSilentVideo = require('../../util/detectsilentvideo');
var documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
var localMediaRestartDeferreds = require('../../util/localmediarestartdeferreds');
var gUMSilentTrackWorkaround = require('../../webaudio/workaround180748');
var MediaTrackSender = require('./sender');

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
   * @emits LocalMediaTrack#stopped
   */
  return function (_AudioOrVideoTrack) {
    _inherits(LocalMediaTrack, _AudioOrVideoTrack);

    /**
     * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
     * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
     */
    function LocalMediaTrack(mediaStreamTrack, options) {
      _classCallCheck(this, LocalMediaTrack);

      // NOTE(mpatwardhan): by default workaround for WebKitBug1208516 will be enabled on Safari browsers
      // although the bug is seen  mainly on iOS devices, we do not have a reliable way to tell iOS from MacOs
      // userAgent on iOS pretends its macOs if Safari is set to request desktop pages.
      var workaroundWebKitBug1208516 = guessBrowser() === 'safari' && (typeof document === 'undefined' ? 'undefined' : _typeof(document)) === 'object' && typeof document.addEventListener === 'function' && typeof document.visibilityState === 'string';

      options = Object.assign({
        getUserMedia: getUserMedia,
        isCreatedByCreateLocalTracks: false,
        workaroundWebKitBug1208516: workaroundWebKitBug1208516,
        gUMSilentTrackWorkaround: gUMSilentTrackWorkaround
      }, options);

      var mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      var kind = mediaTrackSender.kind;

      var _this = _possibleConstructorReturn(this, (LocalMediaTrack.__proto__ || Object.getPrototypeOf(LocalMediaTrack)).call(this, mediaTrackSender, options));

      Object.defineProperties(_this, {
        _constraints: {
          value: _typeof(options[kind]) === 'object' ? options[kind] : {},
          writable: true
        },
        _getUserMedia: {
          value: options.getUserMedia
        },
        _gUMSilentTrackWorkaround: {
          value: options.gUMSilentTrackWorkaround
        },
        _workaroundWebKitBug1208516: {
          value: options.workaroundWebKitBug1208516
        },
        _workaroundWebKitBug1208516Cleanup: {
          value: null,
          writable: true
        },
        _didCallEnd: {
          value: false,
          writable: true
        },
        _isCreatedByCreateLocalTracks: {
          value: options.isCreatedByCreateLocalTracks
        },
        _trackSender: {
          value: mediaTrackSender
        },
        id: {
          enumerable: true,
          value: mediaTrackSender.id
        },
        isEnabled: {
          enumerable: true,
          get: function get() {
            return mediaTrackSender.enabled;
          }
        },
        isStopped: {
          enumerable: true,
          get: function get() {
            return mediaTrackSender.readyState === 'ended';
          }
        }
      });

      // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
      // upon foregrounding, re-acquire new MediaStreamTrack if the existing one is ended or muted.
      if (_this._workaroundWebKitBug1208516) {
        _this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(_this);
      }
      return _this;
    }

    /**
     * @private
     */


    _createClass(LocalMediaTrack, [{
      key: '_end',
      value: function _end() {
        if (this._didCallEnd) {
          return;
        }
        _get(LocalMediaTrack.prototype.__proto__ || Object.getPrototypeOf(LocalMediaTrack.prototype), '_end', this).call(this);
        this._didCallEnd = true;
        this.emit('stopped', this);
      }

      /**
       * @private
       */

    }, {
      key: '_initialize',
      value: function _initialize() {
        if (this._didCallEnd) {
          this._didCallEnd = false;
        }
        _get(LocalMediaTrack.prototype.__proto__ || Object.getPrototypeOf(LocalMediaTrack.prototype), '_initialize', this).call(this);
      }

      /**
       * @private
       */

    }, {
      key: '_reacquireTrack',
      value: function _reacquireTrack(constraints) {
        var getUserMedia = this._getUserMedia,
            gUMSilentTrackWorkaround = this._gUMSilentTrackWorkaround,
            log = this._log,
            kind = this.mediaStreamTrack.kind;


        log.info('Re-acquiring the MediaStreamTrack');
        log.debug('Constraints:', constraints);

        var gUMConstraints = Object.assign({
          audio: false,
          video: false
        }, _defineProperty({}, kind, constraints));

        var gUMPromise = this._workaroundWebKitBug1208516Cleanup ? gUMSilentTrackWorkaround(log, getUserMedia, gUMConstraints) : getUserMedia(gUMConstraints);

        return gUMPromise.then(function (mediaStream) {
          return mediaStream.getTracks()[0];
        });
      }

      /**
       * @private
       */

    }, {
      key: '_restart',
      value: function _restart(constraints) {
        var _this2 = this;

        var log = this._log;

        constraints = constraints || this._constraints;

        // NOTE(mmalavalli): If we try and restart a silent MediaStreamTrack
        // without stopping it first, then a NotReadableError is raised in case of
        // video, or the restarted audio will still be silent. Hence, we stop the
        // MediaStreamTrack here.
        this._stop();

        return this._reacquireTrack(constraints).catch(function (error) {
          log.error('Failed to re-acquire the MediaStreamTrack:', { error: error, constraints: constraints });
          throw error;
        }).then(function (newMediaStreamTrack) {
          log.info('Re-acquired the MediaStreamTrack');
          log.debug('MediaStreamTrack:', newMediaStreamTrack);
          _this2._constraints = Object.assign({}, constraints);
          return _this2._setMediaStreamTrack(newMediaStreamTrack);
        });
      }

      /**
       * @private
       */

    }, {
      key: '_setMediaStreamTrack',
      value: function _setMediaStreamTrack(mediaStreamTrack) {
        var _this3 = this;

        // NOTE(mpatwardhan): Preserve the value of the "enabled" flag.
        mediaStreamTrack.enabled = this.mediaStreamTrack.enabled;

        // NOTE(mmalavalli): Stop the current MediaStreamTrack. If not already
        // stopped, this should fire a "stopped" event.
        this._stop();

        return this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(function (error) {
          _this3._log.warn('setMediaStreamTrack failed:', { error: error, mediaStreamTrack: mediaStreamTrack });
        }).then(function () {
          _this3._initialize();
          _this3._getAllAttachedElements().forEach(function (el) {
            return _this3._attach(el);
          });
        });
      }

      /**
       * @private
       */

    }, {
      key: '_stop',
      value: function _stop() {
        this.mediaStreamTrack.stop();
        this._end();
        return this;
      }
    }, {
      key: 'enable',
      value: function enable(enabled) {
        enabled = typeof enabled === 'boolean' ? enabled : true;
        if (enabled !== this.mediaStreamTrack.enabled) {
          this._log.info((enabled ? 'En' : 'Dis') + 'abling');
          this.mediaStreamTrack.enabled = enabled;
          this.emit(enabled ? 'enabled' : 'disabled', this);
        }
        return this;
      }
    }, {
      key: 'disable',
      value: function disable() {
        return this.enable(false);
      }
    }, {
      key: 'restart',
      value: function restart(constraints) {
        var _this4 = this;

        var kind = this.kind;

        if (!this._isCreatedByCreateLocalTracks) {
          return Promise.reject(ILLEGAL_INVOKE('restart', 'can only be called on a' + (' Local' + capitalize(kind) + 'Track that is created using createLocalTracks') + (' or createLocal' + capitalize(kind) + 'Track.')));
        }
        if (this._workaroundWebKitBug1208516Cleanup) {
          this._workaroundWebKitBug1208516Cleanup();
          this._workaroundWebKitBug1208516Cleanup = null;
        }
        var promise = this._restart(constraints);

        if (this._workaroundWebKitBug1208516) {
          promise = promise.finally(function () {
            _this4._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(_this4);
          });
        }
        return promise;
      }
    }, {
      key: 'stop',
      value: function stop() {
        this._log.info('Stopping');
        if (this._workaroundWebKitBug1208516Cleanup) {
          this._workaroundWebKitBug1208516Cleanup();
          this._workaroundWebKitBug1208516Cleanup = null;
        }
        return this._stop();
      }
    }]);

    return LocalMediaTrack;
  }(AudioOrVideoTrack);
}

/**
 * Restart the given {@link LocalMediaTrack} if it has been inadvertently stopped.
 * @private
 * @param {LocalAudioTrack|LocalVideoTrack} localMediaTrack
 * @returns {function} Clean up listeners attached by the workaround
 */
function restartWhenInadvertentlyStopped(localMediaTrack) {
  var log = localMediaTrack._log,
      kind = localMediaTrack.kind;

  var detectSilence = { audio: detectSilentAudio, video: detectSilentVideo }[kind];

  var el = localMediaTrack._dummyEl,
      mediaStreamTrack = localMediaTrack.mediaStreamTrack;

  var trackChangeInProgress = null;

  function checkSilence() {
    // The dummy element is paused, so play it and then detect silence.
    return el.play().then(function () {
      return detectSilence(el);
    }).then(function (isSilent) {
      if (isSilent) {
        log.warn('Silence detected');
      } else {
        log.info('Non-silence detected');
      }
      return isSilent;
    }).catch(function (error) {
      log.warn('Failed to detect silence:', error);
    }).finally(function () {
      // Pause the dummy element again.
      el.pause();
    });
  }

  function shouldReacquireTrack() {
    var _workaroundWebKitBug1208516Cleanup = localMediaTrack._workaroundWebKitBug1208516Cleanup,
        isStopped = localMediaTrack.isStopped,
        muted = localMediaTrack.mediaStreamTrack.muted;


    var isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;

    // NOTE(mmalavalli): Restart the LocalMediaTrack if:
    // 1. The app is foregrounded, and
    // 2. A restart is not already in progress, and
    // 3. The LocalMediaTrack is either muted, inadvertently stopped or silent
    return Promise.resolve().then(function () {
      return document.visibilityState === 'visible' && !trackChangeInProgress && (muted || isInadvertentlyStopped || checkSilence());
    });
  }

  function maybeRestart() {
    return Promise.race([waitForEvent(mediaStreamTrack, 'unmute'), waitForSometime(50)]).then(function () {
      return shouldReacquireTrack();
    }).then(function (shouldReacquire) {
      if (shouldReacquire && !trackChangeInProgress) {
        trackChangeInProgress = defer();
        localMediaTrack._restart().finally(function () {
          el = localMediaTrack._dummyEl;
          removeMediaStreamTrackListeners();
          mediaStreamTrack = localMediaTrack.mediaStreamTrack;
          addMediaStreamTrackListeners();
          trackChangeInProgress.resolve();
          trackChangeInProgress = null;
        });
      }

      // NOTE(mmalavalli): If the MediaStreamTrack ends before the DOM is visible,
      // then this makes sure that visibility callback for phase 2 is called only
      // after the MediaStreamTrack is re-acquired.
      var promise = trackChangeInProgress && trackChangeInProgress.promise || Promise.resolve();
      return promise.finally(function () {
        return localMediaRestartDeferreds.resolveDeferred(kind);
      });
    });
  }

  function onMute() {
    var log = localMediaTrack._log,
        kind = localMediaTrack.kind;

    log.info('Muted');
    log.debug('LocalMediaTrack:', localMediaTrack);

    // NOTE(mmalavalli): When a LocalMediaTrack is muted without the app being
    // backgrounded, and the inadvertently paused elements are played before it
    // is restarted, it never gets unmuted due to the WebKit Bug 213853. Hence,
    // setting this Deferred will make sure that the inadvertently paused elements
    // are played only after the LocalMediaTrack is unmuted.
    //
    // Bug: https://bugs.webkit.org/show_bug.cgi?id=213853
    //
    localMediaRestartDeferreds.startDeferred(kind);
  }

  function addMediaStreamTrackListeners() {
    mediaStreamTrack.addEventListener('ended', maybeRestart);
    mediaStreamTrack.addEventListener('mute', onMute);
    mediaStreamTrack.addEventListener('unmute', maybeRestart);
  }

  function removeMediaStreamTrackListeners() {
    mediaStreamTrack.removeEventListener('ended', maybeRestart);
    mediaStreamTrack.removeEventListener('mute', onMute);
    mediaStreamTrack.removeEventListener('unmute', maybeRestart);
  }

  // NOTE(mpatwardhan): listen for document visibility callback on phase 1.
  // this ensures that we acquire media tracks before RemoteMediaTrack
  // tries to `play` them (in phase 2). This order is important because
  // play can fail on safari if audio is not being captured.
  documentVisibilityMonitor.onVisible(1, maybeRestart);
  addMediaStreamTrackListeners();

  return function () {
    documentVisibilityMonitor.offVisible(1, maybeRestart);
    removeMediaStreamTrackListeners();
  };
}

module.exports = mixinLocalMediaTrack;