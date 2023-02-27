'use strict';

const DefaultBackoff = require('../../util/backoff');
const {
  RTCIceCandidate: DefaultRTCIceCandidate,
  RTCPeerConnection: DefaultRTCPeerConnection,
  RTCSessionDescription: DefaultRTCSessionDescription,
  getStats: getStatistics
} = require('../../webrtc');

const util = require('../../webrtc/util');

const {
  DEFAULT_ICE_GATHERING_TIMEOUT_MS,
  DEFAULT_LOG_LEVEL,
  DEFAULT_SESSION_TIMEOUT_SEC,
  iceRestartBackoffConfig
} = require('../../util/constants');

const {
  addOrRewriteNewTrackIds,
  addOrRewriteTrackIds,
  createCodecMapForMediaSection,
  disableRtx,
  enableDtxForOpus,
  filterLocalCodecs,
  getMediaSections,
  removeSSRCAttributes,
  revertSimulcast,
  setCodecPreferences,
  setSimulcast
} = require('../../util/sdp');

const DefaultTimeout = require('../../util/timeout');

const {
  MediaClientLocalDescFailedError,
  MediaClientRemoteDescFailedError
} = require('../../util/twilio-video-errors');

const {
  buildLogLevels,
  getPlatform,
  isChromeScreenShareTrack,
  oncePerTick,
  defer
} = require('../../util');

const IceBox = require('./icebox');
const DefaultIceConnectionMonitor = require('./iceconnectionmonitor.js');
const DataTrackReceiver = require('../../data/receiver');
const MediaTrackReceiver = require('../../media/track/receiver');
const StateMachine = require('../../statemachine');
const Log = require('../../util/log');
const TrackMatcher = require('../../util/sdp/trackmatcher');
const workaroundIssue8329 = require('../../util/sdp/issue8329');

const guess = util.guessBrowser();
const platform = getPlatform();
const isAndroid = /android/.test(platform);
const isChrome = guess === 'chrome';
const isFirefox = guess === 'firefox';
const isSafari = guess === 'safari';

let nInstances = 0;

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

