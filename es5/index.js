'use strict';
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
var createlocaltracks_1 = require("./createlocaltracks");
var preflighttest_1 = require("./preflight/preflighttest");
var internals = {
    connect: require('./connect'),
    createLocalAudioTrack: require('./createlocaltrack').audio,
    createLocalVideoTrack: require('./createlocaltrack').video,
    isSupported: require('./util/support')(),
    version: require('../package.json').version,
    Logger: require('./vendor/loglevel'),
    LocalAudioTrack: require('./media/track/es5').LocalAudioTrack,
    LocalDataTrack: require('./media/track/es5').LocalDataTrack,
    LocalVideoTrack: require('./media/track/es5').LocalVideoTrack
};
function connect(token, options) {
    var internalOptions = __assign({ createLocalTracks: createlocaltracks_1.createLocalTracks }, options);
    return internals.connect(token, internalOptions);
}
function createLocalAudioTrack(options) {
    var internalOptions = __assign({ createLocalTracks: createlocaltracks_1.createLocalTracks }, options);
    return internals.createLocalAudioTrack(internalOptions);
}
function createLocalVideoTrack(options) {
    var internalOptions = __assign({ createLocalTracks: createlocaltracks_1.createLocalTracks }, options);
    return internals.createLocalVideoTrack(internalOptions);
}
/**
 * @module twilio-video
 * @property {boolean} isSupported - true if the current browser is officially
 *   supported by twilio-video.js; In this context, "supported" means that
 *   twilio-video.js has been extensively tested with this browser; This
 *   <a href="https://www.twilio.com/docs/video/javascript#supported-browsers" target="_blank">table</a>
 *   specifies the list of officially supported browsers.
 *
 * @property {object} Logger - The <a href="https://www.npmjs.com/package/loglevel" target="_blank">loglevel</a>
 *    module used by the SDK. Use this object to access the internal loggers and perform actions as defined by the
 *   <a href="https://www.npmjs.com/package/loglevel" target="_blank">loglevel</a> APIs.
 *   See [connect](#.connect) for examples.
 *
 * @property {string} version - current version of twilio-video.js.
 */
var isSupported = internals.isSupported;
var version = internals.version;
var Logger = internals.Logger;
var LocalAudioTrack = internals.LocalAudioTrack;
var LocalVideoTrack = internals.LocalVideoTrack;
var LocalDataTrack = internals.LocalDataTrack;
module.exports = {
    connect: connect,
    createLocalAudioTrack: createLocalAudioTrack,
    createLocalVideoTrack: createLocalVideoTrack,
    createLocalTracks: createlocaltracks_1.createLocalTracks,
    runPreflight: preflighttest_1.runPreflight,
    isSupported: isSupported,
    version: version,
    Logger: Logger,
    LocalAudioTrack: LocalAudioTrack,
    LocalVideoTrack: LocalVideoTrack,
    LocalDataTrack: LocalDataTrack,
};
//# sourceMappingURL=index.js.map