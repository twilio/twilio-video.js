'use strict';

const CancelablePromise = require('../../util/cancelablepromise');
const DefaultPeerConnectionManager = require('./peerconnectionmanager');
const DefaultRoomV2 = require('./room');
const DefaultTransport = require('./twilioconnectiontransport');

const {
  SignalingConnectionDisconnectedError,
  SignalingIncomingMessageInvalidError
} = require('../../util/twilio-video-errors');

const { flatMap, waitForEvent } = require('../../util');

function createCancelableRoomSignalingPromise(token, wsServer, localParticipant, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  let transport;
  let finalError;
  const log = options.log;

  const PeerConnectionManager = options.PeerConnectionManager;
  const RoomV2 = options.RoomV2;
  const peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);
  const trackSenders = flatMap(localParticipant.tracks, trackV2 => [trackV2.trackTransceiver]);

  return new CancelablePromise(function onCreate(resolve, reject) {
    let transportOptions = typeof options.wsServerInsights === 'string'
      ? { wsServerInsights: options.wsServerInsights }
      : {};

    if (options.InsightsPublisher) {
      transportOptions.InsightsPublisher = options.InsightsPublisher;
    }

    if (options.NullInsightsPublisher) {
      transportOptions.NullInsightsPublisher = options.NullInsightsPublisher;
    }

    if (options.bandwidthProfile) {
      transportOptions.bandwidthProfile = options.bandwidthProfile;
    }

    const iceServers = Array.isArray(options.iceServers) ? options.iceServers : null;
    transportOptions = Object.assign({
      automaticSubscription: options.automaticSubscription,
      dominantSpeaker: options.dominantSpeaker,
      environment: options.environment,
      overrideIceServers: iceServers,
      logLevel: options.logLevel,
      networkQuality: options.networkQuality,
      insights: options.insights,
      realm: options.realm,
      region: options.region,
      sdpSemantics: options.sdpSemantics
    }, transportOptions);

    const Transport = options.Transport;
    transport = new Transport(
      options.name,
      token,
      localParticipant,
      peerConnectionManager,
      wsServer,
      transportOptions);

    // reject the promise if transport disconnects
    transport.once('stateChanged', function stateChanged(state, error) {
      log.debug('stateChanged', state, error);
      if (state === 'disconnected') {
        finalError = finalError || error || new SignalingConnectionDisconnectedError();
        transport = null;
        peerConnectionManager.close();
        reject(finalError);
      }
    });

    const connectedPromise = waitForEvent(transport, 'connected');
    const ensureIceServers = iceServers ? Promise.resolve(iceServers) : waitForEvent(transport, 'iced');
    return ensureIceServers.then(function onIced(iceServers) {
      log.debug('Got ICE servers:', iceServers);
      if (finalError) {
        throw finalError;
      }
      options.iceServers = iceServers;
      peerConnectionManager.setConfiguration(options);
      peerConnectionManager.setTrackSenders(trackSenders);
      log.debug('Creating offer');
      return peerConnectionManager.createAndOffer();
    }).then(function createAndOfferSucceeded() {
      log.debug('Created offer');
      if (finalError) {
        throw finalError;
      }
      // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
      // initial offer in the event queue for the 'description' event. So,
      // we are dequeueing to prevent the spurious 'update' message sent by
      // the client after connecting to a room.
      peerConnectionManager.dequeue('description');
      transport.resumeConnect();
      log.debug('Waiting for transport to connect');
      return connectedPromise;
    }).then(function connected(initialState) {
      log.debug('got connected');
      if (finalError) {
        throw finalError;
      }

      const localParticipantState = initialState.participant;
      if (!localParticipantState) {
        throw new SignalingIncomingMessageInvalidError();
      }

      localParticipant.setSignalingRegion(initialState.options.signaling_region);
      const roomSignaling =  new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options);
      log.debug('Created room signaling', roomSignaling);
      resolve(roomSignaling);
    }).catch(function onError(error) {
      log.error('Something went wrong', error);
      reject(error);
      if (transport) {
        transport.disconnect();
        transport = null;
      }
      peerConnectionManager.close();
    });
  }, function onCancel() {
    log.debug('request was cancelled', arguments);
    finalError = new Error('Canceled');
  });
}

module.exports = createCancelableRoomSignalingPromise;