const states = {
  open: [
    'closed',
    'updating'
  ],
  updating: [
    'closed',
    'open'
  ],
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
class PeerConnectionV2 extends StateMachine {
  /**
   * Construct a {@link PeerConnectionV2}.
   * @param {string} id
   * @param {EncodingParametersImpl} encodingParameters
   * @param {PreferredCodecs} preferredCodecs
   * @param {object} [options]
   */
  constructor(id, encodingParameters, preferredCodecs, options) {
    super('open', states);
    options = Object.assign({
      enableDscp: false,
      dummyAudioMediaStreamTrack: null,
      isChromeScreenShareTrack,
      iceServers: [],
      logLevel: DEFAULT_LOG_LEVEL,
      offerOptions: {},
      revertSimulcast,
      sessionTimeout: DEFAULT_SESSION_TIMEOUT_SEC * 1000,
      setCodecPreferences,
      setSimulcast,
      Backoff: DefaultBackoff,
      IceConnectionMonitor: DefaultIceConnectionMonitor,
      RTCIceCandidate: DefaultRTCIceCandidate,
      RTCPeerConnection: DefaultRTCPeerConnection,
      RTCSessionDescription: DefaultRTCSessionDescription,
      Timeout: DefaultTimeout
    }, options);

    const configuration = getConfiguration(options);
    const logLevels = buildLogLevels(options.logLevel);
    const RTCPeerConnection = options.RTCPeerConnection;

    if (options.enableDscp === true) {
      options.chromeSpecificConstraints = options.chromeSpecificConstraints || {};
      options.chromeSpecificConstraints.optional = options.chromeSpecificConstraints.optional || [];
      options.chromeSpecificConstraints.optional.push({ googDscp: true });
    }

    const log = options.log ? options.log.createLog('webrtc', this) : new Log('webrtc', this, logLevels, options.loggerName);
    const peerConnection = new RTCPeerConnection(configuration, options.chromeSpecificConstraints);

    if (options.dummyAudioMediaStreamTrack) {
      peerConnection.addTrack(options.dummyAudioMediaStreamTrack);
    }

    Object.defineProperties(this, {
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
        value: options.isChromeScreenShareTrack,
      },
      _iceGatheringFailed: {
        value: false,
        writable: true
      },
      _iceGatheringTimeout: {
        value: new options.Timeout(
          () => this._handleIceGatheringTimeout(),
          DEFAULT_ICE_GATHERING_TIMEOUT_MS,
          false)
      },
      _iceRestartBackoff: {
        // eslint-disable-next-line new-cap
        value: new options.Backoff(iceRestartBackoffConfig)
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
      _localUfrag: {
        writable: true,
        value: null
      },
      _log: {
        value: log
      },
      _eventObserver: {
        value: options.eventObserver
      },
      _remoteCodecMaps: {
        value: new Map()
      },
      _rtpSenders: {
        value: new Map()
      },
      _rtpNewSenders: {
        value: new Set()
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
        value: oncePerTick(() => {
          if (!this._needsAnswer) {
            updateEncodingParameters(this);
          }
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
        value: preferredCodecs.audio.every(({ codec }) => codec !== 'opus')
          || preferredCodecs.audio.some(({ codec, dtx }) => codec === 'opus' && dtx)
      },
      _queuedDescription: {
        writable: true,
        value: null
      },
      _iceReconnectTimeout: {
        value: new options.Timeout(() => {
          log.debug('ICE reconnect timed out');
          this.close();
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
      _setCodecPreferences: {
        // NOTE(mmalavalli): Re-ordering payload types in order to make sure a non-H264
        // preferred codec is selected does not work on Android Firefox due to this behavior:
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1683258. So, we work around this by
        // not applying any non-H264 preferred video codec.
        value: isFirefox && isAndroid && preferredCodecs.video[0] && preferredCodecs.video[0].codec.toLowerCase() !== 'h264'
          ? sdp => sdp
          : options.setCodecPreferences
      },
      _setSimulcast: {
        value: options.setSimulcast
      },
      _revertSimulcast: {
        value: options.revertSimulcast
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
      _mediaTrackSenderToPublisherHints: {
        value: new Map()
      },
      id: {
        enumerable: true,
        value: id
      }
    });

    encodingParameters.on('changed', this._onEncodingParametersChanged);

    peerConnection.addEventListener('connectionstatechange', this._handleConnectionStateChange.bind(this));
    peerConnection.addEventListener('datachannel', this._handleDataChannelEvent.bind(this));
    peerConnection.addEventListener('icecandidate', this._handleIceCandidateEvent.bind(this));
    peerConnection.addEventListener('iceconnectionstatechange', this._handleIceConnectionStateChange.bind(this));
    peerConnection.addEventListener('icegatheringstatechange', this._handleIceGatheringStateChange.bind(this));
    peerConnection.addEventListener('signalingstatechange', this._handleSignalingStateChange.bind(this));
    peerConnection.addEventListener('track', this._handleTrackEvent.bind(this));

    const self = this;
    this.on('stateChanged', function stateChanged(state) {
      if (state !== 'closed') {
        return;
      }
      self.removeListener('stateChanged', stateChanged);
      self._dataChannels.forEach((dataChannel, dataTrackSender) => {
        self.removeDataTrackSender(dataTrackSender);
      });
    });
  }

  toString() {
    return `[PeerConnectionV2 #${this._instanceId}: ${this.id}]`;
  }

  setEffectiveAdaptiveSimulcast(effectiveAdaptiveSimulcast) {
    this._log.debug('Setting setEffectiveAdaptiveSimulcast: ', effectiveAdaptiveSimulcast);
    // clear adaptive simulcast from codec preferences if it was set.
    this._preferredVideoCodecs.forEach(cs => {
      if ('adaptiveSimulcast' in cs) {
        cs.adaptiveSimulcast = effectiveAdaptiveSimulcast;
      }
    });
  }

  get _shouldApplySimulcast() {
    if (!isChrome && !isSafari) {
      return false;
    }

    // adaptiveSimulcast is set to false after connected message is received if other party does not support it.
    const simulcast = this._preferredVideoCodecs.some(cs => {
      return cs.codec.toLowerCase() === 'vp8' && cs.simulcast && cs.adaptiveSimulcast !== false;
    });

    return simulcast;
  }

  /**
   * The {@link PeerConnectionV2}'s underlying RTCPeerConnection's RTCPeerConnectionState
   * if supported by the browser, its RTCIceConnectionState otherwise.
   * @property {RTCPeerConnectionState}
   */
  get connectionState() {
    return this.iceConnectionState === 'failed'
      ? 'failed' : (this._peerConnection.connectionState || this.iceConnectionState);
  }

  /**
   * The {@link PeerConnectionV2}'s underlying RTCPeerConnection's
   * RTCIceConnectionState.
   * @property {RTCIceConnectionState}
   */
  get iceConnectionState() {
    return ((this._isIceConnectionInactive && this._peerConnection.iceConnectionState === 'disconnected') || this._iceGatheringFailed)
      ? 'failed' : this._peerConnection.iceConnectionState;
  }

  /**
   * Whether the {@link PeerConnectionV2} has negotiated or is in the process
   * of negotiating the application m= section.
   * @returns {boolean}
   */
  get isApplicationSectionNegotiated() {
    if (this._peerConnection.signalingState !== 'closed') {
      // accessing .localDescription in 'closed' state causes it throw exceptions.
      return this._peerConnection.localDescription
        ? getMediaSections(this._peerConnection.localDescription.sdp, 'application').length > 0
        : false;
    }
    return true;
  }

  /**
   * Whether adaptive simulcast is enabled.
   * @returns {boolean}
   */
  get _isAdaptiveSimulcastEnabled() {
    const adaptiveSimulcastEntry = this._preferredVideoCodecs.find(cs => 'adaptiveSimulcast' in cs);
    return adaptiveSimulcastEntry && adaptiveSimulcastEntry.adaptiveSimulcast === true;
  }

  /**
   * @param {MediaStreamTrack} track
   * @param {Array<RTCRtpEncodingParameters>} encodings
   * @param {boolean} trackReplaced
   * @returns {boolean} true if encodings were updated.
   */
  _maybeUpdateEncodings(track, encodings, trackReplaced = false) {
    if (track.kind !== 'video' || track.readyState === 'ended') {
      return false;
    }
    // NOTE(mmalavalli): There is no guarantee that CanvasCaptureMediaStreamTracks will always have "width" and "height"
    // in their settings. So, we don't update the encodings if they are not present.
    // Chromium bug: https://bugs.chromium.org/p/chromium/issues/detail?id=1367082
    const { height, width } = track.getSettings();
    if (typeof height !== 'number' || typeof width !== 'number') {
      return false;
    }
    // Note(mpatwardhan): always configure encodings for safari.
    // for chrome only when adaptive simulcast enabled.
    const browser = util.guessBrowser();
    if (browser === 'safari' || (browser === 'chrome' && this._isAdaptiveSimulcastEnabled)) {
      this._updateEncodings(track, encodings, trackReplaced);
      return true;
    }

    return false;
  }

  /**
   * Configures with default encodings depending on track type and resolution.
   * Default configuration sets some encodings to disabled, and for others set scaleResolutionDownBy
   * values. When trackReplaced is set to true, it will clear 'active' for any encodings that
   * needs to be enabled.
   * @param {MediaStreamTrack} track
   * @param {Array<RTCRtpEncodingParameters>} encodings
   * @param {boolean} trackReplaced
   */
  _updateEncodings(track, encodings, trackReplaced) {
    if (this._isChromeScreenShareTrack(track)) {
      const screenShareActiveLayerConfig = [
        { scaleResolutionDownBy: 1 },
        { scaleResolutionDownBy: 1 }
      ];
      encodings.forEach((encoding, i) => {
        const activeLayerConfig = screenShareActiveLayerConfig[i];
        if (activeLayerConfig) {
          encoding.scaleResolutionDownBy = activeLayerConfig.scaleResolutionDownBy;
          if (trackReplaced) {
            delete encoding.active;
          }
        } else {
          encoding.active = false;
          delete encoding.scaleResolutionDownBy;
        }
      });
    } else {
      const { width, height }  = track.getSettings();
      // NOTE(mpatwardhan): for non-screen share tracks
      // enable layers depending on track resolutions
      const pixelsToMaxActiveLayers = [
        { pixels: 960 * 540, maxActiveLayers: 3 },
        { pixels: 480 * 270, maxActiveLayers: 2 },
        { pixels: 0, maxActiveLayers: 1 }
      ];

      const trackPixels =  width * height;
      const activeLayersInfo = pixelsToMaxActiveLayers.find(layer => trackPixels >= layer.pixels);
      const activeLayers = Math.min(encodings.length, activeLayersInfo.maxActiveLayers);
      encodings.forEach((encoding, i) => {
        const enabled  = i < activeLayers;
        if (enabled) {
          encoding.scaleResolutionDownBy = 1 << (activeLayers - i - 1);
          if (trackReplaced) {
            encoding.active = true;
          }
        } else {
          encoding.active = false;
          delete encoding.scaleResolutionDownBy;
        }
      });
    }
    this._log.debug('_updateEncodings:', encodings.map(({ active, scaleResolutionDownBy }, i) => `[${i}: ${active}, ${scaleResolutionDownBy || 0}]`).join(', '));
  }

  /**
   * Add an ICE candidate to the {@link PeerConnectionV2}.
   * @private
   * @param {object} candidate
   * @returns {Promise<void>}
   */
  _addIceCandidate(candidate) {
    return Promise.resolve().then(() => {
      candidate = new this._RTCIceCandidate(candidate);
      return this._peerConnection.addIceCandidate(candidate);
    }).catch(error => {
      // NOTE(mmalavalli): Firefox 68+ now generates an RTCIceCandidate with an
      // empty candidate string to signal end-of-candidates, followed by a null
      // candidate. As of now, Chrome and Safari reject this RTCIceCandidate. Since
      // this does not affect the media connection between Firefox 68+ and Chrome/Safari
      // in Peer-to-Peer Rooms, we suppress the Error and log a warning message.
      //
      // Chrome bug: https://bugs.chromium.org/p/chromium/issues/detail?id=978582
      //
      this._log.warn(`Failed to add RTCIceCandidate ${candidate ? `"${candidate.candidate}"` : 'null'}: `
        + error.message);
    });
  }

  /**
   * Add ICE candidates to the {@link PeerConnectionV2}.
   * @private
   * @param {Array<object>} candidates
   * @returns {Promise<void>}
   */
  _addIceCandidates(candidates) {
    return Promise.all(candidates.map(this._addIceCandidate, this)).then(() => {});
  }

  /**
   * Add a new RTCRtpTransceiver or update an existing RTCRtpTransceiver for the
   * given MediaStreamTrack.
   * @private
   * @param {MediaStreamTrack} track
   * @returns {RTCRtpTransceiver}
   */
  _addOrUpdateTransceiver(track) {
    const transceiver = takeRecycledTransceiver(this, track.kind);
    if (transceiver && transceiver.sender) {
      const oldTrackId = transceiver.sender.track ? transceiver.sender.track.id : null;
      if (oldTrackId) {
        this._log.warn(`Reusing transceiver: ${transceiver.mid}] ${oldTrackId} => ${track.id}`);
      }
      // NOTE(mpatwardhan):remember this transceiver while we replace track.
      // we recycle transceivers that are not in use after 'negotiationCompleted', but we want to prevent
      // this one from getting recycled while replaceTrack is pending.
      this._replaceTrackPromises.set(transceiver, transceiver.sender.replaceTrack(track).then(() => {
        transceiver.direction = 'sendrecv';
      }, () => {
        // Do nothing.
      }).finally(() => {
        this._replaceTrackPromises.delete(transceiver);
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
  _checkIceBox(description) {
    const ufrag = getUfrag(description);
    if (!ufrag) {
      return Promise.resolve();
    }
    const candidates = this._remoteCandidates.setUfrag(ufrag);
    return this._addIceCandidates(candidates);
  }

  /**
   * Create an answer and set it on the {@link PeerConnectionV2}.
   * @private
   * @param {RTCSessionDescriptionInit} offer
   * @returns {Promise<boolean>}
   */
  _answer(offer) {
    return Promise.resolve().then(() => {
      if (!this._negotiationRole) {
        this._negotiationRole = 'answerer';
      }
      return this._setRemoteDescription(offer);
    }).catch(() => {
      throw new MediaClientRemoteDescFailedError();
    }).then(() => {
      return this._peerConnection.createAnswer();
    }).then(answer => {
      if (isFirefox) {
        // NOTE(mmalavalli): We work around Chromium bug 1106157 by disabling
        // RTX in Firefox 79+. For more details about the bug, please go here:
        // https://bugs.chromium.org/p/chromium/issues/detail?id=1106157
        answer = new this._RTCSessionDescription({
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
      let updatedSdp = removeSSRCAttributes(answer.sdp, ['mslabel', 'label']);

      if (this._shouldApplySimulcast) {
        let sdpWithoutSimulcast = updatedSdp;
        updatedSdp = this._setSimulcast(sdpWithoutSimulcast, this._trackIdsToAttributes);
        // NOTE(syerrapragada): VMS does not support H264 simulcast. So,
        // unset simulcast for sections in local offer where corresponding
        // sections in answer doesn't have vp8 as preferred codec and reapply offer.
        updatedSdp = this._revertSimulcast(updatedSdp, sdpWithoutSimulcast, offer.sdp);
      }

      // NOTE(mmalavalli): Work around Chromium bug 1074421.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1074421
      updatedSdp = updatedSdp.replace(/42e015/g, '42e01f');

      return this._setLocalDescription({
        type: answer.type,
        sdp: updatedSdp
      });
    }).then(() => {
      return this._checkIceBox(offer);
    }).then(() => {
      return this._queuedDescription
        && this._updateDescription(this._queuedDescription);
    }).then(() => {
      this._queuedDescription = null;
      return this._maybeReoffer(this._peerConnection.localDescription);
    }).catch(error => {
      const errorToThrow = error instanceof MediaClientRemoteDescFailedError ? error : new MediaClientLocalDescFailedError();
      this._publishMediaWarning({
        message: 'Failed to _answer',
        code: errorToThrow.code,
        error
      });
      throw errorToThrow;
    });
  }

  /**
   * Close the underlying RTCPeerConnection. Returns false if the
   * RTCPeerConnection was already closed.
   * @private
   * @returns {boolean}
   */
  _close() {
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
  _handleConnectionStateChange() {
    this.emit('connectionStateChanged');
  }

  /**
   * Handle a "datachannel" event.
   * @private
   * @param {RTCDataChannelEvent} event
   * @returns {void}
   */
  _handleDataChannelEvent(event) {
    const dataChannel = event.channel;
    const dataTrackReceiver = new DataTrackReceiver(dataChannel);
    this._dataTrackReceivers.add(dataTrackReceiver);

    dataChannel.addEventListener('close', () => {
      this._dataTrackReceivers.delete(dataTrackReceiver);
    });

    this.emit('trackAdded', dataTrackReceiver);
  }

  /**
   * Handle a glare scenario on the {@link PeerConnectionV2}.
   * @private
   * @param {RTCSessionDescriptionInit} offer
   * @returns {Promise<void>}
   */
  _handleGlare(offer) {
    this._log.debug('Glare detected; rolling back');
    if (this._isRestartingIce) {
      this._log.debug('An ICE restart was in progress; we\'ll need to restart ICE again after rolling back');
      this._isRestartingIce = false;
      this._shouldRestartIce = true;
    }
    return Promise.resolve().then(() => {
      this._trackIdsToAttributes = new Map(this._appliedTrackIdsToAttributes);
      return this._setLocalDescription({ type: 'rollback' });
    }).then(() => {
      this._needsAnswer = false;
      return this._answer(offer);
    }).then(didReoffer => {
      return didReoffer ? Promise.resolve() : this._offer();
    });
  }

  _publishMediaWarning({ message, code, error, sdp }) {
    this._eventObserver.emit('event', { level: 'warning', name: 'error', group: 'media', payload: {
      message,
      code,
      context: JSON.stringify({ error: error.message, sdp })
    } });
  }

  /**
   * Handle an ICE candidate event.
   * @private
   * @param {Event} event
   * @returns {void}
   */
  _handleIceCandidateEvent(event) {
    if (event.candidate) {
      this._log.debug('Clearing ICE gathering timeout');
      this._didGenerateLocalCandidates = true;
      this._iceGatheringTimeout.clear();
      this._localCandidates.push(event.candidate);
    }
    const peerConnectionState = {
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
  _handleIceConnectionStateChange() {
    const { iceConnectionState } = this._peerConnection;
    const isIceConnectedOrComplete = ['connected', 'completed'].includes(iceConnectionState);
    const log = this._log;

    log.debug(`ICE connection state is "${iceConnectionState}"`);
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
      this._iceConnectionMonitor.start(() => {
        // note: iceConnection monitor waits for iceConnectionState=disconnected for
        // detecting inactivity. Its possible that it may know about disconnected before _handleIceConnectionStateChange
        this._iceConnectionMonitor.stop();
        if (!this._shouldRestartIce && !this._isRestartingIce) {
          log.warn('ICE Connection Monitor detected inactivity');
          this._isIceConnectionInactive = true;
          this._initiateIceRestartBackoff();
          this.emit('iceConnectionStateChanged');
          this.emit('connectionStateChanged');
        }
      });
    } else if (!['disconnected', 'completed'].includes(iceConnectionState)) { // don't stop monitoring for disconnected or completed.
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
  _handleIceGatheringTimeout() {
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
  _handleIceGatheringStateChange() {
    const { iceGatheringState } = this._peerConnection;
    const log = this._log;
    log.debug(`ICE gathering state is "${iceGatheringState}"`);

    // NOTE(mmalavalli): Start the ICE gathering timeout only if the RTCPeerConnection
    // has started gathering candidates for the first time since the initial offer/answer
    // or an offer/answer with ICE restart.
    const { delay, isSet } = this._iceGatheringTimeout;
    if (iceGatheringState === 'gathering' && !this._didGenerateLocalCandidates && !isSet) {
      log.debug(`Starting ICE gathering timeout: ${delay}`);
      this._iceGatheringFailed = false;
      this._iceGatheringTimeout.start();
    }
  }

  /**
   * Handle a signaling state change event.
   * @private
   * @returns {void}
   */
  _handleSignalingStateChange() {
    if (this._peerConnection.signalingState === 'stable') {
      this._appliedTrackIdsToAttributes = new Map(this._trackIdsToAttributes);
    }
  }

  /**
   * Handle a track event.
   * @private
   * @param {RTCTrackEvent} event
   * @returns {void}
   */
  _handleTrackEvent(event) {
    const sdp = this._peerConnection.remoteDescription
      ? this._peerConnection.remoteDescription.sdp
      : null;

    this._trackMatcher = this._trackMatcher || new TrackMatcher();
    this._trackMatcher.update(sdp);

    const mediaStreamTrack = event.track;
    const signaledTrackId = this._trackMatcher.match(event) || mediaStreamTrack.id;
    const mediaTrackReceiver = new MediaTrackReceiver(signaledTrackId, mediaStreamTrack);

    // NOTE(mmalavalli): "ended" is not fired on the remote MediaStreamTrack when
    // the remote peer removes a track. So, when this MediaStreamTrack is re-used
    // for a different track due to the remote peer calling RTCRtpSender.replaceTrack(),
    // we delete the previous MediaTrackReceiver that owned this MediaStreamTrack
    // before adding the new MediaTrackReceiver.
    this._mediaTrackReceivers.forEach(trackReceiver => {
      if (trackReceiver.track.id === mediaTrackReceiver.track.id) {
        this._mediaTrackReceivers.delete(trackReceiver);
      }
    });

    this._mediaTrackReceivers.add(mediaTrackReceiver);
    mediaStreamTrack.addEventListener('ended', () => this._mediaTrackReceivers.delete(mediaTrackReceiver));
    this.emit('trackAdded', mediaTrackReceiver);
  }

  /**
   * Initiate ICE Restart.
   * @private
   * @returns {void}
   */
  _initiateIceRestart() {
    if (this._peerConnection.signalingState === 'closed') {
      return;
    }
    const log = this._log;
    log.warn('Attempting to restart ICE');
    this._didGenerateLocalCandidates = false;
    this._isIceRestartBackoffInProgress = false;
    this._shouldRestartIce = true;

    const { delay, isSet } = this._iceReconnectTimeout;
    if (!isSet) {
      log.debug(`Starting ICE reconnect timeout: ${delay}`);
      this._iceReconnectTimeout.start();
    }
    this.offer().catch(ex => {
      log.error(`offer failed in _initiateIceRestart with: ${ex.message}`);
    });
  }

  /**
   * Schedule an ICE Restart.
   * @private
   * @returns {void}
   */
  _initiateIceRestartBackoff() {
    if (this._peerConnection.signalingState === 'closed' || this._isIceRestartBackoffInProgress) {
      return;
    }
    this._log.warn('An ICE restart has been scheduled');
    this._isIceRestartBackoffInProgress = true;
    this._iceRestartBackoff.backoff(() => this._initiateIceRestart());
  }

  /**
   * Conditionally re-offer.
   * @private
   * @param {?RTCSessionDescriptionInit} localDescription
   * @returns {Promise<boolean>}
   */
  _maybeReoffer(localDescription) {
    let shouldReoffer = this._shouldOffer;

    if (localDescription && localDescription.sdp) {
      // NOTE(mmalavalli): If the local RTCSessionDescription has fewer audio and/or
      // video send* m= lines than the corresponding RTCRtpSenders with non-null
      // MediaStreamTracks, it means that the newly added RTCRtpSenders require
      // renegotiation.
      const senders = this._peerConnection.getSenders().filter(sender => sender.track);
      shouldReoffer = ['audio', 'video'].reduce((shouldOffer, kind) => {
        const mediaSections = getMediaSections(localDescription.sdp, kind, '(sendrecv|sendonly)');
        const sendersOfKind = senders.filter(isSenderOfKind.bind(null, kind));
        return shouldOffer || (mediaSections.length < sendersOfKind.length);
      }, shouldReoffer);

      // NOTE(mroberts): We also need to re-offer if we have a DataTrack to share
      // but no m= application section.
      const hasDataTrack = this._dataChannels.size > 0;
      const hasApplicationMediaSection = getMediaSections(localDescription.sdp, 'application').length > 0;
      const needsApplicationMediaSection = hasDataTrack && !hasApplicationMediaSection;
      shouldReoffer = shouldReoffer || needsApplicationMediaSection;
    }

    const promise = shouldReoffer ? this._offer() : Promise.resolve();
    return promise.then(() => shouldReoffer);
  }

  /**
   * Create an offer and set it on the {@link PeerConnectionV2}.
   * @private
   * @returns {Promise<void>}
   */
  _offer() {
    const offerOptions = Object.assign({}, this._offerOptions);
    this._needsAnswer = true;
    if (this._shouldRestartIce) {
      this._shouldRestartIce = false;
      this._isRestartingIce = true;
      offerOptions.iceRestart = true;
    }

    return Promise.all(this._replaceTrackPromises.values()).then(() => {
      return this._peerConnection.createOffer(offerOptions);
    }).catch(error => {
      const errorToThrow = new MediaClientLocalDescFailedError();
      this._publishMediaWarning({
        message: 'Failed to create offer',
        code: errorToThrow.code,
        error
      });
      throw errorToThrow;
    }).then(offer => {
      if (isFirefox) {
        // NOTE(mmalavalli): We work around Chromium bug 1106157 by disabling
        // RTX in Firefox 79+. For more details about the bug, please go here:
        // https://bugs.chromium.org/p/chromium/issues/detail?id=1106157
        offer = new this._RTCSessionDescription({
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
      let sdp = removeSSRCAttributes(offer.sdp, ['mslabel', 'label']);
      sdp = this._peerConnection.remoteDescription
        ? filterLocalCodecs(sdp, this._peerConnection.remoteDescription.sdp)
        : sdp;

      let updatedSdp = this._setCodecPreferences(
        sdp,
        this._preferredAudioCodecs,
        this._preferredVideoCodecs);

      this._shouldOffer = false;
      if (!this._negotiationRole) {
        this._negotiationRole = 'offerer';
      }

      if (this._shouldApplySimulcast) {
        this._localDescriptionWithoutSimulcast = {
          type: 'offer',
          sdp: updatedSdp
        };
        updatedSdp = this._setSimulcast(updatedSdp, this._trackIdsToAttributes);
      }
      return this._setLocalDescription({
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
  _getMediaTrackSenderId(trackId) {
    const mediaTrackSender = Array.from(this._rtpSenders.keys()).find(({ track: { id } }) => id === trackId);
    return mediaTrackSender ? mediaTrackSender.id : trackId;
  }

  /**
   * Add or rewrite local MediaStreamTrack IDs in the given RTCSessionDescription.
   * @private
   * @param {RTCSessionDescription} description
   * @return {RTCSessionDescription}
   */
  _addOrRewriteLocalTrackIds(description) {
    const transceivers = this._peerConnection.getTransceivers();
    const activeTransceivers = transceivers.filter(({ sender, stopped }) => !stopped && sender && sender.track);

    // NOTE(mmalavalli): There is no guarantee that MediaStreamTrack IDs will be present in
    // SDPs, and even if they are, there is no guarantee that they will be the same as the
    // actual MediaStreamTrack IDs. So, we add or re-write the actual MediaStreamTrack IDs
    // to the assigned m= sections here.
    const assignedTransceivers = activeTransceivers.filter(({ mid }) => mid);
    const midsToTrackIds = new Map(assignedTransceivers.map(({ mid, sender }) => [mid, this._getMediaTrackSenderId(sender.track.id)]));
    const sdp1 = addOrRewriteTrackIds(description.sdp, midsToTrackIds);

    // NOTE(mmalavalli): Chrome and Safari do not apply the offer until they get an answer.
    // So, we add or re-write the actual MediaStreamTrack IDs to the unassigned m= sections here.
    const unassignedTransceivers = activeTransceivers.filter(({ mid }) => !mid);
    const newTrackIdsByKind = new Map(['audio', 'video'].map(kind => [
      kind,
      unassignedTransceivers.filter(({ sender }) => sender.track.kind === kind).map(({ sender }) => this._getMediaTrackSenderId(sender.track.id))
    ]));
    const sdp2 = addOrRewriteNewTrackIds(sdp1, midsToTrackIds, newTrackIdsByKind);

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
  _rollbackAndApplyOffer(offer) {
    return this._setLocalDescription({ type: 'rollback' }).then(() => this._setLocalDescription(offer));
  }

  /**
   * Set a local description on the {@link PeerConnectionV2}.
   * @private
   * @param {RTCSessionDescription|RTCSessionDescriptionInit} description
   * @returns {Promise<void>}
   */
  _setLocalDescription(description) {
    if (description.type !== 'rollback' && this._shouldApplyDtx) {
      description = new this._RTCSessionDescription({
        sdp: enableDtxForOpus(description.sdp),
        type: description.type
      });
    }
    return this._peerConnection.setLocalDescription(description).catch(error => {
      this._log.warn(`Calling setLocalDescription with an RTCSessionDescription of type "${description.type}" failed with the error "${error.message}".`, error);

      const errorToThrow = new MediaClientLocalDescFailedError();
      const publishWarning = {
        message: `Calling setLocalDescription with an RTCSessionDescription of type "${description.type}" failed`,
        code: errorToThrow.code,
        error
      };

      if (description.sdp) {
        this._log.warn(`The SDP was ${description.sdp}`);
        publishWarning.sdp = description.sdp;
      }
      this._publishMediaWarning(publishWarning);
      throw errorToThrow;
    }).then(() => {
      if (description.type !== 'rollback') {
        this._localDescription = this._addOrRewriteLocalTrackIds(description);

        // NOTE(mmalavalli): In order for this feature to be backward compatible with older
        // SDK versions which to not support opus DTX, we append "usedtx=1" to the local SDP
        // only while applying it. We will not send it over the wire to prevent inadvertent
        // enabling of opus DTX in older SDKs. Newer SDKs will append "usedtx=1" by themselves
        // if the developer has requested opus DTX to be enabled. (JSDK-3063)
        if (this._shouldApplyDtx) {
          this._localDescription = new this._RTCSessionDescription({
            sdp: enableDtxForOpus(this._localDescription.sdp, []),
            type: this._localDescription.type
          });
        }

        this._localCandidates = [];
        if (description.type === 'offer') {
          this._descriptionRevision++;
        } else if (description.type === 'answer') {
          this._lastStableDescriptionRevision = this._descriptionRevision;
          negotiationCompleted(this);
        }
        this._localUfrag = getUfrag(description);
        this.emit('description', this.getState());
      }
    });
  }

  /**
   * Set a remote RTCSessionDescription on the {@link PeerConnectionV2}.
   * @private
   * @param {RTCSessionDescriptionInit} description
   * @returns {Promise<void>}
   */
  _setRemoteDescription(description) {
    if (description.sdp) {
      description.sdp = this._setCodecPreferences(
        description.sdp,
        this._preferredAudioCodecs,
        this._preferredVideoCodecs);

      if (this._shouldApplyDtx) {
        description.sdp = enableDtxForOpus(description.sdp);
      } else {
        // NOTE(mmalavalli): Remove "usedtx=1" from opus's fmtp line if present
        // since DTX is disabled.
        description.sdp = enableDtxForOpus(description.sdp, []);
      }

      if (isFirefox) {
        // NOTE(mroberts): Do this to reduce our MediaStream count in Firefox. By
        // mapping MediaStream IDs in the SDP to "-", we ensure the "track" event
        // doesn't include any new MediaStreams in Firefox. Its `streams` member
        // will always be the empty Array.
        description.sdp = filterOutMediaStreamIds(description.sdp);
      }
      if (!this._peerConnection.remoteDescription) {
        this._isIceLite = /a=ice-lite/.test(description.sdp);
      }
    }
    description = new this._RTCSessionDescription(description);
    // eslint-disable-next-line consistent-return
    return Promise.resolve().then(() => {
      // NOTE(syerrapragada): VMS does not support H264 simulcast. So,
      // unset simulcast for sections in local offer where corresponding
      // sections in answer doesn't have vp8 as preferred codec and reapply offer.
      if (description.type === 'answer' && this._localDescriptionWithoutSimulcast) {
        // NOTE(mpatwardhan):if we were using adaptive simulcast, and if its not supported by server
        // revert simulcast even for vp8.
        const adaptiveSimulcastEntry = this._preferredVideoCodecs.find(cs => 'adaptiveSimulcast' in cs);
        const revertForAll = !!adaptiveSimulcastEntry && adaptiveSimulcastEntry.adaptiveSimulcast === false;
        const sdpWithoutSimulcastForNonVP8MediaSections = this._revertSimulcast(
          this._localDescription.sdp,
          this._localDescriptionWithoutSimulcast.sdp,
          description.sdp, revertForAll);
        this._localDescriptionWithoutSimulcast = null;
        if (sdpWithoutSimulcastForNonVP8MediaSections !== this._localDescription.sdp) {
          return this._rollbackAndApplyOffer({
            type: this._localDescription.type,
            sdp: sdpWithoutSimulcastForNonVP8MediaSections
          });
        }
      }
    }).then(() => this._peerConnection.setRemoteDescription(description)).then(() => {
      if (description.type === 'answer') {
        if (this._isRestartingIce) {
          this._log.debug('An ICE restart was in-progress and is now completed');
          this._isRestartingIce = false;
        }
        negotiationCompleted(this);
      }
    }, error => {
      this._log.warn(`Calling setRemoteDescription with an RTCSessionDescription of type "${description.type}" failed with the error "${error.message}".`, error);
      if (description.sdp) {
        this._log.warn(`The SDP was ${description.sdp}`);
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
  _updateDescription(description) {
    switch (description.type) {
      case 'answer':
      case 'pranswer':
        if (description.revision !== this._descriptionRevision
          || this._peerConnection.signalingState !== 'have-local-offer') {
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
        if (description.revision <= this._lastStableDescriptionRevision
          || this._peerConnection.signalingState === 'closed') {
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
        return this._answer(description).then(() => {});
      default:
        // Do nothing.
    }

    // Handle answer or pranswer.
    const revision = description.revision;
    return Promise.resolve().then(() => {
      return this._setRemoteDescription(description);
    }).catch(error => {
      const errorToThrow = new MediaClientRemoteDescFailedError();
      this._publishMediaWarning({
        message: `Calling setRemoteDescription with an RTCSessionDescription of type "${description.type}" failed`,
        code: errorToThrow.code,
        error,
        sdp: description.sdp
      });
      throw errorToThrow;
    }).then(() => {
      this._lastStableDescriptionRevision = revision;
      this._needsAnswer = false;
      return this._checkIceBox(description);
    }).then(() => {
      return this._queuedDescription
        && this._updateDescription(this._queuedDescription);
    }).then(() => {
      this._queuedDescription = null;
      return this._maybeReoffer(this._peerConnection.localDescription).then(() => {});
    });
  }

  /**
   * Update the {@link PeerConnectionV2}'s ICE candidates.
   * @private
   * @param {object} iceState
   * @returns {Promise<void>}
   */
  _updateIce(iceState) {
    const candidates = this._remoteCandidates.update(iceState);
    return this._addIceCandidates(candidates);
  }

  /**
   * Add a {@link DataTrackSender} to the {@link PeerConnectionV2}.
   * @param {DataTrackSender} dataTrackSender
   * @returns {void}
   */
  addDataTrackSender(dataTrackSender) {
    if (this._dataChannels.has(dataTrackSender)) {
      return;
    }
    try {
      const dataChannelDict = {
        ordered: dataTrackSender.ordered
      };
      if (dataTrackSender.maxPacketLifeTime !== null) {
        dataChannelDict.maxPacketLifeTime = dataTrackSender.maxPacketLifeTime;
      }
      if (dataTrackSender.maxRetransmits !== null) {
        dataChannelDict.maxRetransmits = dataTrackSender.maxRetransmits;
      }
      const dataChannel = this._peerConnection.createDataChannel(dataTrackSender.id, dataChannelDict);
      dataTrackSender.addDataChannel(dataChannel);
      this._dataChannels.set(dataTrackSender, dataChannel);
    } catch (error) {
      this._log.warn(`Error creating an RTCDataChannel for DataTrack "${dataTrackSender.id}": ${error.message}`);
    }
  }

  _handleQueuedPublisherHints() {
    if (this._peerConnection.signalingState === 'stable') {
      this._mediaTrackSenderToPublisherHints.forEach(({ deferred, encodings }, mediaTrackSender) => {
        this._mediaTrackSenderToPublisherHints.delete(mediaTrackSender);
        this._setPublisherHint(mediaTrackSender, encodings)
          .then(result => deferred.resolve(result))
          .catch(error => deferred.reject(error));
      });
    }
  }

  /**
   * updates encodings for simulcast layers of given sender.
   * @param {RTCRtpSender} sender
   * @param {Array<{enabled: boolean, layer_index: number}>|null} encodings
   * @returns {Promise<string>} string indicating result of the operation. can be one of
   *  "OK", "INVALID_HINT", "COULD_NOT_APPLY_HINT", "UNKNOWN_TRACK"
   */
  _setPublisherHint(mediaTrackSender, encodings) {
    if (isFirefox) {
      return Promise.resolve('COULD_NOT_APPLY_HINT');
    }

    if (this._mediaTrackSenderToPublisherHints.has(mediaTrackSender)) {
      // skip any stale hint associated with the mediaTrackSender.
      const queuedHint = this._mediaTrackSenderToPublisherHints.get(mediaTrackSender);
      queuedHint.deferred.resolve('REQUEST_SKIPPED');
      this._mediaTrackSenderToPublisherHints.delete(mediaTrackSender);
    }

    const sender = this._rtpSenders.get(mediaTrackSender);
    if (!sender) {
      this._log.warn('Could not apply publisher hint because RTCRtpSender was not found');
      return Promise.resolve('UNKNOWN_TRACK');
    }

    if (this._peerConnection.signalingState === 'closed') {
      this._log.warn('Could not apply publisher hint because signalingState was "closed"');
      return Promise.resolve('COULD_NOT_APPLY_HINT');
    }

    if (this._peerConnection.signalingState !== 'stable') {
      // enqueue this hint to be applied when pc becomes stable.
      this._log.debug('Queuing up publisher hint because signalingState:', this._peerConnection.signalingState);
      const deferred = defer();
      this._mediaTrackSenderToPublisherHints.set(mediaTrackSender, { deferred, encodings });
      return deferred.promise;
    }

    const parameters = sender.getParameters();
    if (encodings !== null) {
      encodings.forEach(({ enabled, layer_index: layerIndex }) => {
        if (parameters.encodings.length > layerIndex) {
          this._log.debug(`layer:${layerIndex}, active:${parameters.encodings[layerIndex].active} => ${enabled}`);
          parameters.encodings[layerIndex].active = enabled;
        } else {
          this._log.warn(`invalid layer:${layerIndex}, active:${enabled}`);
        }
      });
    }

    // Note(mpatwardhan): after publisher hints are applied, overwrite with default encodings
    // to disable any encoding that shouldn't have been enabled by publisher_hints.
    // When encodings===null (that is we are asked to reset encodings for replaceTrack)
    // along with disabling encodings, clear active flag for encodings that should not be disabled
    this._maybeUpdateEncodings(sender.track, parameters.encodings, encodings === null /* trackReplaced */);

    return sender.setParameters(parameters).then(() => 'OK').catch(error => {
      this._log.error('Failed to apply publisher hints:', error);
      return 'COULD_NOT_APPLY_HINT';
    });
  }

  /**
   * Add the {@link MediaTrackSender} to the {@link PeerConnectionV2}.
   * @param {MediaTrackSender} mediaTrackSender
   * @returns {void}
   */
  addMediaTrackSender(mediaTrackSender) {
    if (this._peerConnection.signalingState === 'closed' || this._rtpSenders.has(mediaTrackSender)) {
      return;
    }
    const transceiver = this._addOrUpdateTransceiver(mediaTrackSender.track);
    const { sender } = transceiver;
    mediaTrackSender.addSender(sender, encodings => this._setPublisherHint(mediaTrackSender, encodings));
    this._rtpNewSenders.add(sender);
    this._rtpSenders.set(mediaTrackSender, sender);
  }

  /**
   * Close the {@link PeerConnectionV2}.
   * @returns {void}
   */
  close() {
    if (this._close()) {
      this._descriptionRevision++;
      this._localDescription = { type: 'close' };
      this.emit('description', this.getState());
    }
  }

  /**
   * Get the {@link DataTrackReceiver}s and the {@link MediaTrackReceiver}s on the
   * {@link PeerConnectionV2}.
   * @returns {Array<DataTrackReceiver|MediaTrackReceiver>} trackReceivers
   */
  getTrackReceivers() {
    return Array.from(this._dataTrackReceivers).concat(Array.from(this._mediaTrackReceivers));
  }

  /**
   * Get the {@link PeerConnectionV2}'s state (specifically, its description).
   * @returns {?object}
   */
  getState() {
    if (!this._localDescription) {
      return null;
    }

    // NOTE(mpatwardhan): Return most recent localDescription. If the most recent local description is an
    // answer, and this method is called for sending a "sync" message while the next remote offer is being processed,
    // we need to send the most recent stable description revision instead of the current description revision,
    // which is supposed to be for the next local answer.
    const localDescriptionRevision = this._localDescription.type === 'answer' ? this._lastStableDescriptionRevision : this._descriptionRevision;
    const localDescription = {
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
  offer() {
    if (this._needsAnswer || this._isRestartingIce) {
      this._shouldOffer = true;
      return Promise.resolve();
    }

    return this.bracket('offering', key => {
      this.transition('updating', key);
      const promise = this._needsAnswer || this._isRestartingIce ? Promise.resolve() : this._offer();
      return promise.then(() => {
        this.tryTransition('open', key);
      }, error => {
        this.tryTransition('open', key);
        throw error;
      });
    });
  }

  /**
   * Remove a {@link DataTrackSender} from the {@link PeerConnectionV2}.
   * @param {DataTrackSender} dataTrackSender
   * @returns {void}
   */
  removeDataTrackSender(dataTrackSender) {
    const dataChannel = this._dataChannels.get(dataTrackSender);
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
  removeMediaTrackSender(mediaTrackSender) {
    const sender = this._rtpSenders.get(mediaTrackSender);
    if (!sender) {
      return;
    }
    if (this._peerConnection.signalingState !== 'closed') {
      this._peerConnection.removeTrack(sender);
    }
    mediaTrackSender.removeSender(sender);
    // clean up any pending publisher hints associated with this mediaTrackSender.
    if (this._mediaTrackSenderToPublisherHints.has(mediaTrackSender)) {
      const queuedHint = this._mediaTrackSenderToPublisherHints.get(mediaTrackSender);
      queuedHint.deferred.resolve('UNKNOWN_TRACK');
      this._mediaTrackSenderToPublisherHints.delete(mediaTrackSender);
    }
    this._rtpNewSenders.delete(sender);
    this._rtpSenders.delete(mediaTrackSender);
  }

  /**
   * Set the RTCConfiguration on the underlying RTCPeerConnection.
   * @param {RTCConfiguration} configuration
   * @returns {void}
   */
  setConfiguration(configuration) {
    if (typeof this._peerConnection.setConfiguration === 'function') {
      this._peerConnection.setConfiguration(getConfiguration(configuration));
    }
  }

  /**
   * Set the ICE reconnect timeout period.
   * @param {number} period - Period in milliseconds.
   * @returns {this}
   */
  setIceReconnectTimeout(period) {
    this._iceReconnectTimeout.setDelay(period);
    this._log.debug('Updated ICE reconnection timeout period:',
      this._iceReconnectTimeout.delay);
    return this;
  }

  /**
   * Update the {@link PeerConnectionV2}.
   * @param {object} peerConnectionState
   * @returns {Promise<void>}
   */
  update(peerConnectionState) {
    return this.bracket('updating', key => {
      if (this.state === 'closed') {
        return Promise.resolve();
      }

      this.transition('updating', key);

      const updates = [];

      if (peerConnectionState.ice) {
        updates.push(this._updateIce(peerConnectionState.ice));
      }

      if (peerConnectionState.description) {
        updates.push(this._updateDescription(peerConnectionState.description));
      }

      return Promise.all(updates).then(() => {
        this.tryTransition('open', key);
      }, error => {
        this.tryTransition('open', key);
        throw error;
      });
    });
  }

  /**
   * Get the {@link PeerConnectionV2}'s media statistics.
   * @returns {Promise<StandardizedStatsResponse>}
   */
  getStats() {
    return getStatistics(this._peerConnection).then(response => rewriteTrackIds(this, response));
  }
}

function rewriteLocalTrackId(pcv2, stats) {
  const trackId = pcv2._getMediaTrackSenderId(stats.trackId);
  return Object.assign(stats, { trackId });
}

function rewriteTrackId(pcv2, stats) {
  const receiver = [...pcv2._mediaTrackReceivers]
    .find(receiver => receiver.track.id === stats.trackId);
  const trackId = receiver ? receiver.id : null;
  return Object.assign(stats, { trackId });
}

function rewriteTrackIds(pcv2, response) {
  return Object.assign(response, {
    remoteAudioTrackStats: response.remoteAudioTrackStats.map(stats => rewriteTrackId(pcv2, stats)),
    remoteVideoTrackStats: response.remoteVideoTrackStats.map(stats => rewriteTrackId(pcv2, stats)),
    localAudioTrackStats: response.localAudioTrackStats.map(stats => rewriteLocalTrackId(pcv2, stats)),
    localVideoTrackStats: response.localVideoTrackStats.map(stats => rewriteLocalTrackId(pcv2, stats)),
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
    const match = description.sdp.match(/^a=ice-ufrag:([a-zA-Z0-9+/]+)/m);
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
  const track = sender.track;
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
  return !transceiver.stopped
    && !pcv2._replaceTrackPromises.has(transceiver)
    && ['inactive', 'recvonly'].includes(transceiver.direction);
}

/**
 * Take a recycled RTCRtpTransceiver if available.
 * @param {PeerConnectionV2} pcv2
 * @param {Track.Kind} kind
 * @returns {?RTCRtpTransceiver}
 */
function takeRecycledTransceiver(pcv2, kind) {
  const preferredCodecs = {
    audio: pcv2._preferredAudioCodecs.map(({ codec }) => codec.toLowerCase()),
    video: pcv2._preferredVideoCodecs.map(({ codec }) => codec.toLowerCase())
  }[kind];

  const recycledTransceivers = pcv2._recycledTransceivers[kind];
  const localCodec = preferredCodecs.find(codec => pcv2._localCodecs.has(codec));
  if (!localCodec) {
    return recycledTransceivers.shift();
  }

  const transceiver = recycledTransceivers.find(transceiver => {
    const remoteCodecMap = pcv2._remoteCodecMaps.get(transceiver.mid);
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
  const description = pcv2._peerConnection.localDescription;
  if (!description || !description.sdp) {
    return;
  }
  getMediaSections(description.sdp).forEach(section => {
    const codecMap = createCodecMapForMediaSection(section);
    codecMap.forEach((pts, codec) => pcv2._localCodecs.add(codec));
  });
}

/**
 * Update the {@link Codec} maps for all m= sections in the remote {@link RTCSessionDescription}s.
 * @param {PeerConnectionV2} pcv2
 * @returns {void}
 */
function updateRemoteCodecMaps(pcv2) {
  const description = pcv2._peerConnection.remoteDescription;
  if (!description || !description.sdp) {
    return;
  }
  getMediaSections(description.sdp).forEach(section => {
    const matched = section.match(/^a=mid:(.+)$/m);
    if (!matched || !matched[1]) {
      return;
    }
    const mid = matched[1];
    const codecMap = createCodecMapForMediaSection(section);
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
  pcv2._peerConnection.getTransceivers().forEach(transceiver => {
    if (shouldRecycleTransceiver(transceiver, pcv2)) {
      const track = transceiver.receiver.track;
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
  updateRecycledTransceivers(pcv2);
  updateLocalCodecs(pcv2);
  updateRemoteCodecMaps(pcv2);
  updateEncodingParameters(pcv2).then(() => {
    // if there any any publisher hints queued, apply them now.
    pcv2._handleQueuedPublisherHints();
  });
}

/**
 * Update the RTCRtpEncodingParameters of all active RTCRtpSenders.
 * @param {PeerConnectionV2} pcv2
 * @returns {void}
 */
function updateEncodingParameters(pcv2) {
  const { maxAudioBitrate, maxVideoBitrate } = pcv2._encodingParameters;

  const maxBitrates = new Map([
    ['audio', maxAudioBitrate],
    ['video', maxVideoBitrate]
  ]);

  const promises = [];
  pcv2._peerConnection.getSenders().filter(sender => sender.track).forEach(sender => {
    const maxBitrate = maxBitrates.get(sender.track.kind);
    const params = sender.getParameters();

    if (maxBitrate === null || maxBitrate === 0) {
      removeMaxBitrate(params);
    } else if (pcv2._isChromeScreenShareTrack(sender.track)) {
      // NOTE(mpatwardhan): Sometimes (JSDK-2557) chrome does not send any bytes on screen track if MaxBitRate is set on it via setParameters,
      // To workaround this issue we will not apply maxBitrate if the track appears to be a screen share track created by chrome
      pcv2._log.warn(`Not setting maxBitrate for ${sender.track.kind} Track ${sender.track.id} because it appears to be screen share track: ${sender.track.label}`);
    } else {
      setMaxBitrate(params, maxBitrate);
    }

    if (!isFirefox && params.encodings.length > 0) {
      if (sender.track.kind === 'audio') {
        // NOTE(mmalavalli): "priority" is a per-sender property and not
        // a per-encoding-layer property. So, we set the value only on the first
        // encoding layer. Any attempt to set the value on subsequent encoding
        // layers (in the case of simulcast) will result in the Promise returned
        // by RTCRtpSender.setParameters() being rejected. With this, audio encoding
        // is prioritized the most.
        params.encodings[0].priority = 'high';
      } else if (pcv2._isChromeScreenShareTrack(sender.track)) {
        // NOTE(mmalavalli): Screen share encodings are prioritized more than those
        // of the camera.
        params.encodings[0].priority = 'medium';
      }
      if (pcv2._enableDscp) {
        // NOTE(mmalavalli): "networkPriority" is a per-sender property and not
        // a per-encoding-layer property. So, we set the value only on the first
        // encoding layer. Any attempt to set the value on subsequent encoding
        // layers (in the case of simulcast) will result in the Promise returned
        // by RTCRtpSender.setParameters() being rejected.
        params.encodings[0].networkPriority = 'high';
      }
    }

    // when a sender is reused, delete any active encodings set by server.
    const trackReplaced = pcv2._rtpNewSenders.has(sender);
    pcv2._maybeUpdateEncodings(sender.track, params.encodings, trackReplaced);
    pcv2._rtpNewSenders.delete(sender);

    const promise = sender.setParameters(params).catch(error => {
      pcv2._log.warn(`Error while setting encodings parameters for ${sender.track.kind} Track ${sender.track.id}: ${error.message || error.name}`);
    });
    promises.push(promise);
  });
  return Promise.all(promises);
}

/**
 * Remove maxBitrate from the RTCRtpSendParameters' encodings.
 * @param {RTCRtpSendParameters} params
 * @returns {void}
 */
function removeMaxBitrate(params) {
  if (Array.isArray(params.encodings)) {
    params.encodings.forEach(encoding => delete encoding.maxBitrate);
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
    params.encodings = [{ maxBitrate }];
  } else {
    params.encodings.forEach(encoding => {
      encoding.maxBitrate = maxBitrate;
    });
  }
}
module.exports = PeerConnectionV2;
