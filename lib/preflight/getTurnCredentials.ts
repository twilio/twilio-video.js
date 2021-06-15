const TwilioConnection = require('../twilioconnection.js');
const { WS_SERVER, ICE_VERSION } = require('../util/constants');

import { RTCIceServer, RTCStats } from './rtctypes';
export { RTCStats, RTCIceServer };

import { EventEmitter } from 'events';
import { PreflightOptions } from '../../tsdef/PreflightTypes';


export function getTurnCredentials(token: string, options: PreflightOptions): Promise<RTCIceServer[]> {
  return new Promise((resolve, reject) => {
    options = Object.assign({
      environment: 'prod',
      region: 'gll',
    }, options);

    // eslint-disable-next-line new-cap
    const wsServer = WS_SERVER(options.environment, options.region);

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

