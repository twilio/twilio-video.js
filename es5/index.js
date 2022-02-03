'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var preflighttest_1 = require("./preflight/preflighttest");
var internals = {
    connect: require('./connect'),
    createLocalAudioTrack: require('./createlocaltrack').audio,
    createLocalTracks: require('./createlocaltracks'),
    createLocalVideoTrack: require('./createlocaltrack').video,
    isSupported: require('./util/support')(),
    version: require('../package.json').version,
    Logger: require('./vendor/loglevel'),
    LocalAudioTrack: require('./media/track/es5').LocalAudioTrack,
    LocalDataTrack: require('./media/track/es5').LocalDataTrack,
    LocalVideoTrack: require('./media/track/es5').LocalVideoTrack
};
function connect(token, options) {
    return internals.connect(token, options);
}
function createLocalAudioTrack(options) {
    return internals.createLocalAudioTrack(options);
}
function createLocalTracks(options) {
    return internals.createLocalTracks(options);
}
function createLocalVideoTrack(options) {
    return internals.createLocalVideoTrack(options);
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
    createLocalTracks: createLocalTracks,
    createLocalVideoTrack: createLocalVideoTrack,
    runPreflight: preflighttest_1.runPreflight,
    isSupported: isSupported,
    version: version,
    Logger: Logger,
    LocalAudioTrack: LocalAudioTrack,
    LocalVideoTrack: LocalVideoTrack,
    LocalDataTrack: LocalDataTrack
};
//# sourceMappingURL=index.js.map