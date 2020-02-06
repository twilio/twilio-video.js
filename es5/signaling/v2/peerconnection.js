'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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
    DEFAULT_LOG_LEVEL = _require4.DEFAULT_LOG_LEVEL;

var _require5 = require('../../util/sdp'),
    createCodecMapForMediaSection = _require5.createCodecMapForMediaSection,
    getMediaSections = _require5.getMediaSections,
    setBitrateParameters = _require5.setBitrateParameters,
    setCodecPreferences = _require5.setCodecPreferences,
    setSimulcast = _require5.setSimulcast,
    unifiedPlanAddOrRewriteNewTrackIds = _require5.unifiedPlanAddOrRewriteNewTrackIds,
    unifiedPlanAddOrRewriteTrackIds = _require5.unifiedPlanAddOrRewriteTrackIds,
    unifiedPlanFilterLocalCodecs = _require5.unifiedPlanFilterLocalCodecs;

var _require6 = require('../../util/twilio-video-errors'),
    MediaClientLocalDescFailedError = _require6.MediaClientLocalDescFailedError,
    MediaClientRemoteDescFailedError = _require6.MediaClientRemoteDescFailedError;

var _require7 = require('../../util'),
    buildLogLevels = _require7.buildLogLevels,
    makeUUID = _require7.makeUUID,
    oncePerTick = _require7.oncePerTick;

var IceBox = require('./icebox');
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
var sdpFormat = getSdpFormat();
var isUnifiedPlan = sdpFormat === 'unified';

