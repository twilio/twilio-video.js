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

  const { PeerConnectionManager, RoomV2, Transport, iceServers } = options;
  const peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);
  const trackSenders = flatMap(localParticipant.tracks, trackV2 => [trackV2.trackTransceiver]);
  peerConnectionManager.setTrackSenders(trackSenders);

  const cancelationError = new Error('Canceled');

  let transport;

  return new CancelablePromise((resolve, reject, isCanceled) => {
    return new Promise((resolve, reject) => {
      const onIced = iceServers => {
        if (isCanceled()) {
          reject(cancelationError);
          return Promise.reject(cancelationError);
        }
        options.iceServers = iceServers;
        peerConnectionManager.setConfiguration(options);

        return peerConnectionManager.createAndOffer().then(() => {
          if (isCanceled()) {
            reject(cancelationError);
            throw cancelationError;
          }
          // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
          // initial offer in the event queue for the 'description' event. So,
          // we are dequeueing to prevent the spurious 'update' message sent by
          // the client after connecting to a room.
          peerConnectionManager.dequeue('description');
        }, reject);
      };

      const {
        InsightsPublisher,
        NullInsightsPublisher,
        automaticSubscription,
        bandwidthProfile,
        dominantSpeaker,
        environment,
        eventObserver,
        logLevel,
        name,
        networkMonitor,
        networkQuality,
        insights,
        realm,
        sdpSemantics,
        wsServerInsights
      } = options;

      const transportOptions = Object.assign({
        automaticSubscription,
        dominantSpeaker,
        environment,
        eventObserver,
        logLevel,
        networkMonitor,
        networkQuality,
        iceServers,
        insights,
        onIced,
        realm,
        sdpSemantics
      }, typeof wsServerInsights === 'string' ? {
        wsServerInsights
      } : {}, InsightsPublisher ? {
        InsightsPublisher
      } : {}, NullInsightsPublisher ? {
        NullInsightsPublisher
      } : {}, bandwidthProfile ? {
        bandwidthProfile
      } : {});

      transport = new Transport(
        name,
        token,
        localParticipant,
        peerConnectionManager,
        wsServer,
        transportOptions);

      transport.once('connected', initialState => {
        if (isCanceled()) {
          reject(cancelationError);
          return;
        }
        const { participant: localParticipantState } = initialState;
        if (!localParticipantState) {
          reject(new SignalingIncomingMessageInvalidError());
          return;
        }

        const { options: { signaling_region: signalingRegion } } = initialState;
        localParticipant.setSignalingRegion(signalingRegion);
        resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
      });

      transport.once('stateChanged', (state, error) => {
        if (state === 'disconnected') {
          transport = null;
          reject(error || new SignalingConnectionDisconnectedError());
        }
      });
    }).then(roomSignaling => {
      if (isCanceled()) {
        peerConnectionManager.close();
        roomSignaling.disconnect();
        reject(cancelationError);
        return;
      }
      resolve(roomSignaling);
    }).catch(error => {
      if (transport) {
        transport.disconnect();
        transport = null;
      }
      peerConnectionManager.close();
      reject(error);
    });
  }, () => {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
  });
}

module.exports = createCancelableRoomSignalingPromise;
