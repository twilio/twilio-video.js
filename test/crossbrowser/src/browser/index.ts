import { init } from '../../../lib/sdkdriver/src/browser';
import DMP, { DMPRequest } from '../../../lib/sdkdriver/src/dmp';
import { connect, createLocalTrack, createLocalTracks } from './api';
import { serializeLocalTrack, serializeRoom } from './serialize';

(async () => {
  const dmp: DMP = await init();
  dmp.on('request', async (request: DMPRequest) => {
    const { api, args } = request.data;
    switch (api) {
      case 'connect':
        request.sendResponse(await connect(args, serializeRoom));
        break;
      case 'createLocalTrack':
        request.sendResponse(await createLocalTrack(args, serializeLocalTrack));
        break;
      case 'createLocalTracks':
        request.sendResponse(await createLocalTracks(args, serializeLocalTrack));
        break;
    }
  });
})();
