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
    createRoomConnectEventPayload = _require2.createRoomConnectEventPayload;

function createCancelableRoomSignalingPromise(token, wsServer, localParticipant, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  var _options = options,
      PeerConnectionManager = _options.PeerConnectionManager,
      RoomV2 = _options.RoomV2,
      Transport = _options.Transport,
      iceServers = _options.iceServers,
      log = _options.log;

  var peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);
  var trackSenders = flatMap(localParticipant.tracks, function (trackV2) {
    return [trackV2.trackTransceiver];
  });
  peerConnectionManager.setTrackSenders(trackSenders);

  var cancellationError = new Error('Canceled');

  var transport = void 0;

  var cancelablePromise = new CancelablePromise(function (resolve, reject, isCanceled) {
    var onIced = function onIced(iceServers) {
      if (isCanceled()) {
        reject(cancellationError);
        return Promise.reject(cancellationError);
      }
      log.debug('Got ICE servers:', iceServers);
      options.iceServers = iceServers;
      peerConnectionManager.setConfiguration(options);

      return peerConnectionManager.createAndOffer().then(function () {
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
      }).catch(function (error) {
        log.error('createAndOffer() failed:', error);
        reject(error);
        throw error;
      });
    };

    var _options2 = options,
        InsightsPublisher = _options2.InsightsPublisher,
        NullInsightsPublisher = _options2.NullInsightsPublisher,
        automaticSubscription = _options2.automaticSubscription,
        bandwidthProfile = _options2.bandwidthProfile,
        dominantSpeaker = _options2.dominantSpeaker,
        environment = _options2.environment,
        eventObserver = _options2.eventObserver,
        loggerName = _options2.loggerName,
        logLevel = _options2.logLevel,
        name = _options2.name,
        networkMonitor = _options2.networkMonitor,
        networkQuality = _options2.networkQuality,
        insights = _options2.insights,
        realm = _options2.realm,
        sdpSemantics = _options2.sdpSemantics,
        wsServerInsights = _options2.wsServerInsights;


    var transportOptions = Object.assign({
      automaticSubscription: automaticSubscription,
      dominantSpeaker: dominantSpeaker,
      environment: environment,
      eventObserver: eventObserver,
      loggerName: loggerName,
      logLevel: logLevel,
      networkMonitor: networkMonitor,
      networkQuality: networkQuality,
      iceServers: iceServers,
      insights: insights,
      onIced: onIced,
      realm: realm,
      sdpSemantics: sdpSemantics
    }, typeof wsServerInsights === 'string' ? {
      wsServerInsights: wsServerInsights
    } : {}, InsightsPublisher ? {
      InsightsPublisher: InsightsPublisher
    } : {}, NullInsightsPublisher ? {
      NullInsightsPublisher: NullInsightsPublisher
    } : {}, bandwidthProfile ? {
      bandwidthProfile: bandwidthProfile
    } : {});

    transport = new Transport(name, token, localParticipant, peerConnectionManager, wsServer, transportOptions);

    var connectEventPayload = createRoomConnectEventPayload(options);
    eventObserver.emit('event', connectEventPayload);

    transport.once('connected', function (initialState) {
      log.debug('Transport connected:', initialState);
      if (isCanceled()) {
        reject(cancellationError);
        return;
      }
      var localParticipantState = initialState.participant;

      if (!localParticipantState) {
        reject(new SignalingIncomingMessageInvalidError());
        return;
      }

      var signalingRegion = initialState.options.signaling_region;

      localParticipant.setSignalingRegion(signalingRegion);
      resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
    });

    transport.once('stateChanged', function (state, error) {
      if (state === 'disconnected') {
        transport = null;
        reject(error || new SignalingConnectionDisconnectedError());
      } else {
        log.debug('Transport state changed:', state);
      }
    });
  }, function () {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
  });

  cancelablePromise.catch(function () {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
    peerConnectionManager.close();
  });

  return cancelablePromise;
}

module.exports = createCancelableRoomSignalingPromise;