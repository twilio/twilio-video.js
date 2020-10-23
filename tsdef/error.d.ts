import { TwilioError } from './TwilioError';

export class MediaConnectionError extends TwilioError {
  code: 53405;
  message: 'Media connection failed';
}

export class SignalingConnectionDisconnectedError extends TwilioError {
  code: 53001;
  message: 'Signaling connection disconnected';
}
