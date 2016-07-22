'use strict';

var C = require('../../util/constants');
var CancelablePromise = require('../../util/cancelablepromise');
var PeerConnectionManager = require('./peerconnectionmanager');
var RoomV2 = require('./room');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

function createCancelableRoomSignalingPromise(accountSid, token, ua, localParticipant, options) {
  options = Object.assign({}, options);
  var session;

  var target = 'sip:' + util.makeSIPURI(accountSid, 'orchestrator');

  var extraHeaders = [
    C.headers.X_TWILIO_ACCESSTOKEN  + ': ' + token,
    'Session-Expires: 120'
  ];

  var peerConnectionManager = new PeerConnectionManager();
  var mediaStreams = new Set();
  localParticipant.tracks.forEach(function(track) {
    mediaStreams.add(track.mediaStream);
  });
  mediaStreams.forEach(peerConnectionManager.addStream, peerConnectionManager);

  var cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    peerConnectionManager.setConfiguration(options).then(function setConfigurationSucceeded() {
      if (isCanceled()) {
        throw cancelationError;
      }

      return new Promise(function createRoomSignaling(resolve, reject) {
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
            session.emit('info', request);
            request.reply(200);
          }
        });

        session.once('accepted', function accepted(response) {
          if (isCanceled()) {
            session.terminate();
            reject(cancelationError);
            return;
          }

          var roomState;
          try {
            roomState = JSON.parse(response.body);
          } catch (error) {
            reject(error);
          }

          var localParticipantState = roomState.participant;
          if (!localParticipantState) {
            reject(new Error('Missing LocalParticipant information'));
          }

          localParticipant.connect(localParticipantState.sid, localParticipantState.identity);

          var roomV2 = new RoomV2(localParticipant, roomState.sid, session, options);

          resolve(roomV2);
        });

        session.once('failed', function failed() {
          reject(new Error('Connect failed'));
        });
      });
    }).then(function createRoomSignalingSucceeded(roomSignaling) {
      if (isCanceled()) {
        roomSignaling.disconnect();
        throw cancelationError;
      }
      resolve(roomSignaling);
    }).catch(function onError(error) {
      peerConnectionManager.close();
      reject(error);
    });
  }, function onCancel() {
    if (session) {
      session.terminate();
    }
  });
}

module.exports = createCancelableRoomSignalingPromise;
