'use strict';

import type { ConnectOptions, CreateLocalTrackOptions, CreateLocalAudioTrackOptions } from '../tsdef/types';
import type { LocalAudioTrack as LocalAudioTrackType } from '../tsdef/LocalAudioTrack';
import type { LocalVideoTrack as LocalVideoTrackType } from '../tsdef/LocalVideoTrack';
import type { Log } from '../tsdef/loglevel';
import type { Room } from '../tsdef/Room';
import { createLocalTracks } from './createlocaltracks';
import { runPreflight } from './preflight/preflighttest';


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

function connect(token: string, options?: ConnectOptions): Promise<Room> {
  const internalOptions = {
    createLocalTracks,
    ...options
  };
  return internals.connect(token, internalOptions);
}

function createLocalAudioTrack(options?: CreateLocalTrackOptions|CreateLocalAudioTrackOptions): Promise<LocalAudioTrackType> {
  const internalOptions = {
    createLocalTracks,
    ...options
  };
  return internals.createLocalAudioTrack(internalOptions);
}

function createLocalVideoTrack(options?: CreateLocalTrackOptions): Promise<LocalVideoTrackType> {
  const internalOptions = {
    createLocalTracks,
    ...options
  };
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

const isSupported: boolean = internals.isSupported;
const version: boolean = internals.version;
const Logger: Log.RootLogger = internals.Logger;
const LocalAudioTrack = internals.LocalAudioTrack;
const LocalVideoTrack = internals.LocalVideoTrack;
const LocalDataTrack = internals.LocalDataTrack;

module.exports = {
  connect,
  createLocalAudioTrack,
  createLocalVideoTrack,
  createLocalTracks,
  runPreflight,
  isSupported,
  version,
  Logger,
  LocalAudioTrack,
  LocalVideoTrack,
  LocalDataTrack,
};
