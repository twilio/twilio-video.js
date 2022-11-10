'use strict';
var CancelablePromise = require('../../util/cancelablepromise');
var DefaultPeerConnectionManager = require('./peerconnectionmanager');
var DefaultRoomV2 = require('./room');
var DefaultTransport = require('./twilioconnectiontransport');
var _a = require('../../util/twilio-video-errors'), SignalingConnectionDisconnectedError = _a.SignalingConnectionDisconnectedError, SignalingIncomingMessageInvalidError = _a.SignalingIncomingMessageInvalidError;
var _b = require('../../util'), flatMap = _b.flatMap, createRoomConnectEventPayload = _b.createRoomConnectEventPayload;
function createCancelableRoomSignalingPromise(token, wsServer, localParticipant, encodingParameters, preferredCodecs, options) {
    options = Object.assign({
        PeerConnectionManager: DefaultPeerConnectionManager,
        RoomV2: DefaultRoomV2,
        Transport: DefaultTransport
    }, options);
    var adaptiveSimulcast = preferredCodecs.video[0] && preferredCodecs.video[0].adaptiveSimulcast === true;
    var PeerConnectionManager = options.PeerConnectionManager, RoomV2 = options.RoomV2, Transport = options.Transport, iceServers = options.iceServers, log = options.log;
    var peerConnectionManager = new PeerConnectionManager(encodingParameters, preferredCodecs, options);
    var trackSenders = flatMap(localParticipant.tracks, function (trackV2) { return [trackV2.trackTransceiver]; });
    peerConnectionManager.setTrackSenders(trackSenders);
    var cancellationError = new Error('Canceled');
    var transport;
    var cancelablePromise = new CancelablePromise(function (resolve, reject, isCanceled) {
        var onIced = function (iceServers) {
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
        var automaticSubscription = options.automaticSubscription, bandwidthProfile = options.bandwidthProfile, dominantSpeaker = options.dominantSpeaker, environment = options.environment, eventObserver = options.eventObserver, loggerName = options.loggerName, logLevel = options.logLevel, name = options.name, networkMonitor = options.networkMonitor, networkQuality = options.networkQuality, notifyWarnings = options.notifyWarnings, realm = options.realm, sdpSemantics = options.sdpSemantics;
        // decide which msp channels to request
        // dominantSpeaker, networkQuality
        var trackPriority = !!bandwidthProfile;
        var trackSwitchOff = !!bandwidthProfile;
        var renderHints = !!bandwidthProfile &&
            (options.clientTrackSwitchOffControl !== 'disabled' || options.contentPreferencesMode !== 'disabled');
        var transportOptions = Object.assign({
            adaptiveSimulcast: adaptiveSimulcast,
            automaticSubscription: automaticSubscription,
            dominantSpeaker: dominantSpeaker,
            environment: environment,
            eventObserver: eventObserver,
            loggerName: loggerName,
            logLevel: logLevel,
            networkMonitor: networkMonitor,
            networkQuality: networkQuality,
            notifyWarnings: notifyWarnings,
            iceServers: iceServers,
            onIced: onIced,
            realm: realm,
            renderHints: renderHints,
            sdpSemantics: sdpSemantics,
            trackPriority: trackPriority,
            trackSwitchOff: trackSwitchOff
        }, bandwidthProfile ? {
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
            resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
        });
        transport.once('stateChanged', function (state, error) {
            if (state === 'disconnected') {
                transport = null;
                reject(error || new SignalingConnectionDisconnectedError());
            }
            else {
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
//# sourceMappingURL=cancelableroomsignalingpromise.js.map