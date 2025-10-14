import SDKDriver from '../../../lib/sdkdriver/src';
import ParticipantDriver from './participant';
import RemoteDataTrackDriver from './remotedatatrack';
import RemoteMediaTrackDriver from './remotemediatrack';
import TrackDriver from './track';

/**
 * {@link RemoteParticipant} driver.
 * @classdesc A {@link RemoteParticipantDriver} manages the execution of the
 *   corresponding {@link RemoteParticipant}'s methods in the browser and
 *   re-emits its events.
 * @extends ParticipantDriver
 * @fires RemoteParticipantDriver#disconnected
 * @fires RemoteParticipantDriver#trackDisabled
 * @fires RemoteParticipantDriver#trackEnabled
 * @fires RemoteParticipantDriver#trackMessage
 * @fires RemoteParticipantDriver#trackStarted
 * @fires RemoteParticipantDriver#trackSubscribed
 * @fires RemoteParticipantDriver#trackUnsubscribed
 */
export default class RemoteParticipantDriver extends ParticipantDriver {
  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedRemoteParticipant
   */
  constructor(sdkDriver: SDKDriver, serializedRemoteParticipant: any) {
    super(sdkDriver, serializedRemoteParticipant, RemoteDataTrackDriver, RemoteMediaTrackDriver);
  }

  /**
   * Re-emit the "disconnected" event from the browser.
   * @private
   * @param {object} source
   * @returns {void}
   */
  private _reemitDisconnected(source: any): void {
    this._update(source);
    this.emit('disconnected', this);
  }

  /**
   * Re-emit the "trackDisabled" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackDisabled(source: any, args: any): void {
    this._update(source);
    const serializedRemoteTrack: any = args[0];
    this.emit('trackDisabled', this.tracks.get(serializedRemoteTrack.id));
  }

  /**
   * Re-emit the "trackEnabled" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackEnabled(source: any, args: any): void {
    this._update(source);
    const serializedRemoteTrack: any = args[0];
    this.emit('trackEnabled', this.tracks.get(serializedRemoteTrack.id));
  }

  /**
   * Re-emit the "trackMessage" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackMessage(source: any, args: any): void {
    this._update(source);
    const [data, serializedRemoteTrack] = args;
    this.emit('trackMessage', data, this.tracks.get(serializedRemoteTrack.id));
  }

  /**
   * Re-emit the "trackStarted" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackStarted(source: any, args: any): void {
    this._update(source);
    const serializedRemoteTrack: any = args[0];
    this.emit('trackStarted', this.tracks.get(serializedRemoteTrack.id));
  }

  /**
   * Re-emit the "trackSubscribed" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackSubscribed(source: any, args: any): void {
    this._update(source);
    const serializedRemoteTrack: any = args[0];
    this.emit('trackSubscribed', this.tracks.get(serializedRemoteTrack.id));
  }

  /**
   * Re-emit the "trackUnsubscribed" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackUnsubscribed(source: any, args: any): void {
    this._update(source);
    const serializedRemoteTrack: any = args[0];
    const remoteTrack: TrackDriver | undefined = this._removeOrGetRemovedTrack(serializedRemoteTrack.id);
    this.emit('trackUnsubscribed', remoteTrack);
  }

  /**
   * Re-emit {@link RemoteParticipant}'s events from the browser.
   * @private
   * @param {object} data
   * @returns {void}
   */
  protected _reemitEvents(data: any): void {
    const { type, source, args } = data;
    if (source._resourceId !== this._resourceId) {
      return;
    }
    super._reemitEvents(data);
    switch (type) {
      case 'disconnected':
        this._reemitDisconnected(source);
        break;
      case 'trackDisabled':
        this._reemitTrackDisabled(source, args);
        break;
      case 'trackEnabled':
        this._reemitTrackEnabled(source, args);
        break;
      case 'trackMessage':
        this._reemitTrackMessage(source, args);
        break;
      case 'trackStarted':
        this._reemitTrackStarted(source, args);
        break;
      case 'trackSubscribed':
        this._reemitTrackSubscribed(source, args);
        break;
      case 'trackUnsubscribed':
        this._reemitTrackUnsubscribed(source, args);
        break;
    }
  }
}

/**
 * @param {RemoteParticipantDriver} participant
 * @event RemoteParticipantDriver#disconnected
 */

/**
 * @param {RemoteMediaTrackDriver} track
 * @event RemoteParticipantDriver#trackDisabled
 */

/**
 * @param {RemoteMediaTrackDriver} track
 * @event RemoteParticipantDriver#trackEnabled
 */

/**
 * @param {string} data
 * @param {RemoteMediaTrackDriver} track
 * @event RemoteParticipantDriver#trackMessage
 */

/**
 * @param {RemoteMediaTrackDriver} track
 * @event RemoteParticipantDriver#trackStarted
 */

/**
 * @param {RemoteDataTrackDriver | RemoteMediaTrackDriver} track
 * @event RemoteParticipantDriver#trackSubscribed
 */

/**
 * @param {RemoteDataTrackDriver | RemoteMediaTrackDriver} track
 * @event RemoteParticipantDriver#trackUnsubscribed
 */
