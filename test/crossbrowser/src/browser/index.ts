import { init } from '../../../lib/sdkdriver/src/browser';
import DMP, { DMPRequest } from '../../../lib/sdkdriver/src/dmp';

import {
  connect,
  createLocalTrack,
  createLocalTracks,
  disable,
  disconnect,
  enable,
  getStats,
  publishTrack,
  publishTracks,
  send,
  setParameters,
  stop,
  unpublish,
  unpublishTrack,
  unpublishTracks
} from './api';

import {
  sendLocalTrackEvents,
  sendRoomEvents
} from './events';

(async () => {
  const dmp: DMP = await init();
  dmp.on('request', async (request: DMPRequest) => {
    const { api, args, target } = request.data;
    switch (api) {
      case 'connect':
        request.sendResponse(await connect(args, sendRoomEvents.bind(null, dmp)));
        break;
      case 'createLocalTrack':
        request.sendResponse(await createLocalTrack(args, sendLocalTrackEvents.bind(null, dmp)));
        break;
      case 'createLocalTracks':
        request.sendResponse(await createLocalTracks(args, sendLocalTrackEvents.bind(null, dmp)));
        break;
      case 'disable':
        request.sendResponse(disable(target));
        break;
      case 'disconnect':
        request.sendResponse(disconnect(target));
        break;
      case 'enable':
        request.sendResponse(enable(target, args));
        break;
      case 'getStats':
        request.sendResponse(await getStats(target));
        break;
      case 'publishTrack':
        request.sendResponse(await publishTrack(target, args));
        break;
      case 'publishTracks':
        request.sendResponse(await publishTracks(target, args));
        break;
      case 'send':
        request.sendResponse(send(target, args));
        break;
      case 'setParameters':
        request.sendResponse(setParameters(target, args));
        break;
      case 'stop':
        request.sendResponse(stop(target));
        break;
      case 'unpublish':
        request.sendResponse(unpublish(target));
        break;
      case 'unpublishTrack':
        request.sendResponse(unpublishTrack(target, args));
        break;
      case 'unpublishTracks':
        request.sendResponse(unpublishTracks(target, args));
        break;
    }
  });
})();
