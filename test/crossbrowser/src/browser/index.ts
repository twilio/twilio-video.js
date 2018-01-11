import { init } from '../../../lib/sdkdriver/src/browser';
import DMP, { DMPRequest } from '../../../lib/sdkdriver/src/dmp';

import {
  connect,
  createLocalTrack,
  createLocalTracks,
  disconnect,
  getStats,
  publishTrack,
  unpublishTrack
} from './api';

import { sendRoomEvents } from './events';

(async () => {
  const dmp: DMP = await init();
  dmp.on('request', async (request: DMPRequest) => {
    const { api, args, target } = request.data;
    switch (api) {
      case 'connect':
        request.sendResponse(await connect(args, sendRoomEvents.bind(null, dmp)));
        break;
      case 'createLocalTrack':
        request.sendResponse(await createLocalTrack(args));
        break;
      case 'createLocalTracks':
        request.sendResponse(await createLocalTracks(args));
        break;
      case 'disconnect':
        request.sendResponse(disconnect(target));
        break;
      case 'getStats':
        request.sendResponse(await getStats(target));
        break;
      case 'publishTrack':
        request.sendResponse(await publishTrack(target, args));
        break;
      case 'unpublishTrack':
        request.sendResponse(unpublishTrack(target, args));
        break;
      /*case 'publishTracks':
        request.sendResponse(await publishTracks(target, args));
        break;
      case 'setParameters':
        request.sendResponse(setParameters(target, args));
        break;
      case 'unpublishTracks':
        request.sendResponse(await unpublishTracks(target, args));
        break;*/
    }
  });
})();
