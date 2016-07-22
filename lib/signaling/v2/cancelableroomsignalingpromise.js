'use strict';

var C = require('../../util/constants');
var CancelablePromise = require('../../util/cancelablepromise');
var headers = require('../../util/constants').headers;
var PeerConnectionManager = require('./peerconnectionmanager');
var RoomV2 = require('./room');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

function createCancelableRoomSignalingPromise(accountSid, token, ua, identities, nameOrSid, localParticipant, options) {
  options = Object.assign({}, options);
  var session;

  var addresses = identities.map(function(identity) {
    return 'sip:' + util.makeSIPURI(accountSid, identity);
  });

  var target = 'sip:' + util.makeSIPURI(accountSid, 'orchestrator');

  var extraHeaders = [
    C.headers.X_TWILIO_ACCESSTOKEN  + ': ' + token,
    C.headers.X_TWILIO_CLIENT       + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_PARTICIPANTS + ': ' + addresses.join(',') + (nameOrSid ? ';label=' + nameOrSid : ''),
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
            return new SIPJSMediaHandler(peerConnectionManager);
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

          var participantInfo = response.getHeader(headers.X_TWILIO_PARTICIPANTSID);
          participantInfo = participantInfo ? participantInfo.split(';') : null;
          var participantSid = participantInfo ? participantInfo[0] : null;
          var roomSid = util.parseRoomSIDFromContactHeader(response.getHeader('Contact'));
          var identity = util.getUser(response.getHeader('From'));

          localParticipant.connect(participantSid, identity);

          var roomV2 = new RoomV2(localParticipant, roomSid, session, options);

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
