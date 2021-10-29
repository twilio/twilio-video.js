const TwilioConnection = require('../twilioconnection.js');
const { ICE_VERSION } = require('../util/constants');

import { RTCIceServer, RTCStats } from './rtctypes';
import { EventEmitter } from 'events';


export { RTCStats, RTCIceServer };
export function getTurnCredentials(token: string, wsServer: string): Promise<RTCIceServer[]> {
  return new Promise((resolve, reject) => {
    const eventObserver = new EventEmitter();
    const connectionOptions = {
      networkMonitor: null,
      eventObserver,
      helloBody: {
        edge: 'roaming', // roaming here means use same edge as signaling.
        preflight: true,
        token: token,
        type: 'ice',
        version: ICE_VERSION
      },
    };

    const twilioConnection = new TwilioConnection(wsServer, connectionOptions);
    let done = false;
    twilioConnection.once('close', (reason: string) => {
      if (!done) {
        done = true;
        reject(reason);
      }
    });

    // eslint-disable-next-line camelcase
    twilioConnection.on('message', (message: { type: string; ice_servers: RTCIceServer[]; }) => {
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

