'use strict';

var C = require('../../util/constants');
var CancelablePromise = require('../../util/cancelablepromise');
var DefaultPeerConnectionManager = require('./peerconnectionmanager');
var DefaultRoomV2 = require('./room');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var Transport = require('./transport');
var util = require('../../util');

function createCancelableRoomSignalingPromise(accountSid, token, ua, localParticipant, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2
  }, options);

  var transport;

  var target = 'sip:' + util.makeSIPURI(accountSid, 'orchestrator');

  var extraHeaders = [
    C.headers.X_TWILIO_ACCESSTOKEN  + ': ' + token,
    'Session-Expires: 120'
  ];

  var PeerConnectionManager = options.PeerConnectionManager;
  var RoomV2 = options.RoomV2;

  var peerConnectionManager = new PeerConnectionManager();
  peerConnectionManager.setConfiguration(options);
  var mediaStreams = new Set();
  localParticipant.tracks.forEach(function(track) {
    mediaStreams.add(track.mediaStream);
  });
  mediaStreams.forEach(peerConnectionManager.addMediaStream, peerConnectionManager);

  var cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    peerConnectionManager.createAndOffer().then(function createAndOfferSucceeded() {
      return new Promise(function(resolve, reject) {
        if (isCanceled()) {
          reject(cancelationError);
          return;
        }

        var session = ua.invite(target, {
          extraHeaders: extraHeaders,
          media: { stream: {} },
          mediaHandlerFactory: function mediaHandlerFactory() {
            return new SIPJSMediaHandler(peerConnectionManager, function createConnectMessage() {
              return {
                create: options.create,
                name: options.to,
                participant: localParticipant.getState(),
                type: 'connect',
                version: 1
              };
            });
          },
          infoHandler: function infoHandler(request) {
            this.emit('info', request);
            request.reply(200);
          }
        });

        transport = new Transport(session, options);

        transport.once('connected', function connected(initialState) {
          if (isCanceled()) {
            reject(cancelationError);
            return;
          }

          var localParticipantState = initialState.participant;
          if (!localParticipantState) {
            reject(new Error('Missing LocalParticipant information'));
            return;
          }

          localParticipant.connect(localParticipantState.sid, localParticipantState.identity);

          resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
        });

        transport.once('stateChanged', function stateChanged(state) {
          if (state === 'disconnected') {
            reject(new Error('Connect failed'));
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
      }
      peerConnectionManager.close();
      reject(error);
    });
  }, function onCancel() {
    if (transport) {
      transport.disconnect();
    }
  });
}

module.exports = createCancelableRoomSignalingPromise;
