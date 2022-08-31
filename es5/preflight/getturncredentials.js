"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTurnCredentials = void 0;
/* eslint-disable camelcase */
var TwilioConnection = require('../twilioconnection.js');
var ICE_VERSION = require('../util/constants').ICE_VERSION;
var _a = require('../util/twilio-video-errors'), createTwilioError = _a.createTwilioError, SignalingConnectionError = _a.SignalingConnectionError;
var events_1 = require("events");
function getTurnCredentials(token, wsServer) {
    return new Promise(function (resolve, reject) {
        var eventObserver = new events_1.EventEmitter();
        var connectionOptions = {
            networkMonitor: null,
            eventObserver: eventObserver,
            helloBody: {
                edge: 'roaming',
                preflight: true,
                token: token,
                type: 'ice',
                version: ICE_VERSION
            },
        };
        var twilioConnection = new TwilioConnection(wsServer, connectionOptions);
        var done = false;
        twilioConnection.once('close', function () {
            if (!done) {
                done = true;
                reject(new SignalingConnectionError());
            }
        });
        twilioConnection.on('message', function (messageData) {
            var code = messageData.code, message = messageData.message, ice_servers = messageData.ice_servers, type = messageData.type;
            if ((type === 'iced' || type === 'error') && !done) {
                done = true;
                if (type === 'iced') {
                    resolve(ice_servers);
                }
                else {
                    reject(createTwilioError(code, message));
                }
                twilioConnection.close();
            }
        });
    });
}
exports.getTurnCredentials = getTurnCredentials;
//# sourceMappingURL=getturncredentials.js.map