'use strict';

var CancelablePromise = require('../../util/cancelablepromise');
var DefaultPeerConnectionManager = require('./peerconnectionmanager');
var DefaultRoomV2 = require('./room');
var DefaultTransport = require('./transport');
var SignalingConnectionDisconnectedError = require('../../util/twilio-video-errors').SignalingConnectionDisconnectedError;
var SignalingIncomingMessageInvalidError = require('../../util/twilio-video-errors').SignalingIncomingMessageInvalidError;
var flatMap = require('../../util').flatMap;

function createCancelableRoomSignalingPromise(token, ua, localParticipant, iceServerSource, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  var transport;

  var PeerConnectionManager = options.PeerConnectionManager;
  var RoomV2 = options.RoomV2;

  var peerConnectionManager = new PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options);

  var trackSenders = flatMap(localParticipant.tracks, function(trackV2) {
    return [trackV2.trackTransceiver];
  });

  peerConnectionManager.setConfiguration(options);
  peerConnectionManager.setTrackSenders(trackSenders);

  var cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    peerConnectionManager.createAndOffer().then(function createAndOfferSucceeded() {
      // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
      // initial offer in the event queue for the 'description' event. So,
      // we are dequeueing to prevent the spurious 'update' message sent by
      // the client after connecting to a room.
      peerConnectionManager.dequeue('description');

      return new Promise(function(resolve, reject) {
        if (isCanceled()) {
          reject(cancelationError);
          return;
        }

        var transportOptions = typeof options.wsServerInsights === 'string'
          ? { wsServerInsights: options.wsServerInsights }
          : {};

        if (options.InsightsPublisher) {
          transportOptions.InsightsPublisher = options.InsightsPublisher;
        }

        if (options.NullInsightsPublisher) {
          transportOptions.NullInsightsPublisher = options.NullInsightsPublisher;
        }

        transportOptions = Object.assign({
          environment: options.environment,
          insights: options.insights,
          realm: options.realm
        }, transportOptions);

        var Transport = options.Transport;
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

          var localParticipantState = initialState.participant;
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
