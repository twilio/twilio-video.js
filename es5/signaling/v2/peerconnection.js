'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var WebRTC = require('@twilio/webrtc');
var DefaultMediaStream = WebRTC.MediaStream;
var DefaultRTCIceCandidate = WebRTC.RTCIceCandidate;
var DefaultRTCPeerConnection = WebRTC.RTCPeerConnection;
var DefaultRTCSessionDescription = WebRTC.RTCSessionDescription;
var getStatistics = WebRTC.getStats;
var getMediaSections = require('../../util/sdp').getMediaSections;
var guessBrowser = require('../../util').guessBrowser;
var oncePerTick = require('../../util').oncePerTick;
var setBitrateParameters = require('../../util/sdp').setBitrateParameters;
var setCodecPreferences = require('../../util/sdp').setCodecPreferences;
var setSimulcast = require('../../util/sdp').setSimulcast;
var IceBox = require('./icebox');
var MediaClientLocalDescFailedError = require('../../util/twilio-video-errors').MediaClientLocalDescFailedError;
var MediaClientRemoteDescFailedError = require('../../util/twilio-video-errors').MediaClientRemoteDescFailedError;
var DataTrackReceiver = require('../../data/receiver');
var MediaTrackReceiver = require('../../media/track/receiver');
var StateMachine = require('../../statemachine');

var _require = require('../../util'),
    buildLogLevels = _require.buildLogLevels,
    getSdpFormat = _require.getSdpFormat,
    makeUUID = _require.makeUUID;

var _require2 = require('../../util/constants'),
    DEFAULT_LOG_LEVEL = _require2.DEFAULT_LOG_LEVEL;

var Log = require('../../util/log');
var IdentityTrackMatcher = require('../../util/sdp/trackmatcher/identity');
var OrderedTrackMatcher = require('../../util/sdp/trackmatcher/ordered');
var MIDTrackMatcher = require('../../util/sdp/trackmatcher/mid');
var workaroundIssue8329 = require('../../util/sdp/issue8329');

