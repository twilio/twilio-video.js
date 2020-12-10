'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DefaultBackoff = require('backoff');

var _require = require('@twilio/webrtc'),
    DefaultMediaStream = _require.MediaStream,
    DefaultRTCIceCandidate = _require.RTCIceCandidate,
    DefaultRTCPeerConnection = _require.RTCPeerConnection,
    DefaultRTCSessionDescription = _require.RTCSessionDescription,
    getStatistics = _require.getStats;

var _require2 = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require2.guessBrowser;

var _require3 = require('@twilio/webrtc/lib/util/sdp'),
    getSdpFormat = _require3.getSdpFormat;

var _require4 = require('../../util/constants'),
    DEFAULT_ICE_GATHERING_TIMEOUT_MS = _require4.DEFAULT_ICE_GATHERING_TIMEOUT_MS,
    DEFAULT_LOG_LEVEL = _require4.DEFAULT_LOG_LEVEL,
    DEFAULT_SESSION_TIMEOUT_SEC = _require4.DEFAULT_SESSION_TIMEOUT_SEC,
    iceRestartBackoffConfig = _require4.iceRestartBackoffConfig;

var _require5 = require('../../util/sdp'),
    createCodecMapForMediaSection = _require5.createCodecMapForMediaSection,
    disableRtx = _require5.disableRtx,
    enableDtxForOpus = _require5.enableDtxForOpus,
    getMediaSections = _require5.getMediaSections,
    removeSSRCAttributes = _require5.removeSSRCAttributes,
    revertSimulcastForNonVP8MediaSections = _require5.revertSimulcastForNonVP8MediaSections,
    setBitrateParameters = _require5.setBitrateParameters,
    setCodecPreferences = _require5.setCodecPreferences,
    setSimulcast = _require5.setSimulcast,
    unifiedPlanAddOrRewriteNewTrackIds = _require5.unifiedPlanAddOrRewriteNewTrackIds,
    unifiedPlanAddOrRewriteTrackIds = _require5.unifiedPlanAddOrRewriteTrackIds,
    unifiedPlanFilterLocalCodecs = _require5.unifiedPlanFilterLocalCodecs;

var DefaultTimeout = require('../../util/timeout');

var _require6 = require('../../util/twilio-video-errors'),
    MediaClientLocalDescFailedError = _require6.MediaClientLocalDescFailedError,
    MediaClientRemoteDescFailedError = _require6.MediaClientRemoteDescFailedError;

var _require7 = require('../../util'),
    buildLogLevels = _require7.buildLogLevels,
    isChromeScreenShareTrack = _require7.isChromeScreenShareTrack,
    oncePerTick = _require7.oncePerTick;

var IceBox = require('./icebox');
var DefaultIceConnectionMonitor = require('./iceconnectionmonitor.js');
var DataTrackReceiver = require('../../data/receiver');
var MediaTrackReceiver = require('../../media/track/receiver');
var StateMachine = require('../../statemachine');
var Log = require('../../util/log');
var IdentityTrackMatcher = require('../../util/sdp/trackmatcher/identity');
var OrderedTrackMatcher = require('../../util/sdp/trackmatcher/ordered');
var MIDTrackMatcher = require('../../util/sdp/trackmatcher/mid');
var workaroundIssue8329 = require('../../util/sdp/issue8329');

var guess = guessBrowser();
var isChrome = guess === 'chrome';
var isFirefox = guess === 'firefox';
var isSafari = guess === 'safari';

var isRTCRtpSenderParamsSupported = typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.prototype.getParameters === 'function' && typeof RTCRtpSender.prototype.setParameters === 'function';

var nInstances = 0;

/*
PeerConnectionV2 States
-----------------------

    +------+    +--------+
    |      |    |        |
    | open |--->| closed |
    |      |    |        |
    +------+    +--------+
      |  ^          ^
      |  |          |
      |  |          |
      v  |          |
  +----------+      |
  |          |      |
  | updating |------+
  |          |
  +----------+

*/

var states = {
  open: ['closed', 'updating'],
  updating: ['closed', 'open'],
  closed: []
};

/**
 * @extends StateMachine
 * @property {id}
 * @emits PeerConnectionV2#connectionStateChanged
 * @emits PeerConnectionV2#iceConnectionStateChanged
 * @emits PeerConnectionV2#candidates
 * @emits PeerConnectionV2#description
 */

