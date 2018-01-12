import { EventEmitter } from 'events';
import SDKDriver from '../../../lib/sdkdriver/src';
import LocalParticipantDriver from './localparticipant';
import ParticipantDriver, { ParticipantSID } from './participant';
const { difference } = require('../../../../lib/util');

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
 * @property {LocalParticipantDriver} localParticipant
 * @property {string} name
 * @property {Map<ParticipantSID, ParticipantDriver>} participants
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
  private readonly _resourceId: string;
  private readonly _sdkDriver: SDKDriver;
  localParticipant: LocalParticipantDriver;
  name: string;
  participants: Map<ParticipantSID, ParticipantDriver>;
  sid: RoomSID;
  state: string;

  /**
   * Constructor.
   * @param {SDKDriver} sdkDriver
   * @param {object} serializedRoom
   */
  constructor(sdkDriver: SDKDriver, serializedRoom: any) {
    super();
    this.localParticipant = new LocalParticipantDriver(sdkDriver, serializedRoom.localParticipant);
    this.participants = new Map();
    this._resourceId = serializedRoom._resourceId;
    this._sdkDriver = sdkDriver;
    this._update(serializedRoom);

    sdkDriver.on('event', (data: any) => {
      const { type, source, args } = data;
      if (source._resourceId !== this._resourceId) {
        return;
      }
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
        case 'trackAdded':
          this._reemitTrackAdded(source, args);
          break;
        case 'trackRemoved':
          this._reemitTrackRemoved(source, args);
          break;
        case 'trackSubscribed':
          this._reemitTrackSubscribed(source, args);
          break;
        case 'trackUnsubscribed':
          this._reemitTrackUnsubscribed(source, args);
          break;
      }
    });
  }

  /**
   * Re-emit the "disconnected" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitDisconnected(source: any, args: any): void {
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
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitParticipantConnected(source: any, args: any): void {
    this._update(source);
    const serializedParticipant: any = args[0];
    this.emit('participantConnected', this.participants.get(serializedParticipant.sid));
  }

  /**
   * Re-emit the "participantConnected" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitParticipantDisconnected(source: any, args: any): void {
    const serializedParticipant: any = args[0];
    const participant: ParticipantDriver = this.participants.get(serializedParticipant.sid) as ParticipantDriver;
    this._update(source);
    this.emit('participantDisconnected', participant);
  }

  /**
   * Re-emit the "recordingStarted" event from the browser.
   * @private
   * @param {object} source
   * @returns {void}
   */
  private _reemitRecordingStarted(source: any): void {
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
    this._update(source);
    this.emit('recordingStopped');
  }

  /**
   * Re-emit the "trackAdded" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackAdded(source: any, args: any): void {
    this._update(source);
    const [ serializedTrack, serializedParticipant ] = args;
    this.emit('trackAdded', serializedTrack, this.participants.get(serializedParticipant.sid));
  }

  /**
   * Re-emit the "trackRemoved" event from the browser.
   * @private
   * @param {object} source
   * @param {Array<*>} args
   * @returns {void}
   */
  private _reemitTrackRemoved(source: any, args: any): void {
    this._update(source);
    const [ serializedTrack, serializedParticipant ] = args;
    this.emit('trackRemoved', serializedTrack, this.participants.get(serializedParticipant.sid));
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
    const [ serializedTrack, serializedParticipant ] = args;
    this.emit('trackSubscribed', serializedTrack, this.participants.get(serializedParticipant.sid));
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
    const [ serializedTrack, serializedParticipant ] = args;
    this.emit('trackUnsubscribed', serializedTrack, this.participants.get(serializedParticipant.sid));
  }

  /**
   * Update the {@link RoomDriver}'s properties.
   * @param {object} serializedRoom
   * @returns {void}
   */
  private _update(serializedRoom: any): void {
    this.name = serializedRoom.name;
    this.sid = serializedRoom.sid;
    this.state = serializedRoom.state;

    const participants: Map<ParticipantSID, any> = new Map(serializedRoom.participants.map((participant: any) => [
      participant.sid,
      participant
    ]));

    const participantsToAdd: Set<ParticipantSID> = difference(
      Array.from(participants.keys()),
      Array.from(this.participants.keys()));

    const participantsToRemove: Set<ParticipantSID> = difference(
      Array.from(this.participants.keys()),
      Array.from(participants.keys()));

    participantsToAdd.forEach((sid: ParticipantSID) => {
      this.participants.set(sid, new ParticipantDriver(this._sdkDriver, participants.get(sid)));
    });
    participantsToRemove.forEach((sid: ParticipantSID) => {
      this.participants.delete(sid);
    });
  }

  /**
   * Disconnect from the {@link Room} in the browser.
   * @returns {void}
   */
  disconnect(): void {
    this._sdkDriver.sendRequest({
      api: 'disconnect',
      target: this._resourceId
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
      target: this._resourceId
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
 * @event RoomDriver#trackAdded
 */

/**
 * @param {TrackDriver} track
 * @param {ParticipantDriver} participant
 * @event RoomDriver#trackRemoved
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
