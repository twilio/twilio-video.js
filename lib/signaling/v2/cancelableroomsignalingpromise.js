'use strict';

const CancelablePromise = require('../../util/cancelablepromise');
const DefaultPeerConnectionManager = require('./peerconnectionmanager');
const DefaultRoomV2 = require('./room');
const DefaultTransport = require('./transport');
const SignalingConnectionDisconnectedError = require('../../util/twilio-video-errors').SignalingConnectionDisconnectedError;
const SignalingIncomingMessageInvalidError = require('../../util/twilio-video-errors').SignalingIncomingMessageInvalidError;
const flatMap = require('../../util').flatMap;

function createCancelableRoomSignalingPromise(token, ua, localParticipant, iceServerSource, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  if (options._sdpSemantics) {
    options.sdpSemantics = options._sdpSemantics;
  }

  let transport;

  const PeerConnectionManager = options.PeerConnectionManager;
  const RoomV2 = options.RoomV2;

  const peerConnectionManager = new PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options);

  const trackSenders = flatMap(localParticipant.tracks, trackV2 => [trackV2.trackTransceiver]);

  peerConnectionManager.setConfiguration(options);
  peerConnectionManager.setTrackSenders(trackSenders);

  const cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    peerConnectionManager.createAndOffer().then(function createAndOfferSucceeded() {
      // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
      // initial offer in the event queue for the 'description' event. So,
      // we are dequeueing to prevent the spurious 'update' message sent by
      // the client after connecting to a room.
      peerConnectionManager.dequeue('description');

      return new Promise((resolve, reject) => {
        if (isCanceled()) {
          reject(cancelationError);
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

        transportOptions = Object.assign({
          dominantSpeaker: options.dominantSpeaker,
          environment: options.environment,
          networkQuality: options.networkQuality,
          iceServerSourceStatus: iceServerSource.status,
          insights: options.insights,
          realm: options.realm,
          sdpSemantics: options.sdpSemantics
        }, transportOptions);

        const Transport = options.Transport;
        transport = new Transport(
          options.name,
          token,
          localParticipant,
          peerConnectionManager,
          ua,
          transportOptions);

        transport.once('connected', function connected(initialState) {
          if (isCanceled()) {
            reject(cancelationError);
            return;
          }

          const localParticipantState = initialState.participant;
          if (!localParticipantState) {
            reject(new SignalingIncomingMessageInvalidError());
            return;
          }

          resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
        });

        transport.once('stateChanged', function stateChanged(state, error) {
          if (state === 'disconnected') {
            error = error || new SignalingConnectionDisconnectedError();
            transport = null;
            reject(error);
          }
        });
      });
    }).then(function createRoomSignalingSucceeded(roomSignaling) {
      if (isCanceled()) {
        peerConnectionManager.close();
        roomSignaling.disconnect();
        reject(cancelationError);
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
