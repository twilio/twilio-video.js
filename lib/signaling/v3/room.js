'use strict';

const { createTwilioError } = require('../../util/twilio-video-errors');
const RoomV2 = require('../v2/room');
// TODO(mmalavalli): Change to RemoteParticipantV3 once implemented.
const RemoteParticipantV2 = require('../v2/remoteparticipant');
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
      // TODO(mmalavalli): Change to RemoteParticipantV3 once implemented.
      RemoteParticipantSignaling: RemoteParticipantV2,
      TrackSubscriptionsSignaling
    }, options);

    options.otherMediaSignalings = [{
      MediaSignaling: options.TrackSubscriptionsSignaling,
      initMethod: '_initTrackSubscriptionsSignaling',
      name: '_trackSubscriptionsSignaling'
    }];

    super(
      localParticipant,
      initialState,
      transport,
      peerConnectionManager,
      options
    );

    Object.defineProperties(this, {
      _pendingTrackMids: {
        value: new Map()
      }
    });
  }

  /**
   * @private
   * @override
   */
  _addTrackReceiver(trackReceiver) {
    const idType = trackReceiver.kind === 'data' ? 'id' : 'mid';
    const deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver[idType], idType);
    deferred.resolve(trackReceiver);
    return this;
  }

  /**
   * @private
   * @override
   */
  _createRemoteParticipant(participantState) {
    // eslint-disable-next-line no-warning-comments
    // TODO(mmalavalli): Change to RemoteParticipantV3 once implemented.
    const { _RemoteParticipantSignaling: RemoteParticipantV2 } = this;
    return new RemoteParticipantV2(
      participantState,
      // eslint-disable-next-line no-warning-comments
      // TODO(mmalavalli): Uncomment once RemoteParticipantV3 is implemented.
      /* trackSid => this._getPendingTrackReceiver(trackSid), */
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
    this._trackSubscriptionsSignaling.on('updated', (subscribed, errors) => {
      const trackSidsToTrackSignalings = this._getTrackSidsToTrackSignalings();
      const trackSidsToTrackStates = new Map(Object.entries(subscribed));
      const trackSidsToErrors = new Map(Object.entries(errors));

      trackSidsToTrackStates.forEach(({ mid, state }, sid) => {
        const trackSignaling = trackSidsToTrackSignalings.get(sid);
        const isSwitchedOff = state === 'OFF';
        if (!trackSignaling) {
          this._pendingSwitchOffStates.set(sid, isSwitchedOff);
          this._pendingTrackMids.set(sid, mid);
          return;
        }
        if (isSwitchedOff || (trackSignaling.trackTransceiver && trackSignaling.trackTransceiver.mid !== mid)) {
          trackSignaling.setTrackTransceiver(null);
        }
        if (!isSwitchedOff) {
          this._getTrackReceiver(mid, 'mid').then(trackReceiver => trackSignaling.setTrackTransceiver(trackReceiver));
        }
        trackSignaling.setSwitchedOff(isSwitchedOff);
      });

      trackSidsToErrors.forEach(({ code, message }, sid) => {
        const trackSignaling = trackSidsToTrackSignalings.get(sid);
        if (trackSignaling) {
          trackSignaling.subscribeFailed(createTwilioError(code, message));
        }
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
  _updateSubscribed(roomState) {
    /* Do nothing since RSP v3 messages will not contain the "subscribed" property. */
  }
}

module.exports = RoomV3;
