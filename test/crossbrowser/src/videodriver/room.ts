import { EventEmitter } from 'events';
import SDKDriver from '../../../lib/sdkdriver/src';

/**
 * A {@link RoomSID} is a 34-character string starting with "RM"
 * that uniquely identifies a {@link Room}.
 * @type string
 * @typedef RoomSID
 */
type RoomSID = string;

/**
 * {@link Room} driver.
 * @classdesc A {@link RoomDriver} manages the execution of the
 *   corresponding {@link Room}'s methods in the browser and reemits
 *   the {@link Room}'s events.
 * @extends EventEmitter
 * @property {object} localParticipant
 * @property {string} name
 * @property {Map<ParticipantSID, object>} participants
 * @property {RoomSID} sid
 * @property {string} state
 * @fires RoomDriver#disconnected
 * @fires RoomDriver#participantConnected
 * @fires RoomDriver#participantDisconnected
 * @fires RoomDriver#recordingStarted
 * @fires RoomDriver#recordingStopped
 * @fires RoomDriver#trackDimensionsChanged
 * @fires RoomDriver#trackDisabled
 * @fires RoomDriver#trackEnabled
 * @fires RoomDriver#trackMessage
 * @fires RoomDriver#trackStarted
 * @fires RoomDriver#trackSubscribed
 * @fires RoomDriver#trackUnsubscribed
 */
export default class RoomDriver extends EventEmitter {
  private readonly _instanceId: number;
  private readonly _sdkDriver: SDKDriver;
  localParticipant: any;
  name: string;
  participants: Map<string, any>;
  sid: RoomSID;
  state: string;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedRoom
   */
  constructor(sdkDriver: SDKDriver, serializedRoom: any) {
    super();
    this._instanceId = serializedRoom._instanceId;
    this._sdkDriver = sdkDriver;
    this._update(serializedRoom);

    sdkDriver.on('event', (data: any) => {
      const { type, source, args } = data;
      switch (type) {
        case 'disconnected':
          this._reemitDisconnected(source, args);
          break;
        case 'participantConnected':
          this._reemitParticipantConnected(source, args);
          break;
        case 'participantDisconnected':
          this._reemitParticipantDisconnected(source, args);
          break;
        case 'recordingStarted':
          this._reemitRecordingStarted(source);
          break;
        case 'recordingStopped':
          this._reemitRecordingStopped(source);
          break;
      }
    });
  }

  /**
   * Re-emit the "disconnected" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitDisconnected(source: any, args: any): void {
    if (source._instanceId !== this._instanceId) {
      return;
    }
    this._update(source);

    const [, serializedError] = args;
    let error: any = null;
    if (serializedError) {
      error = new Error(serializedError.message);
      error.code = serializedError.code;
    }
    this.emit('disconnected', this, error);
  }

  /**
   * Re-emit the "participantConnected" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitParticipantConnected(source: any, args: any): void {
    if (source._instanceId !== this._instanceId) {
      return;
    }
    this._update(source);

    const serializedParticipant: any = args[0];
    this.emit('participantConnected', serializedParticipant);
  }

  /**
   * Re-emit the "participantConnected" event from the browser.
   * @private
   * @param {object} source
   * @param {*} args
   * @returns {void}
   */
  private _reemitParticipantDisconnected(source: any, args: any): void {
    if (source._instanceId !== this._instanceId) {
      return;
    }
    this._update(source);

    const serializedParticipant: any = args[0];
    this.emit('participantDisconnected', serializedParticipant);
  }

  /**
   * Re-emit the "recordingStarted" event from the browser.
   * @private
   * @param {object} source
   * @returns {void}
   */
  private _reemitRecordingStarted(source: any): void {
    if (source._instanceId !== this._instanceId) {
      return;
    }
    this._update(source);
    this.emit('recordingStarted');
  }

  /**
   * Re-emit the "recordingStopped" event from the browser.
   * @private
   * @param {object} source
   * @returns {void}
   */
  private _reemitRecordingStopped(source: any): void {
    if (source._instanceId !== this._instanceId) {
      return;
    }
    this._update(source);
    this.emit('recordingStopped');
  }

  /**
   * Update the {@link RoomDriver}'s properties.
   * @param {object} serializedRoom
   * @returns {void}
   */
  private _update(serializedRoom: any): void {
    const { participants } = serializedRoom;
    this.localParticipant = serializedRoom.localParticipant;
    this.name = serializedRoom.name;
    this.participants = new Map(participants.map((participant: any) => [participant.sid, participant]));
    this.sid = serializedRoom.sid;
    this.state = serializedRoom.state;
  }

  /**
   * Disconnect from the {@link Room} in the browser.
   * @returns {void}
   */
  disconnect(): void {
    this._sdkDriver.sendRequest({
      api: 'disconnect',
      target: this._instanceId
    }).then(() => {
      // Do nothing.
    }, () => {
      // Do nothing.
    });
  }

  /**
   * Get WebRTC stats for the {@link Room} from the browser.
   * @returns {Promise<Array<object>>}
   */
  async getStats(): Promise<Array<any>> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'getStats',
      target: this._instanceId
    });

    if (error) {
      throw new Error(error.message);
    }
    return result;
  }
}

/**
 * @param {RoomDriver} room
 * @param {?TwilioError} error
 * @event RoomDriver#disconnected
 */

/**
 * @param {ParticipantDriver} participant
 * @event RoomDriver#participantConnected
 */

/**
 * @param {ParticipantDriver} participant
 * @event RoomDriver#participantDisconnected
 */

/**
 * @event RoomDriver#recordingStarted
 */

/**
 * @event RoomDriver#recordingStopped
 */

/**
 * @param {VideoTrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackDimensionsChanged
 */

/**
 * @param {TrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackDisabled
 */

/**
 * @param {TrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackEnabled
 */

/**
 * @param {string|ArrayBuffer} data
 * @param {VideoTrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackMessage
 */

/**
 * @param {TrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackStarted
 */

/**
 * @param {TrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackSubscribed
 */

/**
 * @param {TrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackUnsubscribed
 */
