'use strict';

const RemoteParticipantV3 = require('./remoteparticipant');
const RoomV2 = require('../v2/room');
const TrackSubscriptionsSignaling = require('./tracksubscriptionssignaling');

/**
 * @extends RoomV2
 */
class RoomV3 extends RoomV2 {
  constructor(
    localParticipant,
    initialState,
    transport,
    peerConnectionManager,
    options
  ) {
    options = Object.assign({
      RemoteParticipantSignaling: RemoteParticipantV3,
      TrackSubscriptionsSignaling
    }, options);

    super(
      localParticipant,
      initialState,
      transport,
      peerConnectionManager,
      options
    );

    const getTrackReceiver = id => this._getTrackReceiver(id);
    const { _log: log } = this;

    Object.defineProperties(this, {
      _pendingTrackMids: {
        value: new Map()
      },
      _trackSubscriptionsSignaling: {
        value: new options.TrackSubscriptionsSignaling(getTrackReceiver, { log })
      }
    });

    this._initTrackSubscriptionsSignaling();
  }

  /**
   * @private
   * @override
   */
  _addTrackReceiver(trackReceiver) {
    const deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver.mid, 'mid');
    deferred.resolve(trackReceiver);
    return this;
  }

  /**
   * @private
   * @override
   */
  _createRemoteParticipant(participantState) {
    const { _RemoteParticipantSignaling: RemoteParticipantV3 } = this;
    return new RemoteParticipantV3(
      participantState,
      trackSid => this._getPendingTrackReceiver(trackSid),
      trackSid => this._getInitialTrackSwitchOffState(trackSid),
      (trackSid, priority) => this._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority),
      (trackSid, hint) => this._renderHintsSignaling.setTrackHint(trackSid, hint),
      trackSid => this._renderHintsSignaling.clearTrackHint(trackSid)
    );
  }

  /**
   * @private
   */
  _getPendingTrackReceiver(trackSid) {
    const mid = this._pendingTrackMids.get(trackSid);
    if (!mid) {
      return Promise.resolve(null);
    }
    this._pendingTrackMids.delete(trackSid);
    return this._getTrackReceiver(mid, 'mid');
  }

  /**
   * @private
   * @override
   */
  _handleSubscriptions() {
    /* Do nothing since RSP v3 messages will not contain the "subscribed" property. */
  }

  /**
   * @private
   */
  _initTrackSubscriptionsSignaling() {
    this._trackSubscriptionsSignaling.on('updated', trackStates => {
      const trackSidsToTrackSignalings = this._getTrackSidsToTrackSignalings();
      const trackSidsToTrackStates = new Map(Object.entries(trackStates));

      trackSidsToTrackStates.forEach(({ mid, state }, sid) => {
        const trackSignaling = trackSidsToTrackSignalings.get(sid);
        const isSwitchedOff = state === 'OFF';
        if (!trackSignaling) {
          this._pendingSwitchOffStates.set(sid, isSwitchedOff);
          this._pendingTrackMids.set(sid, mid);
          return;
        }
        if (isSwitchedOff || trackSignaling.trackTransceiver.mid !== mid) {
          trackSignaling.setTrackTransceiver(null);
        }
        if (!isSwitchedOff) {
          this._getTrackReceiver(mid, 'mid').then(trackReceiver => trackSignaling.setTrackTransceiver(trackReceiver));
        }
        trackSignaling.setSwitchedOff(isSwitchedOff);
      });

      trackSidsToTrackSignalings.forEach(trackSignaling => {
        if (!trackSidsToTrackStates.has(trackSignaling.sid)) {
          trackSignaling.setTrackTransceiver(null);
        }
      });
    });
  }

  /**
   * @private
   * @override
   */
  _setupMediaSignalings(roomState) {
    const { media_signaling: mediaSignalings } = roomState;
    const { _trackSubscriptionsSignaling: trackSubscriptionsSignaling } = this;
    const { channel, isSetup } = trackSubscriptionsSignaling;
    super._setupMediaSignalings(roomState);
    if (!isSetup
      && mediaSignalings
      && mediaSignalings[channel]
      && mediaSignalings[channel].transport
      && mediaSignalings[channel].transport.type === 'data-channel') {
      trackSubscriptionsSignaling.setup(roomState.media_signaling[channel].transport.label);
    }
  }

  /**
   * @private
   * @override
   */
  _updateSubscribed(roomState) {
    /* Do nothing since RSP v3 messages will not contain the "subscribed" property. */
  }
}

module.exports = RoomV3;
