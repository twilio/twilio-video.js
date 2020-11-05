export class TwilioError extends Error {
  code: number;
  message: string;

  toString(): string;
}

export interface MediaConnectionError extends TwilioError {
  code: 53405;
  message: 'Media connection failed';
}

export interface SignalingConnectionDisconnectedError extends TwilioError {
  code: 53001;
  message: 'Signaling connection disconnected';
}
