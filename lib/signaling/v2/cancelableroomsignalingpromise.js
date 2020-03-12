/* eslint-disable no-console */
'use strict';

const CancelablePromise = require('../../util/cancelablepromise');
const DefaultPeerConnectionManager = require('./peerconnectionmanager');
const DefaultRoomV2 = require('./room');
const DefaultTransport = require('./twilioconnectiontransport');

const {
  SignalingConnectionDisconnectedError,
  SignalingIncomingMessageInvalidError
} = require('../../util/twilio-video-errors');

const { flatMap } = require('../../util');

function createCancelableRoomSignalingPromise(token, wsServer, localParticipant, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  let transport;
  const log = options.log;

  const PeerConnectionManager = options.PeerConnectionManager;
  const RoomV2 = options.RoomV2;

  const peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);

  const trackSenders = flatMap(localParticipant.tracks, trackV2 => [trackV2.trackTransceiver]);

  const cancellationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    return new Promise((resolve, reject) => {
      if (isCanceled()) {
        reject(cancellationError);
        return;
      }

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

      const ensureIceServers = iceServers ? Promise.resolve(iceServers) : new Promise(resolve => transport.once('iced', resolve));
      ensureIceServers.then(iceServers => {
        log.debug('Got ICE servers:', iceServers);
        if (isCanceled()) {
          reject(cancellationError);
          return;
        }
        options.iceServers = iceServers;
        peerConnectionManager.setConfiguration(options);
        peerConnectionManager.setTrackSenders(trackSenders);
        peerConnectionManager.createAndOffer().then(function createAndOfferSucceeded() {
          log.debug('created offer');
          // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
          // initial offer in the event queue for the 'description' event. So,
          // we are dequeueing to prevent the spurious 'update' message sent by
          // the client after connecting to a room.
          peerConnectionManager.dequeue('description');
          transport.resumeConnect();
        }).catch(e => {
          log.warn('createAndOffer failed', e.message);
        });
      });

      transport.once('connected', function connected(initialState) {
        log.debug('got connected');
        if (isCanceled()) {
          reject(cancellationError);
          return;
        }

        const localParticipantState = initialState.participant;
        if (!localParticipantState) {
          reject(new SignalingIncomingMessageInvalidError());
          return;
        }

        localParticipant.setSignalingRegion(initialState.options.signaling_region);
        resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
      });

      transport.once('stateChanged', function stateChanged(state, error) {
        if (state === 'disconnected') {
          error = error || new SignalingConnectionDisconnectedError();
          transport = null;
          reject(error);
        }
      });
    }).then(function createRoomSignalingSucceeded(roomSignaling) {
      if (isCanceled()) {
        peerConnectionManager.close();
        roomSignaling.disconnect();
        reject(cancellationError);
        return;
      }
      resolve(roomSignaling);
    }).catch(function onError(error) {
      if (transport) {
        transport.disconnect();
        transport = null;
      }
      peerConnectionManager.close();
      reject(error);
    });
  }, function onCancel() {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
  });
}

module.exports = createCancelableRoomSignalingPromise;
