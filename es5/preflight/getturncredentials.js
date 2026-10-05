"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTurnCredentials = getTurnCredentials;
/* eslint-disable camelcase */
const TwilioConnection = require('../twilioconnection.js');
const { ICE_VERSION } = require('../util/constants');
const { createTwilioError, SignalingConnectionError } = require('../util/twilio-video-errors');
const events_1 = require("events");
function getTurnCredentials(token, wsServer) {
    return new Promise((resolve, reject) => {
        const eventObserver = new events_1.EventEmitter();
        const connectionOptions = {
            networkMonitor: null,
            eventObserver,
            helloBody: {
                edge: 'roaming', // roaming here means use same edge as signaling.
                preflight: true,
                token: token,
                type: 'ice',
                version: ICE_VERSION
            },
        };
        const twilioConnection = new TwilioConnection(wsServer, connectionOptions);
        let done = false;
        twilioConnection.once('close', () => {
            if (!done) {
                done = true;
                reject(new SignalingConnectionError());
            }
        });
        twilioConnection.on('message', (messageData) => {
            const { code, message, ice_servers, type } = messageData;
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
//# sourceMappingURL=getturncredentials.js.map