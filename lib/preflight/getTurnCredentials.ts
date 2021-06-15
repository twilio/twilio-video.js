/* eslint-disable no-console */
const TwilioConnection = require('../twilioconnection.js');
const { WS_SERVER, ICE_VERSION } = require('../util/constants');

import { RTCIceServer, RTCStats } from './rtctypes';
export { RTCStats, RTCIceServer };

import { EventEmitter } from 'events';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PreflightOptions } from '../../tsdef/PreflightTypes';


export function getTurnCredentials(token: string, options: PreflightOptions): Promise<RTCIceServer[]> {
  return new Promise((resolve, reject) => {
    options = Object.assign({
      environment: 'prod',
      region: 'gll',
    }, options);
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

    /* eslint new-cap:0 */
    const twilioConnection = new TwilioConnection(wsServer, connectionOptions);
    let done = false;
    twilioConnection.once('close', (reason: string) => {
      console.log('got closed: done = ', done);
      if (!done) {
        done = true;
        reject(reason);
      }
    });

    // eslint-disable-next-line camelcase
    twilioConnection.on('message', (message: { type: string; ice_servers: RTCIceServer[]; }) => {
      console.log('received message of type: ', message.type, message);
      if (message.type === 'iced') {
        console.log('Got Ice Servers:', message.ice_servers);
        if (!done) {
          done = true;
          resolve(message.ice_servers);
          twilioConnection.close();
        }
      }
    });
  });
}