var PeerConnectionV2 = function (_StateMachine) {
  _inherits(PeerConnectionV2, _StateMachine);

  /**
   * Construct a {@link PeerConnectionV2}.
   * @param {string} id
   * @param {EncodingParametersImpl} encodingParameters
   * @param {PreferredCodecs} preferredCodecs
   * @param {object} [options]
   */
  function PeerConnectionV2(id, encodingParameters, preferredCodecs, options) {
    _classCallCheck(this, PeerConnectionV2);

    var _this = _possibleConstructorReturn(this, (PeerConnectionV2.__proto__ || Object.getPrototypeOf(PeerConnectionV2)).call(this, 'open', states));

    options = Object.assign({
      enableDscp: false,
      dummyAudioMediaStreamTrack: null,
      isChromeScreenShareTrack: isChromeScreenShareTrack,
      iceServers: [],
      isRTCRtpSenderParamsSupported: isRTCRtpSenderParamsSupported,
      logLevel: DEFAULT_LOG_LEVEL,
      offerOptions: {},
      revertSimulcastForNonVP8MediaSections: revertSimulcastForNonVP8MediaSections,
      sessionTimeout: DEFAULT_SESSION_TIMEOUT_SEC * 1000,
      setBitrateParameters: setBitrateParameters,
      setCodecPreferences: setCodecPreferences,
      setSimulcast: setSimulcast,
      Backoff: DefaultBackoff,
      IceConnectionMonitor: DefaultIceConnectionMonitor,
      MediaStream: DefaultMediaStream,
      RTCIceCandidate: DefaultRTCIceCandidate,
      RTCPeerConnection: DefaultRTCPeerConnection,
      RTCSessionDescription: DefaultRTCSessionDescription,
      Timeout: DefaultTimeout
    }, options);

    var configuration = getConfiguration(options);
    var sdpFormat = getSdpFormat(configuration.sdpSemantics);
    var isUnifiedPlan = sdpFormat === 'unified';

    var localMediaStream = isUnifiedPlan ? null : new options.MediaStream();
    var logLevels = buildLogLevels(options.logLevel);
    var RTCPeerConnection = options.RTCPeerConnection;

    if (options.enableDscp === true) {
      options.chromeSpecificConstraints = options.chromeSpecificConstraints || {};
      options.chromeSpecificConstraints.optional = options.chromeSpecificConstraints.optional || [];
      options.chromeSpecificConstraints.optional.push({ googDscp: true });
    }

    var log = options.log ? options.log.createLog('webrtc', _this) : new Log('webrtc', _this, logLevels, options.loggerName);
    var peerConnection = new RTCPeerConnection(configuration, options.chromeSpecificConstraints);

    if (options.dummyAudioMediaStreamTrack) {
      peerConnection.addTrack(options.dummyAudioMediaStreamTrack, localMediaStream || new options.MediaStream());
    }

    Object.defineProperties(_this, {
      _appliedTrackIdsToAttributes: {
        value: new Map(),
        writable: true
      },
      _dataChannels: {
        value: new Map()
      },
      _dataTrackReceivers: {
        value: new Set()
      },
      _descriptionRevision: {
        writable: true,
        value: 0
      },
      _didGenerateLocalCandidates: {
        writable: true,
        value: false
      },
      _enableDscp: {
        value: options.enableDscp
      },
      _encodingParameters: {
        value: encodingParameters
      },
      _isChromeScreenShareTrack: {
        value: options.isChromeScreenShareTrack
      },
      _iceGatheringFailed: {
        value: false,
        writable: true
      },
      _iceGatheringTimeout: {
        value: new options.Timeout(function () {
          return _this._handleIceGatheringTimeout();
        }, DEFAULT_ICE_GATHERING_TIMEOUT_MS, false)
      },
      _iceRestartBackoff: {
        value: options.Backoff.exponential(iceRestartBackoffConfig)
      },
      _instanceId: {
        value: ++nInstances
      },
      _isIceConnectionInactive: {
        writable: true,
        value: false
      },
      _isIceLite: {
        writable: true,
        value: false
      },
      _isIceRestartBackoffInProgress: {
        writable: true,
        value: false
      },
      _isRestartingIce: {
        writable: true,
        value: false
      },
      _isUnifiedPlan: {
        value: isUnifiedPlan
      },
      _isRTCRtpSenderParamsSupported: {
        value: options.isRTCRtpSenderParamsSupported
      },
      _lastIceConnectionState: {
        writable: true,
        value: null
      },
      _lastStableDescriptionRevision: {
        writable: true,
        value: 0
      },
      _localCandidates: {
        writable: true,
        value: []
      },
      _localCodecs: {
        value: new Set()
      },
      _localCandidatesRevision: {
        writable: true,
        value: 1
      },
      _localDescriptionWithoutSimulcast: {
        writable: true,
        value: null
      },
      _localDescription: {
        writable: true,
        value: null
      },
      _localMediaStream: {
        value: localMediaStream
      },
      _localUfrag: {
        writable: true,
        value: null
      },
      _log: {
        value: log
      },
      _remoteCodecMaps: {
        value: new Map()
      },
      _rtpSenders: {
        value: new Map()
      },
      _iceConnectionMonitor: {
        value: new options.IceConnectionMonitor(peerConnection)
      },
      _mediaTrackReceivers: {
        value: new Set()
      },
      _needsAnswer: {
        writable: true,
        value: false
      },
      _negotiationRole: {
        writable: true,
        value: null
      },
      _offerOptions: {
        writable: true,
        value: options.offerOptions
      },
      _onEncodingParametersChanged: {
        value: oncePerTick(function () {
          if (_this._isRTCRtpSenderParamsSupported) {
            if (!_this._needsAnswer) {
              updateEncodingParameters(_this);
            }
            return;
          }
          _this.offer();
        })
      },
      _peerConnection: {
        value: peerConnection
      },
      _preferredAudioCodecs: {
        value: preferredCodecs.audio
      },
      _preferredVideoCodecs: {
        value: preferredCodecs.video
      },
      _shouldApplyDtx: {
        value: preferredCodecs.audio.every(function (_ref) {
          var codec = _ref.codec;
          return codec !== 'opus';
        }) || preferredCodecs.audio.some(function (_ref2) {
          var codec = _ref2.codec,
              dtx = _ref2.dtx;
          return codec === 'opus' && dtx;
        })
      },
      _shouldApplySimulcast: {
        value: (isChrome || isSafari) && preferredCodecs.video.some(function (codecSettings) {
          return codecSettings.codec.toLowerCase() === 'vp8' && codecSettings.simulcast;
        })
      },
      _queuedDescription: {
        writable: true,
        value: null
      },
      _iceReconnectTimeout: {
        value: new options.Timeout(function () {
          log.debug('ICE reconnect timed out');
          _this.close();
        }, options.sessionTimeout, false)
      },
      _recycledTransceivers: {
        value: {
          audio: [],
          video: []
        }
      },
      _replaceTrackPromises: {
        value: new Map()
      },
      _remoteCandidates: {
        writable: true,
        value: new IceBox()
      },
      _sdpFormat: {
        value: sdpFormat
      },
      _setBitrateParameters: {
        value: options.setBitrateParameters
      },
      _setCodecPreferences: {
        value: options.setCodecPreferences
      },
      _setSimulcast: {
        value: options.setSimulcast
      },
      _revertSimulcastForNonVP8MediaSections: {
        value: options.revertSimulcastForNonVP8MediaSections
      },
      _RTCIceCandidate: {
        value: options.RTCIceCandidate
      },
      _RTCPeerConnection: {
        value: options.RTCPeerConnection
      },
      _RTCSessionDescription: {
        value: options.RTCSessionDescription
      },
      _shouldOffer: {
        writable: true,
        value: false
      },
      _shouldRestartIce: {
        writable: true,
        value: false
      },
      _trackIdsToAttributes: {
        value: new Map(),
        writable: true
      },
      _trackMatcher: {
        writable: true,
        value: null
      },
      id: {
        enumerable: true,
        value: id
      }
    });

    encodingParameters.on('changed', _this._onEncodingParametersChanged);

    peerConnection.addEventListener('connectionstatechange', _this._handleConnectionStateChange.bind(_this));
    peerConnection.addEventListener('datachannel', _this._handleDataChannelEvent.bind(_this));
    peerConnection.addEventListener('icecandidate', _this._handleIceCandidateEvent.bind(_this));
    peerConnection.addEventListener('iceconnectionstatechange', _this._handleIceConnectionStateChange.bind(_this));
    peerConnection.addEventListener('icegatheringstatechange', _this._handleIceGatheringStateChange.bind(_this));
    peerConnection.addEventListener('signalingstatechange', _this._handleSignalingStateChange.bind(_this));
    peerConnection.addEventListener('track', _this._handleTrackEvent.bind(_this));
    _this._iceRestartBackoff.on('ready', function () {
      return _this._initiateIceRestart();
    });

    var self = _this;
    _this.on('stateChanged', function stateChanged(state) {
      if (state !== 'closed') {
        return;
      }
      self.removeListener('stateChanged', stateChanged);
      self._dataChannels.forEach(function (dataChannel, dataTrackSender) {
        self.removeDataTrackSender(dataTrackSender);
      });
    });
    return _this;
  }

  _createClass(PeerConnectionV2, [{
    key: 'toString',
    value: function toString() {
      return '[PeerConnectionV2 #' + this._instanceId + ': ' + this.id + ']';
    }

    /**
     * The {@link PeerConnectionV2}'s underlying RTCPeerConnection's RTCPeerConnectionState
     * if supported by the browser, its RTCIceConnectionState otherwise.
     * @property {RTCPeerConnectionState}
     */

  }, {
    key: '_addIceCandidate',


    /**
     * Add an ICE candidate to the {@link PeerConnectionV2}.
     * @private
     * @param {object} candidate
     * @returns {Promise<void>}
     */
    value: function _addIceCandidate(candidate) {
      var _this2 = this;

      return Promise.resolve().then(function () {
        candidate = new _this2._RTCIceCandidate(candidate);
        return _this2._peerConnection.addIceCandidate(candidate);
      }).catch(function (error) {
        // NOTE(mmalavalli): Firefox 68+ now generates an RTCIceCandidate with an
        // empty candidate string to signal end-of-candidates, followed by a null
        // candidate. As of now, Chrome and Safari reject this RTCIceCandidate. Since
        // this does not affect the media connection between Firefox 68+ and Chrome/Safari
        // in Peer-to-Peer Rooms, we suppress the Error and log a warning message.
        //
        // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=978582
        //
        _this2._log.warn('Failed to add RTCIceCandidate ' + (candidate ? '"' + candidate.candidate + '"' : 'null') + ': ' + error.message);
      });
    }

    /**
     * Add ICE candidates to the {@link PeerConnectionV2}.
     * @private
     * @param {Array<object>} candidates
     * @returns {Promise<void>}
     */

  }, {
    key: '_addIceCandidates',
    value: function _addIceCandidates(candidates) {
      return Promise.all(candidates.map(this._addIceCandidate, this)).then(function () {});
    }

    /**
     * Add a new RTCRtpTransceiver or update an existing RTCRtpTransceiver for the
     * given MediaStreamTrack.
     * @private
     * @param {MediaStreamTrack} track
     * @returns {RTCRtpTransceiver}
     */

  }, {
    key: '_addOrUpdateTransceiver',
    value: function _addOrUpdateTransceiver(track) {
      var _this3 = this;

      var transceiver = takeRecycledTransceiver(this, track.kind);
      if (transceiver && transceiver.sender) {
        var oldTrackId = transceiver.sender.track ? transceiver.sender.track.id : null;
        if (oldTrackId) {
          this._log.warn('Reusing transceiver: ' + transceiver.mid + '] ' + oldTrackId + ' => ' + track.id);
        }
        // NOTE(mpatwardhan):remember this transceiver while we replace track.
        // we recycle transceivers that are not in use after 'negotiationCompleted', but we want to prevent
        // this one from getting recycled while replaceTrack is pending.
        this._replaceTrackPromises.set(transceiver, transceiver.sender.replaceTrack(track).then(function () {
          transceiver.direction = 'sendrecv';
        }, function () {
          // Do nothing.
        }).finally(function () {
          _this3._replaceTrackPromises.delete(transceiver);
        }));
        return transceiver;
      }
      return this._peerConnection.addTransceiver(track);
    }

    /**
     * Check the {@link IceBox}.
     * @private
     * @param {RTCSessionDescriptionInit} description
     * @returns {Promise<void>}
     */

  }, {
    key: '_checkIceBox',
    value: function _checkIceBox(description) {
      var ufrag = getUfrag(description);
      if (!ufrag) {
        return Promise.resolve();
      }
      var candidates = this._remoteCandidates.setUfrag(ufrag);
      return this._addIceCandidates(candidates);
    }

    /**
     * Create an answer and set it on the {@link PeerConnectionV2}.
     * @private
     * @param {RTCSessionDescriptionInit} offer
     * @returns {Promise<boolean>}
     */

  }, {
    key: '_answer',
    value: function _answer(offer) {
      var _this4 = this;

      return Promise.resolve().then(function () {
        if (!_this4._negotiationRole) {
          _this4._negotiationRole = 'answerer';
        }
        return _this4._setRemoteDescription(offer);
      }).catch(function () {
        throw new MediaClientRemoteDescFailedError();
      }).then(function () {
        return _this4._peerConnection.createAnswer();
      }).then(function (answer) {
        if (isFirefox) {
          // NOTE(mmalavalli): We work around Chromium bug 1106157 by disabling
          // RTX in Firefox 79+. For more details about the bug, please go here:
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1106157
          answer = new _this4._RTCSessionDescription({
            sdp: disableRtx(answer.sdp),
            type: answer.type
          });
        } else {
          answer = workaroundIssue8329(answer);
        }

        // NOTE(mpatwardhan): Upcoming chrome versions are going to remove ssrc attributes
        // mslabel and label. See this bug https://bugs.chromium.org/p/webrtc/issues/detail?id=7110
        // and PSA: https://groups.google.com/forum/#!searchin/discuss-webrtc/PSA%7Csort:date/discuss-webrtc/jcZO-Wj0Wus/k2XvPCvoAwAJ
        // We are not referencing those attributes, but this changes goes ahead and removes them to see if it works.
        // this also helps reduce bytes on wires
        var updatedSdp = removeSSRCAttributes(answer.sdp, ['mslabel', 'label']);
        if (_this4._shouldApplySimulcast) {
          var sdpWithoutSimulcast = updatedSdp;
          updatedSdp = _this4._setSimulcast(sdpWithoutSimulcast, _this4._sdpFormat, _this4._trackIdsToAttributes);
          // NOTE(syerrapragada): VMS does not support H264 simulcast. So,
          // unset simulcast for sections in local offer where corresponding
          // sections in answer doesn't have vp8 as preferred codec and reapply offer.
          updatedSdp = _this4._revertSimulcastForNonVP8MediaSections(updatedSdp, sdpWithoutSimulcast, offer.sdp);
        }

        // NOTE(mmalavalli): Work around Chromium bug 1074421.
        // https://bugs.chromium.org/p/chromium/issues/detail?id=1074421
        updatedSdp = updatedSdp.replace(/42e015/g, '42e01f');

        return _this4._setLocalDescription({
          type: answer.type,
          sdp: updatedSdp
        });
      }).then(function () {
        return _this4._checkIceBox(offer);
      }).then(function () {
        return _this4._queuedDescription && _this4._updateDescription(_this4._queuedDescription);
      }).then(function () {
        _this4._queuedDescription = null;
        return _this4._maybeReoffer(_this4._peerConnection.localDescription);
      }).catch(function (error) {
        throw error instanceof MediaClientRemoteDescFailedError ? error : new MediaClientLocalDescFailedError();
      });
    }

    /**
     * Close the underlying RTCPeerConnection. Returns false if the
     * RTCPeerConnection was already closed.
     * @private
     * @returns {boolean}
     */

  }, {
    key: '_close',
    value: function _close() {
      this._iceConnectionMonitor.stop();
      if (this._peerConnection.signalingState !== 'closed') {
        this._peerConnection.close();
        this.preempt('closed');
        this._encodingParameters.removeListener('changed', this._onEncodingParametersChanged);
        return true;
      }
      return false;
    }

    /**
     * Handle a "connectionstatechange" event.
     * @private
     * @returns {void}
     */

  }, {
    key: '_handleConnectionStateChange',
    value: function _handleConnectionStateChange() {
      this.emit('connectionStateChanged');
    }

    /**
     * Handle a "datachannel" event.
     * @private
     * @param {RTCDataChannelEvent} event
     * @returns {void}
     */

  }, {
    key: '_handleDataChannelEvent',
    value: function _handleDataChannelEvent(event) {
      var _this5 = this;

      var dataChannel = event.channel;
      var dataTrackReceiver = new DataTrackReceiver(dataChannel);
      this._dataTrackReceivers.add(dataTrackReceiver);

      dataChannel.addEventListener('close', function () {
        _this5._dataTrackReceivers.delete(dataTrackReceiver);
      });

      this.emit('trackAdded', dataTrackReceiver);
    }

    /**
     * Handle a glare scenario on the {@link PeerConnectionV2}.
     * @private
     * @param {RTCSessionDescriptionInit} offer
     * @returns {Promise<void>}
     */

  }, {
    key: '_handleGlare',
    value: function _handleGlare(offer) {
      var _this6 = this;

      this._log.debug('Glare detected; rolling back');
      if (this._isRestartingIce) {
        this._log.debug('An ICE restart was in progress; we\'ll need to restart ICE again after rolling back');
        this._isRestartingIce = false;
        this._shouldRestartIce = true;
      }
      return Promise.resolve().then(function () {
        _this6._trackIdsToAttributes = new Map(_this6._appliedTrackIdsToAttributes);
        return _this6._setLocalDescription({ type: 'rollback' });
      }).then(function () {
        _this6._needsAnswer = false;
        return _this6._answer(offer);
      }).then(function (didReoffer) {
        return didReoffer ? Promise.resolve() : _this6._offer();
      });
    }

    /**
     * Handle an ICE candidate event.
     * @private
     * @param {Event} event
     * @returns {void}
     */

  }, {
    key: '_handleIceCandidateEvent',
    value: function _handleIceCandidateEvent(event) {
      if (event.candidate) {
        this._log.debug('Clearing ICE gathering timeout');
        this._didGenerateLocalCandidates = true;
        this._iceGatheringTimeout.clear();
        this._localCandidates.push(event.candidate);
      }
      var peerConnectionState = {
        ice: {
          candidates: this._isIceLite ? [] : this._localCandidates.slice(),
          ufrag: this._localUfrag
        },
        id: this.id
      };
      if (!event.candidate) {
        peerConnectionState.ice.complete = true;
      }
      if (!(this._isIceLite && event.candidate)) {
        peerConnectionState.ice.revision = this._localCandidatesRevision++;
        this.emit('candidates', peerConnectionState);
      }
    }

    /**
     * Handle an ICE connection state change event.
     * @private
     * @returns {void}
     */

  }, {
    key: '_handleIceConnectionStateChange',
    value: function _handleIceConnectionStateChange() {
      var _this7 = this;

      var iceConnectionState = this._peerConnection.iceConnectionState;

      var isIceConnectedOrComplete = ['connected', 'completed'].includes(iceConnectionState);
      var log = this._log;

      log.debug('ICE connection state is "' + iceConnectionState + '"');
      if (isIceConnectedOrComplete) {
        this._iceReconnectTimeout.clear();
        this._iceRestartBackoff.reset();
      }

      if (this._lastIceConnectionState !== 'failed' && iceConnectionState === 'failed' && !this._shouldRestartIce && !this._isRestartingIce) {
        // Case 1: Transition to "failed".
        log.warn('ICE failed');
        this._initiateIceRestartBackoff();
      } else if (['disconnected', 'failed'].includes(this._lastIceConnectionState) && isIceConnectedOrComplete) {
        // Case 2: Transition from "disconnected" or "failed".
        log.debug('ICE reconnected');
      }

      // start monitor media when connected, and continue to monitor while state is complete-disconnected-connected.
      if (iceConnectionState === 'connected') {
        this._isIceConnectionInactive = false;
        this._iceConnectionMonitor.start(function () {
          // note: iceConnection monitor waits for iceConnectionState=disconnected for
          // detecting inactivity. Its possible that it may know about disconnected before _handleIceConnectionStateChange
          _this7._iceConnectionMonitor.stop();
          if (!_this7._shouldRestartIce && !_this7._isRestartingIce) {
            log.warn('ICE Connection Monitor detected inactivity');
            _this7._isIceConnectionInactive = true;
            _this7._initiateIceRestartBackoff();
            _this7.emit('iceConnectionStateChanged');
            _this7.emit('connectionStateChanged');
          }
        });
      } else if (!['disconnected', 'completed'].includes(iceConnectionState)) {
        // don't stop monitoring for disconnected or completed.
        this._iceConnectionMonitor.stop();
        this._isIceConnectionInactive = false;
      }

      this._lastIceConnectionState = iceConnectionState;
      this.emit('iceConnectionStateChanged');
    }

    /**
     * Handle ICE gathering timeout.
     * @private
     * @returns {void}
     */

  }, {
    key: '_handleIceGatheringTimeout',
    value: function _handleIceGatheringTimeout() {
      this._log.warn('ICE failed to gather any local candidates');
      this._iceGatheringFailed = true;
      this._initiateIceRestartBackoff();
      this.emit('iceConnectionStateChanged');
      this.emit('connectionStateChanged');
    }

    /**
     * Handle an ICE gathering state change event.
     * @private
     * @returns {void}
     */

  }, {
    key: '_handleIceGatheringStateChange',
    value: function _handleIceGatheringStateChange() {
      var iceGatheringState = this._peerConnection.iceGatheringState;

      var log = this._log;
      log.debug('ICE gathering state is "' + iceGatheringState + '"');

      // NOTE(mmalavalli): Start the ICE gathering timeout only if the RTCPeerConnection
      // has started gathering candidates for the first time since the initial offer/answer
      // or an offer/answer with ICE restart.
      var _iceGatheringTimeout = this._iceGatheringTimeout,
          delay = _iceGatheringTimeout.delay,
          isSet = _iceGatheringTimeout.isSet;

      if (iceGatheringState === 'gathering' && !this._didGenerateLocalCandidates && !isSet) {
        log.debug('Starting ICE gathering timeout: ' + delay);
        this._iceGatheringFailed = false;
        this._iceGatheringTimeout.start();
      }
    }

    /**
     * Handle a signaling state change event.
     * @private
     * @returns {void}
     */

  }, {
    key: '_handleSignalingStateChange',
    value: function _handleSignalingStateChange() {
      if (this._peerConnection.signalingState === 'stable') {
        this._appliedTrackIdsToAttributes = new Map(this._trackIdsToAttributes);
      }
    }

    /**
     * Handle a track event.
     * @private
     * @param {Event} event
     * @returns {void}
     */

  }, {
    key: '_handleTrackEvent',
    value: function _handleTrackEvent(event) {
      var _this8 = this;

      var sdp = this._peerConnection.remoteDescription ? this._peerConnection.remoteDescription.sdp : null;

      if (!this._trackMatcher) {
        this._trackMatcher = event.transceiver && event.transceiver.mid ? new MIDTrackMatcher()
        // NOTE(mroberts): Until Chrome ships RTCRtpTransceivers with MID
        // support, we have to use the same hacky solution as Safari. Revisit
        // this when RTCRtpTransceivers and MIDs land. We should be able to use
        // the same technique as Firefox.
        : isSafari || this._isUnifiedPlan ? new OrderedTrackMatcher() : new IdentityTrackMatcher();
      }
      this._trackMatcher.update(sdp);

      var mediaStreamTrack = event.track;
      var signaledTrackId = this._trackMatcher.match(event) || mediaStreamTrack.id;
      var mediaTrackReceiver = new MediaTrackReceiver(signaledTrackId, mediaStreamTrack);

      // NOTE(mmalavalli): In unified plan mode, "ended" is not fired on the remote
      // MediaStreamTrack when the remote peer removes a track. So, when this
      // MediaStreamTrack is re-used for a different track due to the remote peer
      // calling RTCRtpSender.replaceTrack(), we delete the previous MediaTrackReceiver
      // that owned this MediaStreamTrack before adding the new MediaTrackReceiver.
      this._mediaTrackReceivers.forEach(function (trackReceiver) {
        if (trackReceiver.track.id === mediaTrackReceiver.track.id) {
          _this8._mediaTrackReceivers.delete(trackReceiver);
        }
      });

      this._mediaTrackReceivers.add(mediaTrackReceiver);
      mediaStreamTrack.addEventListener('ended', function () {
        return _this8._mediaTrackReceivers.delete(mediaTrackReceiver);
      });
      this.emit('trackAdded', mediaTrackReceiver);
    }

    /**
     * Initiate ICE Restart.
     * @private
     * @returns {void}
     */

  }, {
    key: '_initiateIceRestart',
    value: function _initiateIceRestart() {
      if (this._peerConnection.signalingState === 'closed') {
        return;
      }
      var log = this._log;
      log.warn('Attempting to restart ICE');
      this._didGenerateLocalCandidates = false;
      this._isIceRestartBackoffInProgress = false;
      this._shouldRestartIce = true;

      var _iceReconnectTimeout = this._iceReconnectTimeout,
          delay = _iceReconnectTimeout.delay,
          isSet = _iceReconnectTimeout.isSet;

      if (!isSet) {
        log.debug('Starting ICE reconnect timeout: ' + delay);
        this._iceReconnectTimeout.start();
      }
      this.offer();
    }

    /**
     * Schedule an ICE Restart.
     * @private
     * @returns {void}
     */

  }, {
    key: '_initiateIceRestartBackoff',
    value: function _initiateIceRestartBackoff() {
      if (this._peerConnection.signalingState === 'closed' || this._isIceRestartBackoffInProgress) {
        return;
      }
      this._log.warn('An ICE restart has been scheduled');
      this._isIceRestartBackoffInProgress = true;
      this._iceRestartBackoff.backoff();
    }

    /**
     * Conditionally re-offer.
     * @private
     * @param {?RTCSessionDescriptionInit} localDescription
     * @returns {Promise<boolean>}
     */

  }, {
    key: '_maybeReoffer',
    value: function _maybeReoffer(localDescription) {
      var shouldReoffer = this._shouldOffer;

      if (localDescription && localDescription.sdp) {
        // NOTE(mmalavalli): For "unified-plan" sdps, if the local RTCSessionDescription
        // has fewer audio and/or video send* m= lines than the corresponding RTCRtpSenders
        // with non-null MediaStreamTracks, it means that the newly added RTCRtpSenders
        // require renegotiation.
        if (this._isUnifiedPlan) {
          var senders = this._peerConnection.getSenders().filter(function (sender) {
            return sender.track;
          });
          shouldReoffer = ['audio', 'video'].reduce(function (shouldOffer, kind) {
            var mediaSections = getMediaSections(localDescription.sdp, kind, '(sendrecv|sendonly)');
            var sendersOfKind = senders.filter(isSenderOfKind.bind(null, kind));
            return shouldOffer || mediaSections.length < sendersOfKind.length;
          }, shouldReoffer);
        }

        // NOTE(mroberts): We also need to re-offer if we have a DataTrack to share
        // but no m= application section.
        var hasDataTrack = this._dataChannels.size > 0;
        var hasApplicationMediaSection = getMediaSections(localDescription.sdp, 'application').length > 0;
        var needsApplicationMediaSection = hasDataTrack && !hasApplicationMediaSection;
        shouldReoffer = shouldReoffer || needsApplicationMediaSection;
      }

      var promise = shouldReoffer ? this._offer() : Promise.resolve();
      return promise.then(function () {
        return shouldReoffer;
      });
    }

    /**
     * Create an offer and set it on the {@link PeerConnectionV2}.
     * @private
     * @returns {Promise<void>}
     */

  }, {
    key: '_offer',
    value: function _offer() {
      var _this9 = this;

      var offerOptions = Object.assign({}, this._offerOptions);
      this._needsAnswer = true;
      if (this._shouldRestartIce) {
        this._shouldRestartIce = false;
        this._isRestartingIce = true;
        offerOptions.iceRestart = true;
      }

      return Promise.all(this._replaceTrackPromises.values()).then(function () {
        return _this9._peerConnection.createOffer(offerOptions);
      }).catch(function () {
        throw new MediaClientLocalDescFailedError();
      }).then(function (offer) {
        if (isFirefox) {
          // NOTE(mmalavalli): We work around Chromium bug 1106157 by disabling
          // RTX in Firefox 79+. For more details about the bug, please go here:
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1106157
          offer = new _this9._RTCSessionDescription({
            sdp: disableRtx(offer.sdp),
            type: offer.type
          });
        } else {
          offer = workaroundIssue8329(offer);
        }

        // NOTE(mpatwardhan): upcoming chrome versions are going to remove ssrc attributes
        // mslabel and label. See this bug https://bugs.chromium.org/p/webrtc/issues/detail?id=7110
        // and PSA: https://groups.google.com/forum/#!searchin/discuss-webrtc/PSA%7Csort:date/discuss-webrtc/jcZO-Wj0Wus/k2XvPCvoAwAJ
        // Looks like we are not referencing those attributes, but this changes goes ahead and removes them to see if it works.
        // this also helps reduce bytes on wires
        var sdp = removeSSRCAttributes(offer.sdp, ['mslabel', 'label']);
        sdp = _this9._isUnifiedPlan && _this9._peerConnection.remoteDescription ? unifiedPlanFilterLocalCodecs(sdp, _this9._peerConnection.remoteDescription.sdp) : sdp;

        var updatedSdp = _this9._setCodecPreferences(sdp, _this9._preferredAudioCodecs, _this9._preferredVideoCodecs);

        _this9._shouldOffer = false;
        if (!_this9._negotiationRole) {
          _this9._negotiationRole = 'offerer';
        }

        if (_this9._shouldApplySimulcast) {
          _this9._localDescriptionWithoutSimulcast = {
            type: 'offer',
            sdp: updatedSdp
          };
          updatedSdp = _this9._setSimulcast(updatedSdp, _this9._sdpFormat, _this9._trackIdsToAttributes);
        }
        return _this9._setLocalDescription({
          type: 'offer',
          sdp: updatedSdp
        });
      });
    }

    /**
     * Get the MediaTrackSender ID of the given MediaStreamTrack ID.
     * Since a MediaTrackSender's underlying MediaStreamTrack can be
     * replaced, the corresponding IDs can mismatch.
     * @private
     * @param {Track.ID} id
     * @returns {Track.ID}
     */

  }, {
    key: '_getMediaTrackSenderId',
    value: function _getMediaTrackSenderId(trackId) {
      var mediaTrackSender = Array.from(this._rtpSenders.keys()).find(function (_ref3) {
        var id = _ref3.track.id;
        return id === trackId;
      });
      return mediaTrackSender ? mediaTrackSender.id : trackId;
    }

    /**
     * Add or rewrite local MediaStreamTrack IDs in the given Unified Plan RTCSessionDescription.
     * @private
     * @param {RTCSessionDescription} description
     * @return {RTCSessionDescription}
     */

  }, {
    key: '_addOrRewriteLocalTrackIds',
    value: function _addOrRewriteLocalTrackIds(description) {
      var _this10 = this;

      var transceivers = this._peerConnection.getTransceivers();
      var activeTransceivers = transceivers.filter(function (_ref4) {
        var sender = _ref4.sender,
            stopped = _ref4.stopped;
        return !stopped && sender && sender.track;
      });

      // NOTE(mmalavalli): There is no guarantee that MediaStreamTrack IDs will be present in
      // SDPs, and even if they are, there is no guarantee that they will be the same as the
      // actual MediaStreamTrack IDs. So, we add or re-write the actual MediaStreamTrack IDs
      // to the assigned m= sections here.
      var assignedTransceivers = activeTransceivers.filter(function (_ref5) {
        var mid = _ref5.mid;
        return mid;
      });
      var midsToTrackIds = new Map(assignedTransceivers.map(function (_ref6) {
        var mid = _ref6.mid,
            sender = _ref6.sender;
        return [mid, _this10._getMediaTrackSenderId(sender.track.id)];
      }));
      var sdp1 = unifiedPlanAddOrRewriteTrackIds(description.sdp, midsToTrackIds);

      // NOTE(mmalavalli): Chrome and Safari do not apply the offer until they get an answer.
      // So, we add or re-write the actual MediaStreamTrack IDs to the unassigned m= sections here.
      var unassignedTransceivers = activeTransceivers.filter(function (_ref7) {
        var mid = _ref7.mid;
        return !mid;
      });
      var newTrackIdsByKind = new Map(['audio', 'video'].map(function (kind) {
        return [kind, unassignedTransceivers.filter(function (_ref8) {
          var sender = _ref8.sender;
          return sender.track.kind === kind;
        }).map(function (_ref9) {
          var sender = _ref9.sender;
          return _this10._getMediaTrackSenderId(sender.track.id);
        })];
      }));
      var sdp2 = unifiedPlanAddOrRewriteNewTrackIds(sdp1, midsToTrackIds, newTrackIdsByKind);

      return new this._RTCSessionDescription({
        sdp: sdp2,
        type: description.type
      });
    }

    /**
     * Rollback and apply the given offer.
     * @private
     * @param {RTCSessionDescriptionInit} offer
     * @returns {Promise<void>}
     */

  }, {
    key: '_rollbackAndApplyOffer',
    value: function _rollbackAndApplyOffer(offer) {
      var _this11 = this;

      return this._setLocalDescription({ type: 'rollback' }).then(function () {
        return _this11._setLocalDescription(offer);
      });
    }

    /**
     * Set a local description on the {@link PeerConnectionV2}.
     * @private
     * @param {RTCSessionDescription|RTCSessionDescriptionInit} description
     * @returns {Promise<void>}
     */

  }, {
    key: '_setLocalDescription',
    value: function _setLocalDescription(description) {
      var _this12 = this;

      if (description.type !== 'rollback' && this._shouldApplyDtx) {
        description = new this._RTCSessionDescription({
          sdp: enableDtxForOpus(description.sdp),
          type: description.type
        });
      }
      return this._peerConnection.setLocalDescription(description).catch(function (error) {
        _this12._log.warn('Calling setLocalDescription with an RTCSessionDescription of type "' + description.type + '" failed with the error "' + error.message + '".');
        if (description.sdp) {
          _this12._log.warn('The SDP was ' + description.sdp);
        }
        throw new MediaClientLocalDescFailedError();
      }).then(function () {
        if (description.type !== 'rollback') {
          _this12._localDescription = _this12._isUnifiedPlan ? _this12._addOrRewriteLocalTrackIds(description) : description;

          // NOTE(mmalavalli): In order for this feature to be backward compatible with older
          // SDK versions which to not support opus DTX, we append "usedtx=1" to the local SDP
          // only while applying it. We will not send it over the wire to prevent inadvertent
          // enabling of opus DTX in older SDKs. Newer SDKs will append "usedtx=1" by themselves
          // if the developer has requested opus DTX to be enabled. (JSDK-3063)
          if (_this12._shouldApplyDtx) {
            _this12._localDescription = new _this12._RTCSessionDescription({
              sdp: enableDtxForOpus(_this12._localDescription.sdp, []),
              type: _this12._localDescription.type
            });
          }

          _this12._localCandidates = [];
          if (description.type === 'offer') {
            _this12._descriptionRevision++;
          } else if (description.type === 'answer') {
            _this12._lastStableDescriptionRevision = _this12._descriptionRevision;
            negotiationCompleted(_this12);
          }
          _this12._localUfrag = getUfrag(description);
          _this12.emit('description', _this12.getState());
        }
      });
    }

    /**
     * Set a remote RTCSessionDescription on the {@link PeerConnectionV2}.
     * @private
     * @param {RTCSessionDescriptionInit} description
     * @returns {Promise<void>}
     */

  }, {
    key: '_setRemoteDescription',
    value: function _setRemoteDescription(description) {
      var _this13 = this;

      if (description.sdp) {
        if (!this._isRTCRtpSenderParamsSupported) {
          description.sdp = this._setBitrateParameters(description.sdp, isFirefox ? 'TIAS' : 'AS', this._encodingParameters.maxAudioBitrate, this._encodingParameters.maxVideoBitrate);
        }
        description.sdp = this._setCodecPreferences(description.sdp, this._preferredAudioCodecs, this._preferredVideoCodecs);

        if (this._shouldApplyDtx) {
          description.sdp = enableDtxForOpus(description.sdp);
        } else {
          // NOTE(mmalavalli): Remove "usedtx=1" from opus's fmtp line if present
          // since DTX is disabled.
          description.sdp = enableDtxForOpus(description.sdp, []);
        }

        // NOTE(mroberts): Do this to reduce our MediaStream count in Firefox. By
        // mapping MediaStream IDs in the SDP to "-", we ensure the "track" event
        // doesn't include any new MediaStreams in Firefox. Its `streams` member
        // will always be the empty Array.
        if (isFirefox) {
          description.sdp = filterOutMediaStreamIds(description.sdp);
        }
        if (!this._peerConnection.remoteDescription) {
          this._isIceLite = /a=ice-lite/.test(description.sdp);
        }
      }
      description = new this._RTCSessionDescription(description);
      // eslint-disable-next-line consistent-return
      return Promise.resolve().then(function () {
        // NOTE(syerrapragada): VMS does not support H264 simulcast. So,
        // unset simulcast for sections in local offer where corresponding
        // sections in answer doesn't have vp8 as preferred codec and reapply offer.
        if (description.type === 'answer' && _this13._shouldApplySimulcast) {
          var sdpWithoutSimulcastForNonVP8MediaSections = _this13._revertSimulcastForNonVP8MediaSections(_this13._localDescription.sdp, _this13._localDescriptionWithoutSimulcast.sdp, description.sdp);
          if (sdpWithoutSimulcastForNonVP8MediaSections !== _this13._localDescription.sdp) {
            return _this13._rollbackAndApplyOffer({
              type: _this13._localDescription.type,
              sdp: sdpWithoutSimulcastForNonVP8MediaSections
            });
          }
        }
      }).then(function () {
        return _this13._peerConnection.setRemoteDescription(description);
      }).then(function () {
        if (description.type === 'answer') {
          if (_this13._isRestartingIce) {
            _this13._log.debug('An ICE restart was in-progress and is now completed');
            _this13._isRestartingIce = false;
          }
          negotiationCompleted(_this13);
        }
      }, function (error) {
        _this13._log.warn('Calling setRemoteDescription with an RTCSessionDescription of type "' + description.type + '" failed with the error "' + error.message + '".');
        if (description.sdp) {
          _this13._log.warn('The SDP was ' + description.sdp);
        }
        throw error;
      });
    }

    /**
     * Update the {@link PeerConnectionV2}'s description.
     * @private
     * @param {RTCSessionDescriptionInit} description
     * @returns {Promise<void>}
     */

  }, {
    key: '_updateDescription',
    value: function _updateDescription(description) {
      var _this14 = this;

      switch (description.type) {
        case 'answer':
        case 'pranswer':
          if (description.revision !== this._descriptionRevision || this._peerConnection.signalingState !== 'have-local-offer') {
            return Promise.resolve();
          }
          this._descriptionRevision = description.revision;
          break;
        case 'close':
          return this._close();
        case 'create-offer':
          if (description.revision <= this._lastStableDescriptionRevision) {
            return Promise.resolve();
          } else if (this._needsAnswer) {
            this._queuedDescription = description;
            return Promise.resolve();
          }
          this._descriptionRevision = description.revision;
          return this._offer();
        case 'offer':
          if (description.revision <= this._lastStableDescriptionRevision || this._peerConnection.signalingState === 'closed') {
            return Promise.resolve();
          }
          if (this._peerConnection.signalingState === 'have-local-offer') {
            // NOTE(mpatwardhan): For a peer connection
            // 1) createOffer always generate SDP with `setup:actpass`
            // 2) when remote description is set `setup:active`  - the answer generated selects the dtls role of setup:passive
            // 3) when remote description is set `setup:passive` - the answer generated selects the dtls role of setup:active
            // 4) when remote description is set `setup:actpass` - the answer generated uses the previously negotiated role (if not negotiated previously setup:active is used)
            // This test shows the  behavior: https://github.com/twilio/twilio-webrtc.js/blob/master/test/integration/spec/rtcpeerconnection.js#L936
            // with glare handling (if dtls role was not negotiated before ) the generated answer will set setup:active.
            // we do not want that. lets wait for "initial negotiation" before attempting glare handling.
            if (this._needsAnswer && this._lastStableDescriptionRevision === 0) {
              this._queuedDescription = description;
              return Promise.resolve();
            }
            this._descriptionRevision = description.revision;
            return this._handleGlare(description);
          }
          this._descriptionRevision = description.revision;
          return this._answer(description).then(function () {});
        default:
        // Do nothing.
      }

      // Handle answer or pranswer.
      var revision = description.revision;
      return Promise.resolve().then(function () {
        return _this14._setRemoteDescription(description);
      }).catch(function () {
        throw new MediaClientRemoteDescFailedError();
      }).then(function () {
        _this14._lastStableDescriptionRevision = revision;
        _this14._needsAnswer = false;
        return _this14._checkIceBox(description);
      }).then(function () {
        return _this14._queuedDescription && _this14._updateDescription(_this14._queuedDescription);
      }).then(function () {
        _this14._queuedDescription = null;
        return _this14._maybeReoffer(_this14._peerConnection.localDescription).then(function () {});
      });
    }

    /**
     * Update the {@link PeerConnectionV2}'s ICE candidates.
     * @private
     * @param {object} iceState
     * @returns {Promise<void>}
     */

  }, {
    key: '_updateIce',
    value: function _updateIce(iceState) {
      var candidates = this._remoteCandidates.update(iceState);
      return this._addIceCandidates(candidates);
    }

    /**
     * Add a {@link DataTrackSender} to the {@link PeerConnectionV2}.
     * @param {DataTrackSender} dataTrackSender
     * @returns {void}
     */

  }, {
    key: 'addDataTrackSender',
    value: function addDataTrackSender(dataTrackSender) {
      if (this._dataChannels.has(dataTrackSender)) {
        return;
      }
      try {
        var dataChannelDict = {
          ordered: dataTrackSender.ordered
        };
        if (dataTrackSender.maxPacketLifeTime !== null) {
          dataChannelDict.maxPacketLifeTime = dataTrackSender.maxPacketLifeTime;
        }
        if (dataTrackSender.maxRetransmits !== null) {
          dataChannelDict.maxRetransmits = dataTrackSender.maxRetransmits;
        }
        var dataChannel = this._peerConnection.createDataChannel(dataTrackSender.id, dataChannelDict);
        dataTrackSender.addDataChannel(dataChannel);
        this._dataChannels.set(dataTrackSender, dataChannel);
      } catch (error) {
        this._log.warn('Error creating an RTCDataChannel for DataTrack "' + dataTrackSender.id + '": ' + error.message);
      }
    }

    /**
     * Add the {@link MediaTrackSender} to the {@link PeerConnectionV2}.
     * @param {MediaTrackSender} mediaTrackSender
     * @returns {void}
     */

  }, {
    key: 'addMediaTrackSender',
    value: function addMediaTrackSender(mediaTrackSender) {
      if (this._peerConnection.signalingState === 'closed' || this._rtpSenders.has(mediaTrackSender)) {
        return;
      }
      var sender = void 0;
      if (this._localMediaStream) {
        this._localMediaStream.addTrack(mediaTrackSender.track);
        sender = this._peerConnection.addTrack(mediaTrackSender.track, this._localMediaStream);
      } else {
        var transceiver = this._addOrUpdateTransceiver(mediaTrackSender.track);
        sender = transceiver.sender;
      }
      mediaTrackSender.addSender(sender);
      this._rtpSenders.set(mediaTrackSender, sender);
    }

    /**
     * Close the {@link PeerConnectionV2}.
     * @returns {void}
     */

  }, {
    key: 'close',
    value: function close() {
      if (this._close()) {
        this._descriptionRevision++;
        this._localDescription = { type: 'close' };
        this.emit('description', this.getState());
      }
    }

    /**
     * Get the {@link DataTrackReceiver}s and the {@link MediaTrackReceivers} on the
     * {@link PeerConnectionV2}.
     * @returns {Array<DataTrackReceiver|MediaTrackReceiver>} trackReceivers
     */

  }, {
    key: 'getTrackReceivers',
    value: function getTrackReceivers() {
      return Array.from(this._dataTrackReceivers).concat(Array.from(this._mediaTrackReceivers));
    }

    /**
     * Get the {@link PeerConnectionV2}'s state (specifically, its description).
     * @returns {?object}
     */

  }, {
    key: 'getState',
    value: function getState() {
      if (!this._localDescription) {
        return null;
      }

      // NOTE(mpatwardhan): Return most recent localDescription. If the most recent local description is an
      // answer, and this method is called for sending a "sync" message while the next remote offer is being processed,
      // we need to send the most recent stable description revision instead of the current description revision,
      // which is supposed to be for the next local answer.
      var localDescriptionRevision = this._localDescription.type === 'answer' ? this._lastStableDescriptionRevision : this._descriptionRevision;
      var localDescription = {
        type: this._localDescription.type,
        revision: localDescriptionRevision
      };
      if (this._localDescription.sdp) {
        localDescription.sdp = this._localDescription.sdp;
      }
      return {
        description: localDescription,
        id: this.id
      };
    }

    /**
     * Create an offer and set it on the {@link PeerConnectionV2}.
     * @returns {Promise<void>}
     */

  }, {
    key: 'offer',
    value: function offer() {
      var _this15 = this;

      if (this._needsAnswer || this._isRestartingIce) {
        this._shouldOffer = true;
        return Promise.resolve();
      }

      return this.bracket('offering', function (key) {
        _this15.transition('updating', key);
        var promise = _this15._needsAnswer || _this15._isRestartingIce ? Promise.resolve() : _this15._offer();
        return promise.then(function () {
          _this15.tryTransition('open', key);
        }, function (error) {
          _this15.tryTransition('open', key);
          throw error;
        });
      });
    }

    /**
     * Remove a {@link DataTrackSender} from the {@link PeerConnectionV2}.
     * @param {DataTrackSender} dataTrackSender
     * @returns {void}
     */

  }, {
    key: 'removeDataTrackSender',
    value: function removeDataTrackSender(dataTrackSender) {
      var dataChannel = this._dataChannels.get(dataTrackSender);
      if (dataChannel) {
        dataTrackSender.removeDataChannel(dataChannel);
        this._dataChannels.delete(dataTrackSender);
        dataChannel.close();
      }
    }

    /**
     * Remove the {@link MediaTrackSender} from the {@link PeerConnectionV2}.
     * @param {MediaTrackSender} mediaTrackSender
     * @returns {void}
     */

  }, {
    key: 'removeMediaTrackSender',
    value: function removeMediaTrackSender(mediaTrackSender) {
      if (this._peerConnection.signalingState === 'closed' || !this._rtpSenders.has(mediaTrackSender)) {
        return;
      }
      var sender = this._rtpSenders.get(mediaTrackSender);
      this._peerConnection.removeTrack(sender);
      if (this._localMediaStream) {
        this._localMediaStream.removeTrack(mediaTrackSender.track);
      }
      mediaTrackSender.removeSender(sender);
      this._rtpSenders.delete(mediaTrackSender);
    }

    /**
     * Set the RTCConfiguration on the underlying RTCPeerConnection.
     * @param {RTCConfiguration} configuration
     * @returns {void}
     */

  }, {
    key: 'setConfiguration',
    value: function setConfiguration(configuration) {
      if (typeof this._peerConnection.setConfiguration === 'function') {
        this._peerConnection.setConfiguration(getConfiguration(configuration));
      }
    }

    /**
     * Set the ICE reconnect timeout period.
     * @param {number} period - Period in milliseconds.
     * @returns {this}
     */

  }, {
    key: 'setIceReconnectTimeout',
    value: function setIceReconnectTimeout(period) {
      this._iceReconnectTimeout.setDelay(period);
      this._log.debug('Updated ICE reconnection timeout period:', this._iceReconnectTimeout.delay);
      return this;
    }

    /**
     * Update the {@link PeerConnectionV2}.
     * @param {object} peerConnectionState
     * @returns {Promise<void>}
     */

  }, {
    key: 'update',
    value: function update(peerConnectionState) {
      var _this16 = this;

      return this.bracket('updating', function (key) {
        if (_this16.state === 'closed') {
          return Promise.resolve();
        }

        _this16.transition('updating', key);

        var updates = [];

        if (peerConnectionState.ice) {
          updates.push(_this16._updateIce(peerConnectionState.ice));
        }

        if (peerConnectionState.description) {
          updates.push(_this16._updateDescription(peerConnectionState.description));
        }

        return Promise.all(updates).then(function () {
          _this16.tryTransition('open', key);
        }, function (error) {
          _this16.tryTransition('open', key);
          throw error;
        });
      });
    }

    /**
     * Get the {@link PeerConnectionV2}'s media statistics.
     * @returns {Promise<StandardizedStatsResponse>}
     */

  }, {
    key: 'getStats',
    value: function getStats() {
      var _this17 = this;

      return getStatistics(this._peerConnection).then(function (response) {
        return rewriteTrackIds(_this17, response);
      });
    }
  }, {
    key: 'connectionState',
    get: function get() {
      return this.iceConnectionState === 'failed' ? 'failed' : this._peerConnection.connectionState || this.iceConnectionState;
    }

    /**
     * The {@link PeerConnectionV2}'s underlying RTCPeerConnection's
     * RTCIceConnectionState.
     * @property {RTCIceConnectionState}
     */

  }, {
    key: 'iceConnectionState',
    get: function get() {
      return this._isIceConnectionInactive && this._peerConnection.iceConnectionState === 'disconnected' || this._iceGatheringFailed ? 'failed' : this._peerConnection.iceConnectionState;
    }

    /**
     * Whether the {@link PeerConnectionV2} has negotiated or is in the process
     * of negotiating the application m= section.
     * @returns {boolean}
     */

  }, {
    key: 'isApplicationSectionNegotiated',
    get: function get() {
      if (this._peerConnection.signalingState !== 'closed') {
        // accessing .localDescription in 'closed' state causes it throw exceptions.
        return this._peerConnection.localDescription ? getMediaSections(this._peerConnection.localDescription.sdp, 'application').length > 0 : false;
      }
      return true;
    }
  }]);

  return PeerConnectionV2;
}(StateMachine);

