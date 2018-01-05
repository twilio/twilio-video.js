import { init } from '../../../lib/sdkdriver/src/browser';
import DMP, { DMPRequest } from '../../../lib/sdkdriver/src/dmp';

import {
  connect,
  createLocalTrack,
  createLocalTracks,
  disconnect,
  getStats
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
    }
  });
})();
