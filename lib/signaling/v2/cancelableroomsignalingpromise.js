'use strict';

var C = require('../../util/constants');
var CancelablePromise = require('../../util/cancelablepromise');
var DefaultPeerConnectionManager = require('./peerconnectionmanager');
var DefaultRoomV2 = require('./room');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

function createCancelableRoomSignalingPromise(accountSid, token, ua, localParticipant, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2
  }, options);

  var session;

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

        session = ua.invite(target, {
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

        session.once('accepted', function accepted(response) {
          if (isCanceled()) {
            reject(cancelationError);
            return;
          }

          var roomState;
          try {
            roomState = JSON.parse(response.body);
          } catch (error) {
            reject(error);
            return;
          }

          var localParticipantState = roomState.participant;
          if (!localParticipantState) {
            reject(new Error('Missing LocalParticipant information'));
            return;
          }

          localParticipant.connect(localParticipantState.sid, localParticipantState.identity);

          resolve(new RoomV2(localParticipant, roomState, session, options));
          session = null;
        });

        session.once('failed', function failed() {
          reject(new Error('Connect failed'));
          session = null;
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
      if (session) {
        session.terminate({
          body: util.constants.RSP.DISCONNECT_BODY,
          extraHeaders: [
            'Content-Type: application/room-signaling+json'
          ]
        });
        session = null;
      }
      peerConnectionManager.close();
      reject(error);
    });
  }, function onCancel() {
    if (session) {
      session.terminate({
        body: util.constants.RSP.DISCONNECT_BODY,
        extraHeaders: [
          'Content-Type: application/room-signaling+json'
        ]
      });
      session = null;
    }
  });
}

module.exports = createCancelableRoomSignalingPromise;
