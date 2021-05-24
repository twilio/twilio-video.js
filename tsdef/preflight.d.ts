/**
 * A {@link Preflight} represents the object returned from `Video.runPreflight`
 * @property {string} status - The status of the test
 */
export declare class Preflight {
    private _status;
    constructor();
    /**
     * Starts the test
     */
    start(): void;
    /**
     * Stops the test
     */
    stop(): void;
    get status(): string;
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
export declare function runPreflight(token: string): Preflight;
