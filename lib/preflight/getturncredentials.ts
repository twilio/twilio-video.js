/* eslint-disable camelcase */
const TwilioConnection = require('../twilioconnection.js');
const { ICE_VERSION } = require('../util/constants');
const { createTwilioError, SignalingConnectionError } = require('../util/twilio-video-errors');

import type { RTCIceServer, RTCStats } from './rtctypes';
import { EventEmitter } from 'events';


export type { RTCStats, RTCIceServer };

export interface TurnCredentials {
  iceServers: RTCIceServer[];
  selectedEdge?: string;
}

export function extractEdgeFromIceServers(iceServers: RTCIceServer[]): string | undefined {
  // TURN URLs have the format turn:<hostname>:<port>?transport=<protocol>
  // The URL API cannot parse turn: scheme, so use string parsing instead.
  for (const server of iceServers) {
    const urls = ([] as string[]).concat(server.urls);
    const turnUrl = urls.find(u => /^turns?:/.test(u));
    if (!turnUrl) {
      continue;
    }
    const withoutScheme = turnUrl.replace(/^turns?:/, '');
    const hostname = withoutScheme.split(':')[0];
    const edge = hostname.split('.')[0];
    if (edge) {
      return edge;
    }
  }
  return undefined;
}

export function getTurnCredentials(token: string, wsServer: string): Promise<TurnCredentials> {
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
    twilioConnection.once('close', () => {
      if (!done) {
        done = true;
        reject(new SignalingConnectionError());
      }
    });

    twilioConnection.on('message', (messageData: {
      code: number;
      message: string;
      ice_servers: RTCIceServer[];
      type: string;
    }) => {
      const { code, message, ice_servers, type } = messageData;
      if ((type === 'iced' || type === 'error') && !done) {
        done = true;
        if (type === 'iced') {
          resolve({
            iceServers: ice_servers,
            selectedEdge: extractEdgeFromIceServers(ice_servers),
          });
        } else {
          reject(createTwilioError(code, message));
        }
        twilioConnection.close();
      }
    });
  });
}

