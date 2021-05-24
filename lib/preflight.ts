// TODO: Delete this. For demo only between ts and js
const { DEFAULT_ENVIRONMENT } = require('./util/constants');

/**
 * A {@link Preflight} represents the object returned from `Video.runPreflight`
 * @property {string} status - The status of the test
 */
export class Preflight {

  private _status: string;

  constructor() {
    this._status = 'ready';
    // eslint-disable-next-line
    console.log('Preflight:' + DEFAULT_ENVIRONMENT);
  }

  /**
   * Starts the test
   */
  start(): void {
    this._status = 'started';
    // eslint-disable-next-line
    console.log('Preflight:start');
  }

  /**
   * Stops the test
   */
  stop(): void {
    this._status = 'started';
    // eslint-disable-next-line
    console.log('Preflight:stop');
  }

  get status(): string {
    return this._status;
  }
}

/**
 * @method
 * @name runPreflight
 * @description Run a {@link Preflight} test.
 * @memberof module:twilio-video
 * @param {string} token - The Access Token string
 * @example
 * var { runPreflight } = require('twilio-video');
 * var preflight = runPreflight();
 */
export function runPreflight(token: string): Preflight {
  const preflight = new Preflight();
  preflight.start();
  return preflight;
}
