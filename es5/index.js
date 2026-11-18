'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const createlocaltracks_1 = require("./createlocaltracks");
const preflighttest_1 = require("./preflight/preflighttest");
const internals = {
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
    const internalOptions = Object.assign({ createLocalTracks: createlocaltracks_1.createLocalTracks }, options);
    return internals.connect(token, internalOptions);
}
function createLocalAudioTrack(options) {
    const internalOptions = Object.assign({ createLocalTracks: createlocaltracks_1.createLocalTracks }, options);
    return internals.createLocalAudioTrack(internalOptions);
}
function createLocalVideoTrack(options) {
    const internalOptions = Object.assign({ createLocalTracks: createlocaltracks_1.createLocalTracks }, options);
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
const isSupported = internals.isSupported;
const version = internals.version;
const Logger = internals.Logger;
const LocalAudioTrack = internals.LocalAudioTrack;
const LocalVideoTrack = internals.LocalVideoTrack;
const LocalDataTrack = internals.LocalDataTrack;
module.exports = {
    connect,
    createLocalAudioTrack,
    createLocalVideoTrack,
    createLocalTracks: createlocaltracks_1.createLocalTracks,
    runPreflight: preflighttest_1.runPreflight,
    isSupported,
    version,
    Logger,
    LocalAudioTrack,
    LocalVideoTrack,
    LocalDataTrack,
};
//# sourceMappingURL=index.js.map