function rewriteLocalTrackId(pcv2, stats) {
  var trackId = pcv2._getMediaTrackSenderId(stats.trackId);
  return Object.assign(stats, { trackId: trackId });
}

function rewriteTrackId(pcv2, stats) {
  var receiver = [].concat(_toConsumableArray(pcv2._mediaTrackReceivers)).find(function (receiver) {
    return receiver.track.id === stats.trackId;
  });
  var trackId = receiver ? receiver.id : null;
  return Object.assign(stats, { trackId: trackId });
}

function rewriteTrackIds(pcv2, response) {
  return Object.assign(response, {
    remoteAudioTrackStats: response.remoteAudioTrackStats.map(function (stats) {
      return rewriteTrackId(pcv2, stats);
    }),
    remoteVideoTrackStats: response.remoteVideoTrackStats.map(function (stats) {
      return rewriteTrackId(pcv2, stats);
    }),
    localAudioTrackStats: response.localAudioTrackStats.map(function (stats) {
      return rewriteLocalTrackId(pcv2, stats);
    }),
    localVideoTrackStats: response.localVideoTrackStats.map(function (stats) {
      return rewriteLocalTrackId(pcv2, stats);
    })
  });
}

/**
 * @event PeerConnectionV2#candidates
 * @param {object} candidates
 */