var isChrome = guessBrowser() === 'chrome';
var isFirefox = guessBrowser() === 'firefox';
var isSafari = guessBrowser() === 'safari';

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
      dummyAudioMediaStreamTrack: null,
      iceServers: [],
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
    var peerConnection = new RTCPeerConnection(configuration, options.chromeSpecificConstraints);
    var sdpFormat = getSdpFormat(options.sdpSemantics);
    var isUnifiedPlan = sdpFormat === 'unified';

    var localMediaStream = isUnifiedPlan && RTCPeerConnection.prototype.addTransceiver ? null : new options.MediaStream();

    if (options.dummyAudioMediaStreamTrack) {
      peerConnection.addTrack(options.dummyAudioMediaStreamTrack, localMediaStream || new options.MediaStream());
    }

    // NOTE(mroberts): We do this to workaround the following bug:
    //
    //   https://bugzilla.mozilla.org/show_bug.cgi?id=1481335
    //
    if (isFirefox) {
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
      _encodingParameters: {
        value: encodingParameters
      },
      _isRestartingIce: {
        writable: true,
        value: false
      },
      _isUnifiedPlan: {
        value: isUnifiedPlan
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
      _rtpSenders: {
        value: new Map()
      },
      _mediaTrackReceivers: {
        value: new Set()
      },
      _needsInitialAnswer: {
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

    encodingParameters.on('changed', oncePerTick(_this.offer.bind(_this)));
    peerConnection.addEventListener('datachannel', _this._handleDataChannelEvent.bind(_this));
    peerConnection.addEventListener('icecandidate', _this._handleIceCandidateEvent.bind(_this));
    peerConnection.addEventListener('iceconnectionstatechange', _this._handleIceConnectionStateChange.bind(_this));
    peerConnection.addEventListener('signalingstatechange', _this._handleSignalingStateChange.bind(_this));
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

  /**
   * The {@link PeerConnectionV2}'s underlying RTCPeerConnection's
   * RTCIceConnectionState.
   * @property {RTCIceConnectionState}
   */


  _createClass(PeerConnectionV2, [{
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
     * @returns {Promise<void>}
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
        return _this3._peerConnection.localDescription ? _this3._maybeReoffer(_this3._peerConnection.localDescription) : Promise.resolve();
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
        return _this5._answer(offer);
      }).then(function () {
        return _this5._offer();
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
     * Handle a signaling state change event.
     * @private
     * @param {Event}
     * @returns {void}
     */

  }, {
    key: '_handleSignalingStateChange',
    value: function _handleSignalingStateChange() {
      if (this._peerConnection.signalingState === 'closed' && this.state !== 'closed') {
        this.preempt('closed');
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
      var _this6 = this;

      var sdp = this._peerConnection.remoteDescription ? this._peerConnection.remoteDescription.sdp : null;

      if (!this._trackMatcher) {
        this._trackMatcher = event.transceiver && event.transceiver.mid ? new MIDTrackMatcher()
        // NOTE(mroberts): Until Chrome ships RTCRtpTransceivers with MID
        // support, we have to use the same hacky solution as Safari. Revisit
        // this when RTCRtpTransceivers and MIDs land. We should be able to use
        // the same technique as Firefox.
        : isSafari || this._isUnifiedPlan ? new OrderedTrackMatcher() : new IdentityTrackMatcher();
      }

      // NOTE(mmalavalli): For unified plan sdps, calling addTransceiver with
      // the same MediaStreamTrack a second time will generate sdps where the
      // MediaStreamTrack ID does not match the MSID in the corresponding
      // m= section. Due to this, MIDTrackMatcher#update will not update the
      // mid corresponding to the MediaStreamTrack ID. Therefore, "trackSubscribed"
      // will not be fired for the corresponding RemoteTrack.
      //
      // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=894231
      // Firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1498036
      //
      // TODO(mmalavalli): Revisit this either when the bugs are fixed or when we
      // get clarification about spec-compliant behavior of addTransceiver.
      //
      this._trackMatcher.update(sdp);

      var mediaStreamTrack = event.track;
      var signaledTrackId = this._trackMatcher.match(event) || mediaStreamTrack.id;
      var mediaTrackReceiver = new MediaTrackReceiver(signaledTrackId, mediaStreamTrack);
      this._mediaTrackReceivers.add(mediaTrackReceiver);

      mediaStreamTrack.addEventListener('ended', function () {
        _this6._mediaTrackReceivers.delete(mediaTrackReceiver);
      });

      this.emit('trackAdded', mediaTrackReceiver);
    }

    /**
     * Conditionally re-offer.
     * @private
     * @param {RTCSessionDescriptionInit} localDescription
     * @returns {Promise<void>}
     */

  }, {
    key: '_maybeReoffer',
    value: function _maybeReoffer(localDescription) {
      var shouldReoffer = this._shouldOffer;

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

      return shouldReoffer ? this._offer() : Promise.resolve();
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
      if (this._shouldRestartIce) {
        this._shouldRestartIce = false;
        this._isRestartingIce = true;
        offerOptions.iceRestart = true;
      }
      return Promise.resolve().then(function () {
        return _this7._peerConnection.createOffer(offerOptions);
      }).catch(function () {
        throw new MediaClientLocalDescFailedError();
      }).then(function (offer) {
        if (!isFirefox) {
          offer = workaroundIssue8329(offer);
        }

        var updatedSdp = _this7._setCodecPreferences(offer.sdp, _this7._preferredAudioCodecs, _this7._preferredVideoCodecs);

        _this7._shouldOffer = false;
        if (!_this7._negotiationRole) {
          _this7._negotiationRole = 'offerer';
          _this7._needsInitialAnswer = true;
        }
        return _this7._setLocalDescription({
          type: 'offer',
          sdp: updatedSdp
        });
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

      var revision = description.revision;
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
            sdp: isChrome && vp8SimulcastRequested ? _this8._setSimulcast(description.sdp, _this8._sdpFormat, _this8._trackIdsToAttributes) : description.sdp
          };
        }
        description = new _this8._RTCSessionDescription(description);
        if (description.type === 'answer') {
          _this8._lastStableDescriptionRevision = revision;
        }
        return _this8._peerConnection.setLocalDescription(description);
      }).catch(function (error) {
        _this8._log.warn('Calling setLocalDescription with an RTCSessionDescription of type "' + description.type + '" failed with the error "' + error.message + '".');
        if (description.sdp) {
          _this8._log.warn('The SDP was ' + description.sdp);
        }
        throw new MediaClientLocalDescFailedError();
      }).then(function () {
        if (description.type !== 'rollback') {
          _this8._localDescription = description;
          _this8._localCandidates = [];
          if (description.type === 'offer') {
            _this8._descriptionRevision++;
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
        description.sdp = this._setBitrateParameters(description.sdp, isFirefox ? 'TIAS' : 'AS', this._encodingParameters.maxAudioBitrate, this._encodingParameters.maxVideoBitrate);
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
        if (description.type === 'answer' && _this9._isRestartingIce) {
          _this9._log.debug('An ICE restart was in-progress and is now completed');
          _this9._isRestartingIce = false;
        }
        if (_this9._isUnifiedPlan && _this9._peerConnection.getTransceivers) {
          _this9._peerConnection.getTransceivers().forEach(function (transceiver) {
            if (shouldStopTransceiver(description.sdp, transceiver)) {
              transceiver.stop();
            }
          });
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
          } else if (this._needsInitialAnswer) {
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
            if (this._needsInitialAnswer) {
              this._queuedDescription = description;
              return Promise.resolve();
            }
            this._descriptionRevision = description.revision;
            return this._handleGlare(description);
          }
          this._descriptionRevision = description.revision;
          return this._answer(description);
        default:
        // Do nothing.
      }

      // Handle answer or pranswer.
      var revision = description.revision;
      return Promise.resolve().then(function () {
        if (description.type === 'answer') {
          _this10._lastStableDescriptionRevision = revision;
        }
        return _this10._setRemoteDescription(description);
      }).catch(function () {
        throw new MediaClientRemoteDescFailedError();
      }).then(function () {
        if (description.type === 'answer') {
          _this10._needsInitialAnswer = false;
        }
        return _this10._checkIceBox(description);
      }).then(function () {
        return _this10._queuedDescription && _this10._updateDescription(_this10._queuedDescription);
      }).then(function () {
        _this10._queuedDescription = null;
        return _this10._peerConnection.localDescription ? _this10._maybeReoffer(_this10._peerConnection.localDescription) : Promise.resolve();
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
        var transceiver = this._peerConnection.addTransceiver(mediaTrackSender.track);
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

      if (this._needsInitialAnswer || this._isRestartingIce) {
        this._shouldOffer = true;
        return Promise.resolve();
      }

      return this.bracket('offering', function (key) {
        _this11.transition('updating', key);
        return _this11._offer().then(function () {
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
 * @param {string} sdp
 * @param {string} mid
 * @returns {?string} direction
 */
function getTransceiverDirection(sdp, mid) {
  var section = getMediaSections(sdp).find(function (section) {
    return section.match('a=mid:' + mid);
  });
  if (!section) {
    return null;
  }
  var match = section.match(/a=(sendrecv|sendonly|recvonly|inactive)/);
  return match ? match[1] : null;
}

/**
 * @param {string} sdp
 * @returns {Array<string>} mids
 */
function getMids(sdp) {
  return sdp.match(/\r\na=mid:.+$/mg).map(function (match) {
    return match.split(':')[1];
  }).filter(function (mid) {
    return mid;
  });
}

/**
 * @param {string} sdp
 * @param {RTCRtpTransceiver} transceiver
 * @returns {boolean} shouldStop
 */
function shouldStopTransceiver(sdp, transceiver) {
  if (!transceiver.stop || transceiver.stopped || !transceiver.mid) {
    return false;
  }

  // NOTE(mroberts): We don't want to stop the initial two audio and video
  // RTCRtpTransceivers that everyone negotiates with.
  var mids = getMids(sdp);
  if (transceiver.mid === mids[0] || transceiver.mid === mids[1]) {
    return false;
  }

  if (transceiver.currentDirection === 'inactive') {
    return true;
  }

  var direction = getTransceiverDirection(sdp, transceiver.mid);
  if (direction === 'inactive') {
    return true;
  } else if (direction === 'recvonly' && !transceiver.sender.track) {
    return true;
  }

  return false;
}

module.exports = PeerConnectionV2;