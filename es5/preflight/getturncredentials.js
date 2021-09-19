"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTurnCredentials = void 0;
var TwilioConnection = require('../twilioconnection.js');
var _a = require('../util/constants'), WS_SERVER = _a.WS_SERVER, ICE_VERSION = _a.ICE_VERSION;
var events_1 = require("events");
function getTurnCredentials(token, options) {
    return new Promise(function (resolve, reject) {
        options = __assign({ environment: 'prod', region: 'gll' }, options);
        // eslint-disable-next-line new-cap
        var wsServer = WS_SERVER(options.environment, options.region);
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