/**
 * @event PeerConnectionV2#connectionStateChanged
 */

/**
 * @event PeerConnectionV2#description
 * @param {object} description
 */

/**
 * @event PeerConnectionV2#iceConnectionStateChanged
 */

/**
 * @event PeerConnectionV2#trackAdded
 * @param {DataTrackReceiver|MediaTrackReceiver} trackReceiver
 */

function getUfrag(description) {
  if (description.sdp) {
    var match = description.sdp.match(/^a=ice-ufrag:([a-zA-Z0-9+/]+)/m);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function getConfiguration(configuration) {
  return Object.assign({
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  }, configuration);
}

/**
 * Whether the MediaStreamTrack of the given RTCRTPSender is a non-ended
 * MediaStreamTrack of a given kind.
 * @private
 * @param {string} kind
 * @param {RTCRtpSender} sender
 * @return {boolean}
 */
function isSenderOfKind(kind, sender) {
  var track = sender.track;
  return track && track.kind === kind && track.readyState !== 'ended';
}

/**
 * Preferred codecs.
 * @typedef {object} PreferredCodecs
 * @property {Array<AudioCodec>} audio
 * @property {Array<VideoCodec>} video
 */

function filterOutMediaStreamIds(sdp) {
  return sdp.replace(/a=msid:[^ ]+ /g, 'a=msid:- ');
}

/**
 * Whether an RTCRtpTransceiver can be recycled.
 * @param {RTCRtpTransceiver} transceiver
 * @returns {boolean}
 */
function shouldRecycleTransceiver(transceiver, pcv2) {
  return !transceiver.stopped && !pcv2._replaceTrackPromises.has(transceiver) && ['inactive', 'recvonly'].includes(transceiver.direction);
}

/**
 * Take a recycled RTCRtpTransceiver if available.
 * @param {PeerConnectionV2} pcv2
 * @param {Track.Kind} kind
 * @returns {?RTCRtpTransceiver}
 */
function takeRecycledTransceiver(pcv2, kind) {
  var preferredCodecs = {
    audio: pcv2._preferredAudioCodecs.map(function (_ref10) {
      var codec = _ref10.codec;
      return codec.toLowerCase();
    }),
    video: pcv2._preferredVideoCodecs.map(function (_ref11) {
      var codec = _ref11.codec;
      return codec.toLowerCase();
    })
  }[kind];

  var recycledTransceivers = pcv2._recycledTransceivers[kind];
  var localCodec = preferredCodecs.find(function (codec) {
    return pcv2._localCodecs.has(codec);
  });
  if (!localCodec) {
    return recycledTransceivers.shift();
  }

  var transceiver = recycledTransceivers.find(function (transceiver) {
    var remoteCodecMap = pcv2._remoteCodecMaps.get(transceiver.mid);
    return remoteCodecMap && remoteCodecMap.has(localCodec);
  });

  if (transceiver) {
    recycledTransceivers.splice(recycledTransceivers.indexOf(transceiver), 1);
  }
  return transceiver;
}

/**
 * Update the set of locally supported {@link Codec}s.
 * @param pcv2
 * @returns {void}
 */
function updateLocalCodecs(pcv2) {
  var description = pcv2._peerConnection.localDescription;
  if (!description) {
    return;
  }
  getMediaSections(description.sdp).forEach(function (section) {
    var codecMap = createCodecMapForMediaSection(section);
    codecMap.forEach(function (pts, codec) {
      return pcv2._localCodecs.add(codec);
    });
  });
}

/**
 * Update the {@link Codec} maps for all m= sections in the remote {@link RTCSessionDescription}s.
 * @param {PeerConnectionV2} pcv2
 * @returns {void}
 */
function updateRemoteCodecMaps(pcv2) {
  var description = pcv2._peerConnection.remoteDescription;
  if (!description) {
    return;
  }
  getMediaSections(description.sdp).forEach(function (section) {
    var mid = section.match(/^a=mid:(.+)$/m)[1];
    var codecMap = createCodecMapForMediaSection(section);
    pcv2._remoteCodecMaps.set(mid, codecMap);
  });
}

/**
 * Update the list of recycled RTCRtpTransceivers.
 * @param {PeerConnectionV2} pcv2
 */
function updateRecycledTransceivers(pcv2) {
  pcv2._recycledTransceivers.audio = [];
  pcv2._recycledTransceivers.video = [];
  pcv2._peerConnection.getTransceivers().forEach(function (transceiver) {
    if (shouldRecycleTransceiver(transceiver, pcv2)) {
      var track = transceiver.receiver.track;
      pcv2._recycledTransceivers[track.kind].push(transceiver);
    }
  });
}

/**
 * Perform certain updates after an SDP negotiation is completed.
 * @param {PeerConnectionV2} pcv2
 * @returns {void}
 */
function negotiationCompleted(pcv2) {
  if (pcv2._isUnifiedPlan) {
    updateRecycledTransceivers(pcv2);
    updateLocalCodecs(pcv2);
    updateRemoteCodecMaps(pcv2);
  }
  if (pcv2._isRTCRtpSenderParamsSupported) {
    updateEncodingParameters(pcv2);
  }
}

/**
 * Update the RTCRtpEncodingParameters of all active RTCRtpSenders.
 * @param {PeerConnectionV2} pcv2
 * @returns {void}
 */
function updateEncodingParameters(pcv2) {
  var _pcv2$_encodingParame = pcv2._encodingParameters,
      maxAudioBitrate = _pcv2$_encodingParame.maxAudioBitrate,
      maxVideoBitrate = _pcv2$_encodingParame.maxVideoBitrate;


  var maxBitrates = new Map([['audio', maxAudioBitrate], ['video', maxVideoBitrate]]);

  pcv2._peerConnection.getSenders().filter(function (sender) {
    return sender.track;
  }).forEach(function (sender) {
    var maxBitrate = maxBitrates.get(sender.track.kind);
    var params = sender.getParameters();

    if (maxBitrate === null || maxBitrate === 0) {
      removeMaxBitrate(params);
    } else if (pcv2._isChromeScreenShareTrack(sender.track)) {
      // NOTE(mpatwardhan): Sometimes (JSDK-2557) chrome does not send any bytes on screen track if MaxBitRate is set on it via setParameters,
      // To workaround this issue we will not apply maxBitrate if the track appears to be a screen share track created by chrome
      pcv2._log.warn('Not setting maxBitrate for ' + sender.track.kind + ' Track ' + sender.track.id + ' because it appears to be screen share track: ' + sender.track.label);
    } else {
      setMaxBitrate(params, maxBitrate);
    }

    if (!isFirefox && pcv2._enableDscp && params.encodings.length > 0) {
      // NOTE(mmalavalli): "networkPriority" is a per-sender property and not
      // a per-encoding-layer property. So, we set the value only on the first
      // encoding layer. Any attempt to set the value on subsequent encoding
      // layers (in the case of simulcast) will result in the Promise returned
      // by RTCRtpSender.setParameters() being rejected.
      params.encodings[0].networkPriority = 'high';
    }

    sender.setParameters(params).catch(function (error) {
      pcv2._log.warn('Error while setting encodings parameters for ' + sender.track.kind + ' Track ' + sender.track.id + ': ' + (error.message || error.name));
    });
  });
}

/**
 * Remove maxBitrate from the RTCRtpSendParameters' encodings.
 * @param {RTCRtpSendParameters} params
 * @returns {void}
 */
function removeMaxBitrate(params) {
  if (Array.isArray(params.encodings)) {
    params.encodings.forEach(function (encoding) {
      return delete encoding.maxBitrate;
    });
  }
}

/**
 * Set the given maxBitrate in the RTCRtpSendParameters' encodings.
 * @param {RTCRtpSendParameters} params
 * @param {number} maxBitrate
 * @returns {void}
 */
function setMaxBitrate(params, maxBitrate) {
  if (isFirefox) {
    params.encodings = [{ maxBitrate: maxBitrate }];
  } else {
    params.encodings.forEach(function (encoding) {
      encoding.maxBitrate = maxBitrate;
    });
  }
}
module.exports = PeerConnectionV2;