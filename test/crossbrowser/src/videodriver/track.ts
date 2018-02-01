import { EventEmitter } from 'events';
import SDKDriver from '../../../lib/sdkdriver/src';

/**
 * {@link Track} ID.
 */
export type TrackID = string;

/**
 * {@link Track} kind.
 */
export type TrackKind = 'audio' | 'data' | 'video';

/**
 * A {@link TrackSID} is a 34-character string starting with "MT"
 * that uniquely identifies a {@link Track}.
 */
export type TrackSID = string;

/**
 * {@link Track} driver.
 * @classdesc A {@link TrackDriver} manages the execution of
 *   the corresponding {@link Track}'s methods in the browser
 *   and re-emits its events.
 * @extends EventEmitter
 * @property {TrackID} id
 * @property {TrackKind} kind
 * @property {string} name
 */
export default class TrackDriver extends EventEmitter {
  protected readonly _resourceId: string;
  readonly id: TrackID;
  readonly kind: TrackKind;
  readonly name: string;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedTrack
   */
  constructor(sdkDriver: SDKDriver, serializedTrack: any) {
    super();
    this._resourceId = serializedTrack._resourceId;
    this.id = serializedTrack.id;
    this.kind = serializedTrack.kind;
    this.name = serializedTrack.name;
    sdkDriver.on('event', (data: any) => this._reemitEvents(data));
  }

  /**
   * Re-emit the {@link Track}'s events from the browser.
   * @private
   * @param {object} data
   * @returns {void}
   */
  private _reemitEvents(data: any): void {
    const { type, source, args = [] } = data;
    if (source._resourceId === this._resourceId) {
      this._update(source);
      this.emit(type, ...args);
    }
  }

  /**
   * Update the {@link TrackDriver}'s properties.
   * @private
   * @param {object} serializedTrack
   * @returns {void}
   */
  protected _update(serializedTrack: any): void {}

  /**
   * Get the resource ID of the {@link TrackDriver}.
   * @returns {string}
   */
  get resourceId(): string {
    return this._resourceId;
  }
}