var firefoxMajorVersion = isFirefox ? parseInt(navigator.userAgent.match(/Firefox\/(\d+)/)[1], 10) : null;

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
      dscpTagging: false,
      dummyAudioMediaStreamTrack: null,
      iceServers: [],
      isRTCRtpSenderParamsSupported: isRTCRtpSenderParamsSupported,
      logLevel: DEFAULT_LOG_LEVEL,
      offerOptions: {},
      setBitrateParameters: setBitrateParameters,
      setCodecPreferences: setCodecPreferences,
      setSimulcast: setSimulcast,
      MediaStream: DefaultMediaStream,
      RTCIceCandidate: DefaultRTCIceCandidate,
      RTCPeerConnection: DefaultRTCPeerConnection,
      RTCSessionDescription: DefaultRTCSessionDescription
    }, options);

    var configuration = getConfiguration(options);
    var logLevels = buildLogLevels(options.logLevel);
    var RTCPeerConnection = options.RTCPeerConnection;

    if (options.dscpTagging === true) {
      options.chromeSpecificConstraints = options.chromeSpecificConstraints || {};
      options.chromeSpecificConstraints.optional = options.chromeSpecificConstraints.optional || [];
      options.chromeSpecificConstraints.optional.push({ googDscp: true });
    }

    var peerConnection = new RTCPeerConnection(configuration, options.chromeSpecificConstraints);

    var localMediaStream = isUnifiedPlan && RTCPeerConnection.prototype.addTransceiver ? null : new options.MediaStream();

    if (options.dummyAudioMediaStreamTrack) {
      peerConnection.addTrack(options.dummyAudioMediaStreamTrack, localMediaStream || new options.MediaStream());
    }

    // NOTE(mroberts): We do this to workaround the following bug:
    //
    //   https://bugzilla.mozilla.org/show_bug.cgi?id=1481335
    //
    if (isFirefox && firefoxMajorVersion < 65) {
      peerConnection.createDataChannel(makeUUID());
    }

    Object.defineProperties(_this, {
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
      _dscpTagging: {
        value: options.dscpTagging
      },
      _encodingParameters: {
        value: encodingParameters
      },
      _instanceId: {
        value: ++nInstances
      },
      _isRestartingIce: {
        writable: true,
        value: false
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
        value: options.log ? options.log.createLog('signaling', _this) : new Log('webrtc', _this, logLevels)
      },
      _remoteCodecMaps: {
        value: new Map()
      },
      _rtpSenders: {
        value: new Map()
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
      _peerConnection: {
        value: peerConnection
      },
      _preferredAudioCodecs: {
        value: preferredCodecs.audio
      },
      _preferredVideoCodecs: {
        value: preferredCodecs.video
      },
      _queuedDescription: {
        writable: true,
        value: null
      },
      _recycledTransceivers: {
        value: {
          audio: [],
          video: []
        }
      },
      _replaceTrackPromises: {
        value: []
      },
      _remoteCandidates: {
        writable: true,
        value: new IceBox()
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
        value: new Map()
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

    encodingParameters.on('changed', oncePerTick(function () {
      if (_this._isRTCRtpSenderParamsSupported) {
        if (!_this._needsAnswer) {
          updateEncodingParameters(_this);
        }
        return;
      }
      _this.offer();
    }));

    peerConnection.addEventListener('datachannel', _this._handleDataChannelEvent.bind(_this));
    peerConnection.addEventListener('icecandidate', _this._handleIceCandidateEvent.bind(_this));
    peerConnection.addEventListener('iceconnectionstatechange', _this._handleIceConnectionStateChange.bind(_this));
    peerConnection.addEventListener('track', _this._handleTrackEvent.bind(_this));

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
     * The {@link PeerConnectionV2}'s underlying RTCPeerConnection's
     * RTCIceConnectionState.
     * @property {RTCIceConnectionState}
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
      var transceiver = takeRecycledTransceiver(this, track.kind);
      if (transceiver && transceiver.sender) {
        this._replaceTrackPromises.push(transceiver.sender.replaceTrack(track).then(function () {
          transceiver.direction = 'sendrecv';
        }, function () {
          // Do nothing.
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
      var _this3 = this;

      return Promise.resolve().then(function () {
        if (!_this3._negotiationRole) {
          _this3._negotiationRole = 'answerer';
        }
        return _this3._setRemoteDescription(offer);
      }).catch(function () {
        throw new MediaClientRemoteDescFailedError();
      }).then(function () {
        return _this3._peerConnection.createAnswer();
      }).then(function (answer) {
        if (!isFirefox) {
          answer = workaroundIssue8329(answer);
        }
        return _this3._setLocalDescription(answer);
      }).then(function () {
        return _this3._checkIceBox(offer);
      }).then(function () {
        return _this3._queuedDescription && _this3._updateDescription(_this3._queuedDescription);
      }).then(function () {
        _this3._queuedDescription = null;
        return _this3._maybeReoffer(_this3._peerConnection.localDescription);
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
      if (this._peerConnection.signalingState !== 'closed') {
        this._peerConnection.close();
        this.preempt('closed');
        return true;
      }
      return false;
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
      var _this4 = this;

      var dataChannel = event.channel;
      var dataTrackReceiver = new DataTrackReceiver(dataChannel);
      this._dataTrackReceivers.add(dataTrackReceiver);

      dataChannel.addEventListener('close', function () {
        _this4._dataTrackReceivers.delete(dataTrackReceiver);
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
      var _this5 = this;

      this._log.debug('Glare detected; rolling back');
      if (this._isRestartingIce) {
        this._log.debug('An ICE restart was in progress; we\'ll need to restart ICE again after rolling back');
        this._isRestartingIce = false;
        this._shouldRestartIce = true;
      }
      return Promise.resolve().then(function () {
        return _this5._setLocalDescription({ type: 'rollback' });
      }).then(function () {
        _this5._needsAnswer = false;
        return _this5._answer(offer);
      }).then(function (didReoffer) {
        return didReoffer ? Promise.resolve() : _this5._offer();
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
        this._localCandidates.push(event.candidate);
      }
      var peerConnectionState = {
        ice: {
          candidates: this._localCandidates.slice(),
          revision: this._localCandidatesRevision++,
          ufrag: this._localUfrag
        },
        id: this.id
      };
      if (!event.candidate) {
        peerConnectionState.ice.complete = true;
      }
      this.emit('candidates', peerConnectionState);
    }

    /**
     * Handle an ICE connection state change event.
     * @private
     * @returns {void}
     */

  }, {
    key: '_handleIceConnectionStateChange',
    value: function _handleIceConnectionStateChange() {
      var iceConnectionState = this._peerConnection.iceConnectionState;


      this._log.debug('ICE connection state is "' + iceConnectionState + '"');

      // Case 1: Transition to "failed".
      if (this._lastIceConnectionState !== 'failed' && iceConnectionState === 'failed' && !this._shouldRestartIce && !this._isRestartingIce) {
        this._log.warn('ICE failed; attempting to restart ICE');
        this._shouldRestartIce = true;
        this.offer();
      }

      // Case 2: Transition from "failed".
      else if (this._lastIceConnectionState === 'failed' && (iceConnectionState === 'connected' || iceConnectionState === 'completed')) {
          this._log.info('ICE reconnected');
        }

      this._lastIceConnectionState = iceConnectionState;
      this.emit('iceConnectionStateChanged');
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
      var _this6 = this;

      var sdp = this._peerConnection.remoteDescription ? this._peerConnection.remoteDescription.sdp : null;

      if (!this._trackMatcher) {
        this._trackMatcher = event.transceiver && event.transceiver.mid ? new MIDTrackMatcher()
        // NOTE(mroberts): Until Chrome ships RTCRtpTransceivers with MID
        // support, we have to use the same hacky solution as Safari. Revisit
        // this when RTCRtpTransceivers and MIDs land. We should be able to use
        // the same technique as Firefox.
        : isSafari || isUnifiedPlan ? new OrderedTrackMatcher() : new IdentityTrackMatcher();
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
          _this6._mediaTrackReceivers.delete(trackReceiver);
        }
      });

      this._mediaTrackReceivers.add(mediaTrackReceiver);
      mediaStreamTrack.addEventListener('ended', function () {
        return _this6._mediaTrackReceivers.delete(mediaTrackReceiver);
      });
      this.emit('trackAdded', mediaTrackReceiver);
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
        // NOTE(mmalavalli): For "unified-plan" sdps, if the remote RTCPeerConnection sends
        // an offer with fewer audio m= lines than the number of audio RTCRTPSenders
        // in the local RTCPeerConnection, then the local RTCPeerConnection creates
        // an answer with the same number of audio m= lines as in the offer. This
        // behavior was triggered by the removal of 'offerToReceiveAudio' from the
        // default RTCOfferOptions. Ideally, the local RTCPeerConnection should create
        // an answer with the same number of audio m= lines as the number of
        // RTCRTPSenders. In order to achieve this,the local RTCPeerConnection
        // initiates renegotiation.
        //
        // We can reduce the number of cases where renegotiation is needed by
        // re-introducing 'offerToReceiveAudio' to the default RTCOfferOptions with a
        // value > 1.
        if (isUnifiedPlan && localDescription.type === 'answer') {
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
      var _this7 = this;

      var offerOptions = Object.assign({}, this._offerOptions);
      this._needsAnswer = true;
      if (this._shouldRestartIce) {
        this._shouldRestartIce = false;
        this._isRestartingIce = true;
        offerOptions.iceRestart = true;
      }
      return Promise.all(this._replaceTrackPromises.splice(0)).then(function () {
        return _this7._peerConnection.createOffer(offerOptions);
      }).catch(function () {
        throw new MediaClientLocalDescFailedError();
      }).then(function (offer) {
        if (!isFirefox) {
          offer = workaroundIssue8329(offer);
        }

        var sdp = isUnifiedPlan && _this7._peerConnection.remoteDescription ? unifiedPlanFilterLocalCodecs(offer.sdp, _this7._peerConnection.remoteDescription.sdp) : offer.sdp;

        var updatedSdp = _this7._setCodecPreferences(sdp, _this7._preferredAudioCodecs, _this7._preferredVideoCodecs);

        _this7._shouldOffer = false;
        if (!_this7._negotiationRole) {
          _this7._negotiationRole = 'offerer';
        }
        return _this7._setLocalDescription({
          type: 'offer',
          sdp: updatedSdp
        });
      });
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
      var transceivers = this._peerConnection.getTransceivers();
      var activeTransceivers = transceivers.filter(function (_ref) {
        var sender = _ref.sender,
            stopped = _ref.stopped;
        return !stopped && sender && sender.track;
      });

      // NOTE(mmalavalli): There is no guarantee that MediaStreamTrack IDs will be present in
      // SDPs, and even if they are, there is no guarantee that they will be the same as the
      // actual MediaStreamTrack IDs. So, we add or re-write the actual MediaStreamTrack IDs
      // to the assigned m= sections here.
      var assignedTransceivers = activeTransceivers.filter(function (_ref2) {
        var mid = _ref2.mid;
        return mid;
      });
      var midsToTrackIds = new Map(assignedTransceivers.map(function (_ref3) {
        var mid = _ref3.mid,
            sender = _ref3.sender;
        return [mid, sender.track.id];
      }));
      var sdp1 = unifiedPlanAddOrRewriteTrackIds(description.sdp, midsToTrackIds);

      // NOTE(mmalavalli): Chrome and Safari do not apply the offer until they get an answer.
      // So, we add or re-write the actual MediaStreamTrack IDs to the unassigned m= sections here.
      var unassignedTransceivers = activeTransceivers.filter(function (_ref4) {
        var mid = _ref4.mid;
        return !mid;
      });
      var newTrackIdsByKind = new Map(['audio', 'video'].map(function (kind) {
        return [kind, unassignedTransceivers.filter(function (_ref5) {
          var sender = _ref5.sender;
          return sender.track.kind === kind;
        }).map(function (_ref6) {
          var sender = _ref6.sender;
          return sender.track.id;
        })];
      }));
      var sdp2 = unifiedPlanAddOrRewriteNewTrackIds(sdp1, midsToTrackIds, newTrackIdsByKind);

      return new this._RTCSessionDescription({
        sdp: sdp2,
        type: description.type
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
      var _this8 = this;

      var vp8SimulcastRequested = this._preferredVideoCodecs.some(function (codecSettings) {
        return codecSettings.codec.toLowerCase() === 'vp8' && codecSettings.simulcast;
      });

      return Promise.resolve().then(function () {
        if (description.sdp) {
          // NOTE(mmalavalli): We do not directly modify "description.sdp" here as
          // "description" might be an RTCSessionDescription, in which case its
          // properties are immutable.
          description = {
            type: description.type,
            sdp: (isChrome || isSafari) && vp8SimulcastRequested ? _this8._setSimulcast(description.sdp, sdpFormat, _this8._trackIdsToAttributes) : description.sdp
          };
        }
        description = new _this8._RTCSessionDescription(description);
        return _this8._peerConnection.setLocalDescription(description);
      }).catch(function (error) {
        _this8._log.warn('Calling setLocalDescription with an RTCSessionDescription of type "' + description.type + '" failed with the error "' + error.message + '".');
        if (description.sdp) {
          _this8._log.warn('The SDP was ' + description.sdp);
        }
        throw new MediaClientLocalDescFailedError();
      }).then(function () {
        if (description.type !== 'rollback') {
          _this8._localDescription = isUnifiedPlan ? _this8._addOrRewriteLocalTrackIds(description) : description;
          _this8._localCandidates = [];
          if (description.type === 'offer') {
            _this8._descriptionRevision++;
          } else if (description.type === 'answer') {
            _this8._lastStableDescriptionRevision = _this8._descriptionRevision;
            negotiationCompleted(_this8);
          }
          _this8._localUfrag = getUfrag(description);
          _this8.emit('description', _this8.getState());
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
      var _this9 = this;

      if (description.sdp) {
        if (!this._isRTCRtpSenderParamsSupported) {
          description.sdp = this._setBitrateParameters(description.sdp, isFirefox ? 'TIAS' : 'AS', this._encodingParameters.maxAudioBitrate, this._encodingParameters.maxVideoBitrate);
        }
        description.sdp = this._setCodecPreferences(description.sdp, this._preferredAudioCodecs, this._preferredVideoCodecs);
        // NOTE(mroberts): Do this to reduce our MediaStream count in Firefox. By
        // mapping MediaStream IDs in the SDP to "-", we ensure the "track" event
        // doesn't include any new MediaStreams in Firefox. Its `streams` member
        // will always be the empty Array.
        if (isFirefox) {
          description.sdp = filterOutMediaStreamIds(description.sdp);
        }
      }
      description = new this._RTCSessionDescription(description);
      return this._peerConnection.setRemoteDescription(description).then(function () {
        if (description.type === 'answer') {
          if (_this9._isRestartingIce) {
            _this9._log.debug('An ICE restart was in-progress and is now completed');
            _this9._isRestartingIce = false;
          }
          negotiationCompleted(_this9);
        }
      }, function (error) {
        _this9._log.warn('Calling setRemoteDescription with an RTCSessionDescription of type "' + description.type + '" failed with the error "' + error.message + '".');
        if (description.sdp) {
          _this9._log.warn('The SDP was ' + description.sdp);
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
      var _this10 = this;

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
            if (this._needsAnswer && this._descriptionRevision === 1) {
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
        return _this10._setRemoteDescription(description);
      }).catch(function () {
        throw new MediaClientRemoteDescFailedError();
      }).then(function () {
        _this10._lastStableDescriptionRevision = revision;
        _this10._needsAnswer = false;
        return _this10._checkIceBox(description);
      }).then(function () {
        return _this10._queuedDescription && _this10._updateDescription(_this10._queuedDescription);
      }).then(function () {
        _this10._queuedDescription = null;
        return _this10._maybeReoffer(_this10._peerConnection.localDescription).then(function () {});
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
        // Do nothing.
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
      var localDescription = {
        type: this._localDescription.type,
        revision: this._descriptionRevision
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
      var _this11 = this;

      if (this._needsAnswer || this._isRestartingIce) {
        this._shouldOffer = true;
        return Promise.resolve();
      }

      return this.bracket('offering', function (key) {
        _this11.transition('updating', key);
        var promise = _this11._needsAnswer || _this11._isRestartingIce ? Promise.resolve() : _this11._offer();
        return promise.then(function () {
          _this11.tryTransition('open', key);
        }, function (error) {
          _this11.tryTransition('open', key);
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
     * Update the {@link PeerConnectionV2}.
     * @param {object} peerConnectionState
     * @returns {Promise<void>}
     */

  }, {
    key: 'update',
    value: function update(peerConnectionState) {
      var _this12 = this;

      return this.bracket('updating', function (key) {
        if (_this12.state === 'closed') {
          return Promise.resolve();
        }

        _this12.transition('updating', key);

        var updates = [];

        if (peerConnectionState.ice) {
          updates.push(_this12._updateIce(peerConnectionState.ice));
        }

        if (peerConnectionState.description) {
          updates.push(_this12._updateDescription(peerConnectionState.description));
        }

        return Promise.all(updates).then(function () {
          _this12.tryTransition('open', key);
        }, function (error) {
          _this12.tryTransition('open', key);
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
      var _this13 = this;

      return getStatistics(this._peerConnection).then(function (response) {
        return rewriteTrackIds(_this13, response);
      });
    }
  }, {
    key: 'iceConnectionState',
    get: function get() {
      return this._peerConnection.iceConnectionState;
    }
  }]);

  return PeerConnectionV2;
}(StateMachine);

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
    })
  });
}

/**
 * @event PeerConnectionV2#candidates
 * @param {object} candidates
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
 * @param {RTCRTPSender} sender
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
function shouldRecycleTransceiver(transceiver) {
  return !transceiver.stopped && (transceiver.currentDirection === 'inactive' || transceiver.currentDirection === 'recvonly' || transceiver.direction === 'recvonly');
}

/**
 * Take a recycled RTCRtpTransceiver if available.
 * @param {PeerConnectionV2} pcv2
 * @param {Track.Kind} kind
 * @returns {?RTCRtpTransceiver}
 */
function takeRecycledTransceiver(pcv2, kind) {
  var preferredCodecs = {
    audio: pcv2._preferredAudioCodecs.map(function (codec) {
      return codec.toLowerCase();
    }),
    video: pcv2._preferredVideoCodecs.map(function (_ref7) {
      var codec = _ref7.codec;
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
    if (shouldRecycleTransceiver(transceiver)) {
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
  if (isUnifiedPlan) {
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


  var maxBitrates = new Map([['audio', maxAudioBitrate || 0], ['video', maxVideoBitrate || 0]]);

  pcv2._peerConnection.getSenders().filter(function (sender) {
    return sender.track;
  }).forEach(function (sender) {
    var maxBitrate = maxBitrates.get(sender.track.kind);
    var params = sender.getParameters();

    if (maxBitrate === null || maxBitrate === 0) {
      removeMaxBitrate(params);
    } else {
      setMaxBitrate(params, maxBitrate);
    }

    if (!isFirefox && pcv2._dscpTagging && params.encodings.length > 0) {
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