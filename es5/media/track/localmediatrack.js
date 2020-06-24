'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaTrackSender = require('./sender');

var _require = require('@twilio/webrtc'),
    getUserMedia = _require.getUserMedia;

var _require2 = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require2.guessBrowser;

var _require3 = require('../../util'),
    waitForSometime = _require3.waitForSometime,
    waitForEvent = _require3.waitForEvent;

var documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
var gUMSilentTrackWorkaround = require('../../webaudio/workaround180748');

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
        workaroundWebKitBug1208516: workaroundWebKitBug1208516,
        getUserMedia: getUserMedia,
        gUMSilentTrackWorkaround: gUMSilentTrackWorkaround
      }, options);

      var mediaTrackSender = new MediaTrackSender(mediaStreamTrack);

      var _this = _possibleConstructorReturn(this, (LocalMediaTrack.__proto__ || Object.getPrototypeOf(LocalMediaTrack)).call(this, mediaTrackSender, options));

      Object.defineProperties(_this, {
        _getUserMedia: {
          value: options.getUserMedia
        },
        _gUMSilentTrackWorkaround: {
          value: options.gUMSilentTrackWorkaround
        },
        _workaroundWebKitBug1208516Cleanup: {
          value: null,
          writable: true
        },
        _didCallEnd: {
          value: false,
          writable: true
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
      if (options.workaroundWebKitBug1208516) {
        _this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(_this);
      }
      return _this;
    }

    /**
     * @private
     * replaces underlying track and
     * returns a promise.
     */


    _createClass(LocalMediaTrack, [{
      key: '_setMediaStreamTrack',
      value: function _setMediaStreamTrack(mediaStreamTrack) {
        var _this2 = this;

        // NOTE(mpatwardhan): Preserve the value of the "enabled" flag.
        mediaStreamTrack.enabled = this.mediaStreamTrack.enabled;

        return this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(function (err) {
          _this2._log.warn('setMediaStreamTrack failed:', err, mediaStreamTrack);
        }).then(function () {
          _this2._initialize();
          _this2._getAllAttachedElements().forEach(function (el) {
            return _this2._attach(el);
          });
        });
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
      key: '_end',
      value: function _end() {
        if (this._didCallEnd) {
          return;
        }
        _get(LocalMediaTrack.prototype.__proto__ || Object.getPrototypeOf(LocalMediaTrack.prototype), '_end', this).call(this);
        this._didCallEnd = true;
        this.emit('stopped', this);
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
      key: 'stop',
      value: function stop() {
        this._log.info('Stopping');
        if (this._workaroundWebKitBug1208516Cleanup) {
          this._workaroundWebKitBug1208516Cleanup();
          this._workaroundWebKitBug1208516Cleanup = null;
        }
        this.mediaStreamTrack.stop();
        this._end();
        return this;
      }
    }]);

    return LocalMediaTrack;
  }(AudioOrVideoTrack);
}

function restartWhenInadvertentlyStopped(localMediaTrack) {
  var getUserMedia = localMediaTrack._getUserMedia,
      gUMSilentTrackWorkaround = localMediaTrack._gUMSilentTrackWorkaround,
      log = localMediaTrack._log,
      kind = localMediaTrack.kind;

  var mediaStreamTrack = localMediaTrack.mediaStreamTrack;
  var trackChangeInProgress = false;

  function shouldReacquireTrack() {
    var _workaroundWebKitBug1208516Cleanup = localMediaTrack._workaroundWebKitBug1208516Cleanup,
        isStopped = localMediaTrack.isStopped,
        muted = localMediaTrack.mediaStreamTrack.muted;

    var isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
    return document.visibilityState === 'visible' && (muted || isInadvertentlyStopped) && !trackChangeInProgress;
  }

  function reacquireTrack() {
    var mediaStreamTrack = localMediaTrack.mediaStreamTrack;

    var constraints = Object.assign({
      audio: false,
      video: false
    }, _defineProperty({}, kind, mediaStreamTrack.getConstraints()));

    log.info('Re-acquiring the MediaStreamTrack.');
    log.debug('Constraints:', constraints);

    return gUMSilentTrackWorkaround(log, getUserMedia, constraints).then(function (mediaStream) {
      return mediaStream.getTracks()[0];
    }).catch(function (err) {
      log.warn('Failed to re-acquire the ' + kind + ' Track:', err);
      throw err;
    });
  }

  function handleTrackStateChange() {
    return Promise.race([waitForEvent(mediaStreamTrack, 'unmute'), waitForSometime(50)]).then(function () {
      if (shouldReacquireTrack()) {
        trackChangeInProgress = true;
        return reacquireTrack().then(function (newTrack) {
          log.info('Re-acquired the MediaStreamTrack.');
          log.debug('MediaStreamTrack:', newTrack);
          return localMediaTrack._setMediaStreamTrack(newTrack);
        }).catch(function (err) {
          log.warn('Error Updating ' + kind + ' Track', err);
        }).finally(function () {
          // reattach listener on updated mediaStream
          mediaStreamTrack.removeEventListener('ended', handleTrackStateChange);
          mediaStreamTrack = localMediaTrack.mediaStreamTrack;
          mediaStreamTrack.addEventListener('ended', handleTrackStateChange);
          trackChangeInProgress = false;
        });
      }
      return null;
    });
  }

  // NOTE(mpatwardhan): listen for document visibility callback on phase 1.
  // this ensures that any we acquire media tracks before RemoteMediaTrack
  // tries to `play` them (in phase 2). This order is important because
  // play can fail on safari if audio is not being captured.
  documentVisibilityMonitor.onVisible(1, handleTrackStateChange);
  mediaStreamTrack.addEventListener('ended', handleTrackStateChange);
  return function () {
    documentVisibilityMonitor.offVisible(1, handleTrackStateChange);
    mediaStreamTrack.removeEventListener('ended', handleTrackStateChange);
  };
}

module.exports = mixinLocalMediaTrack;