"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTurnCredentials = void 0;
var TwilioConnection = require('../twilioconnection.js');
var ICE_VERSION = require('../util/constants').ICE_VERSION;
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
        twilioConnection.once('close', function (reason) {
            if (!done) {
                done = true;
                reject(reason);
            }
        });
        // eslint-disable-next-line camelcase
        twilioConnection.on('message', function (message) {
            if (message.type === 'iced') {
                if (!done) {
                    done = true;
                    resolve(message.ice_servers);
                    twilioConnection.close();
                }
            }
        });
    });
}
exports.getTurnCredentials = getTurnCredentials;
//# sourceMappingURL=getturncredentials.js.map