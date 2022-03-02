'use strict';

const { createTwilioError } = require('../../util/twilio-video-errors');
const RoomV2 = require('../v2/room');
const RemoteParticipantV3 = require('../v3/remoteparticipant');
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
   * @override
   */
  _getInitialTrackSwitchOffState(trackSid) {
    const switchOffState = this._pendingSwitchOffStates.get(trackSid)
      || { state: 'ON', switchOffReason: null };
    this._pendingSwitchOffStates.delete(trackSid);
    if (switchOffState.state === 'OFF') {
      this._log.warn(`[${trackSid}] was initially switched off! `);
    }
    return switchOffState;
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

      trackSidsToTrackStates.forEach(({ mid, off_reason: switchOffReason = null, state }, sid) => {
        const trackSignaling = trackSidsToTrackSignalings.get(sid);
        const trackState = { state, switchOffReason };
        if (!trackSignaling) {
          this._pendingSwitchOffStates.set(sid, trackState);
          this._pendingTrackMids.set(sid, mid);
          return;
        }
        const isSwitchedOff = state === 'OFF';
        if (isSwitchedOff || (trackSignaling.trackTransceiver && trackSignaling.trackTransceiver.mid !== mid)) {
          // NOTE(mmalavalli): If a RemoteTrackPublicationV3's MID changes, then we need to unsubscribe
          // from the RemoteTrack before subscribing to it again with the MediaTrackReceiver associated with the new
          // MID. If a RemoteTrackPublicationV3's RemoteTrack is switched off, then we should still be subscribed
          // to it, even though it no longer has an MID associated with it.
          trackSignaling.setTrackTransceiver(null, isSwitchedOff);
        }
        if (!isSwitchedOff) {
          this._getTrackReceiver(mid, 'mid').then(trackReceiver => trackSignaling.setTrackTransceiver(trackReceiver, true));
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
        const { sid } = trackSignaling;
        if (!trackSidsToTrackStates.has(sid)) {
          this._pendingSwitchOffStates.delete(sid);
          this._pendingTrackMids.delete(sid);
          trackSignaling.setTrackTransceiver(null, false);
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
