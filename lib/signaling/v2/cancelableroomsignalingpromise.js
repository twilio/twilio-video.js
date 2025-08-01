'use strict';

const CancelablePromise = require('../../util/cancelablepromise');
const DefaultPeerConnectionManager = require('./peerconnectionmanager');
const DefaultRoomV2 = require('./room');
const DefaultTransport = require('./twilioconnectiontransport');

const {
  SignalingConnectionDisconnectedError,
  SignalingIncomingMessageInvalidError
} = require('../../util/twilio-video-errors');

const { flatMap, createRoomConnectEventPayload } = require('../../util');

function createCancelableRoomSignalingPromise(token, wsServer, localParticipant, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  const adaptiveSimulcast = preferredCodecs.video[0] &&  preferredCodecs.video[0].adaptiveSimulcast === true;
  const { PeerConnectionManager, RoomV2, Transport, iceServers, log } = options;
  const peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);
  const trackSenders = flatMap(localParticipant.tracks, trackV2 => [trackV2.trackTransceiver]);
  peerConnectionManager.setTrackSenders(trackSenders);

  const cancellationError = new Error('Canceled');

  let transport;

  const cancelablePromise = new CancelablePromise((resolve, reject, isCanceled) => {
    const onIced = iceServers => {
      if (isCanceled()) {
        reject(cancellationError);
        return Promise.reject(cancellationError);
      }
      log.debug('Got ICE servers:', iceServers);
      options.iceServers = iceServers;
      peerConnectionManager.setConfiguration(options);

      return peerConnectionManager.createAndOffer().then(() => {
        if (isCanceled()) {
          reject(cancellationError);
          throw cancellationError;
        }
        log.debug('createAndOffer() succeeded.');
        // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
        // initial offer in the event queue for the 'description' event. So,
        // we are dequeueing to prevent the spurious 'update' message sent by
        // the client after connecting to a room.
        peerConnectionManager.dequeue('description');
      }).catch(error => {
        log.error('createAndOffer() failed:', error);
        reject(error);
        throw error;
      });
    };

    const {
      automaticSubscription,
      bandwidthProfile,
      dominantSpeaker,
      receiveTranscriptions,
      environment,
      eventObserver,
      loggerName,
      logLevel,
      name,
      networkMonitor,
      networkQuality,
      notifyWarnings,
      realm,
      sdpSemantics,
    } = options;

    // decide which msp channels to request
    // dominantSpeaker, networkQuality
    const trackPriority = !!bandwidthProfile;
    const trackSwitchOff = !!bandwidthProfile;
    const renderHints = !!bandwidthProfile &&
      (options.clientTrackSwitchOffControl !== 'disabled' || options.contentPreferencesMode !== 'disabled');

    const transportOptions = Object.assign({
      adaptiveSimulcast,
      automaticSubscription,
      dominantSpeaker,
      receiveTranscriptions,
      environment,
      eventObserver,
      loggerName,
      logLevel,
      networkMonitor,
      networkQuality,
      notifyWarnings,
      iceServers,
      onIced,
      realm,
      renderHints,
      sdpSemantics,
      trackPriority,
      trackSwitchOff
    }, bandwidthProfile ? {
      bandwidthProfile
    } : {});

    transport = new Transport(
      name,
      token,
      localParticipant,
      peerConnectionManager,
      wsServer,
      transportOptions);

    const connectEventPayload = createRoomConnectEventPayload(options);
    eventObserver.emit('event', connectEventPayload);

    transport.once('connected', initialState => {
      log.debug('Transport connected:', initialState);
      if (isCanceled()) {
        reject(cancellationError);
        return;
      }
      const { participant: localParticipantState } = initialState;
      if (!localParticipantState) {
        reject(new SignalingIncomingMessageInvalidError());
        return;
      }
      resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
    });

    transport.once('stateChanged', (state, error) => {
      if (state === 'disconnected') {
        transport = null;
        reject(error || new SignalingConnectionDisconnectedError());
      } else {
        log.debug('Transport state changed:', state);
      }
    });
  }, () => {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
  });

  cancelablePromise.catch(() => {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    peerConnectionManager.close();
  });

  return cancelablePromise;
}

module.exports = createCancelableRoomSignalingPromise;
