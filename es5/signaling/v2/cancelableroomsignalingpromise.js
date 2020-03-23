'use strict';

var CancelablePromise = require('../../util/cancelablepromise');
var DefaultPeerConnectionManager = require('./peerconnectionmanager');
var DefaultRoomV2 = require('./room');
var DefaultTransport = require('./twilioconnectiontransport');

var _require = require('../../util/twilio-video-errors'),
    SignalingConnectionDisconnectedError = _require.SignalingConnectionDisconnectedError,
    SignalingIncomingMessageInvalidError = _require.SignalingIncomingMessageInvalidError;

var _require2 = require('../../util'),
    flatMap = _require2.flatMap,
    waitForEvent = _require2.waitForEvent;

function createCancelableRoomSignalingPromise(token, wsServer, localParticipant, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  var transport = void 0;
  var finalError = void 0;
  var log = options.log;

  var PeerConnectionManager = options.PeerConnectionManager;
  var RoomV2 = options.RoomV2;
  var peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);
  var trackSenders = flatMap(localParticipant.tracks, function (trackV2) {
    return [trackV2.trackTransceiver];
  });

  return new CancelablePromise(function onCreate(resolve, reject) {
    var transportOptions = typeof options.wsServerInsights === 'string' ? { wsServerInsights: options.wsServerInsights } : {};

    if (options.InsightsPublisher) {
      transportOptions.InsightsPublisher = options.InsightsPublisher;
    }

    if (options.NullInsightsPublisher) {
      transportOptions.NullInsightsPublisher = options.NullInsightsPublisher;
    }

    if (options.bandwidthProfile) {
      transportOptions.bandwidthProfile = options.bandwidthProfile;
    }

    var iceServers = Array.isArray(options.iceServers) ? options.iceServers : null;
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

    var Transport = options.Transport;
    transport = new Transport(options.name, token, localParticipant, peerConnectionManager, wsServer, transportOptions);

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

    var connectedPromise = waitForEvent(transport, 'connected');
    var ensureIceServers = iceServers ? Promise.resolve(iceServers) : waitForEvent(transport, 'iced');
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

      var localParticipantState = initialState.participant;
      if (!localParticipantState) {
        throw new SignalingIncomingMessageInvalidError();
      }

      localParticipant.setSignalingRegion(initialState.options.signaling_region);
      var roomSignaling = new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options);
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