'use strict';

const { deprecateEvents } = require('../../util');
const TrackPublication = require('./trackpublication');

/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @extends TrackPublication
 * @property {boolean} isSubscribed - whether the published {@link RemoteTrack}
 *   is subscribed to
 * @property {boolean} isTrackEnabled - <code>Deprecated: Use (track.switchOffReason !== "disabled-by-publisher") instead. This property is only valid if the corresponding RemoteTrack is subscribed to.</code>
 *   whether the published {@link RemoteTrack} is enabled
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {Track.Priority} publishPriority - the {@link Track.Priority} of the published
 *   {@link RemoteTrack} set by the {@link RemoteParticipant}
 * @property {?RemoteTrack} track - Unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @emits RemoteTrackPublication#publishPriorityChanged
 * @emits RemoteTrackPublication#subscribed
 * @emits RemoteTrackPublication#subscriptionFailed
 * @emits RemoteTrackPublication#trackDisabled
 * @emits RemoteTrackPublication#trackEnabled
 * @emits RemoteTrackPublication#trackSwitchedOff
 * @emits RemoteTrackPublication#trackSwitchedOn
 * @emits RemoteTrackPublication#unsubscribed
 *
 */
class RemoteTrackPublication extends TrackPublication {
  /**
   * Construct a {@link RemoteTrackPublication}.
   * @param {RemoteTrackPublicationV2|RemoteTrackPublicationV3} signaling - {@link RemoteTrackPublication} signaling
   * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
   *   options
   */
  constructor(signaling, options) {
    super(signaling.name, signaling.sid, options);

    Object.defineProperties(this, {
      _signaling: {
        value: signaling
      },
      _track: {
        value: null,
        writable: true
      },
      isSubscribed: {
        enumerable: true,
        get() {
          return !!this._track;
        }
      },
      isTrackEnabled: {
        enumerable: true,
        get() {
          this._log.deprecated('.isTrackEnabled is deprecated and scheduled for removal. '
            + 'During the deprecation period, this property is only valid if the corresponding '
            + 'RemoteTrack is subscribed to. The RemoteTrack can be considered disabled if '
            + '.switchOffReason is set to "disabled-by-publisher".');
          return signaling.isEnabled;
        }
      },
      kind: {
        enumerable: true,
        value: signaling.kind
      },
      publishPriority: {
        enumerable: true,
        get() {
          return signaling.priority;
        }
      },
      track: {
        enumerable: true,
        get() {
          return this._track;
        }
      }
    });

    // remember original state, and fire events only on change.
    let {
      error,
      isEnabled,
      isSwitchedOff,
      priority,
      switchOffReason = null,
      trackTransceiver
    } = signaling;

    const { _log: log, constructor: { name } } = this;

    deprecateEvents(name, this, new Map([
      ['trackDisabled', 'trackSwitchedOff (track.switchOffReason === "disabled-by-publisher")'],
      ['trackEnabled', 'trackSwitchedOn']
    ]), log);

    signaling.on('updated', () => {
      if (error !== signaling.error) {
        error = signaling.error;
        this.emit('subscriptionFailed', signaling.error);
        return;
      }
      if (isEnabled !== signaling.isEnabled) {
        isEnabled = signaling.isEnabled;
        if (this.track) {
          this.track._setEnabled(signaling.isEnabled);
        }
        this.emit(signaling.isEnabled ? 'trackEnabled' : 'trackDisabled');
      }
      const newSwitchOffReason = signaling.switchOffReason || null;
      if (isSwitchedOff !== signaling.isSwitchedOff || switchOffReason !== newSwitchOffReason) {
        log.debug(`${this.trackSid}: ${isSwitchedOff ? 'OFF' : 'ON'} => ${signaling.isSwitchedOff ? 'OFF' : 'ON'}`);
        log.debug(`${this.trackSid} off_reason: ${switchOffReason} => ${newSwitchOffReason}`);
        isSwitchedOff = signaling.isSwitchedOff;
        switchOffReason = newSwitchOffReason;
        if (this.track) {
          this.track._setSwitchedOff(signaling.isSwitchedOff, switchOffReason);
          this.emit(isSwitchedOff ? 'trackSwitchedOff' : 'trackSwitchedOn',  this.track, ...(isSwitchedOff ? [this.track.switchOffReason] : []));
        } else {
          log.warn(`Track was not subscribed to when switched ${isSwitchedOff ? 'off' : 'on'}.`);
        }
      }
      if (trackTransceiver !== signaling.trackTransceiver) {
        log.debug(`${this.trackSid} MediaTrackReceiver changed:`, trackTransceiver, signaling.trackTransceiver);
        trackTransceiver = signaling.trackTransceiver;
        if (this.track && this.kind !== 'data') {
          this.track._setTrackReceiver(trackTransceiver);
        } else {
          log.warn('Track was not subscribed to when TrackReceiver changed.');
        }
      }
      if (priority !== signaling.priority) {
        priority = signaling.priority;
        this.emit('publishPriorityChanged', priority);
      }
    });
  }

  toString() {
    return `[RemoteTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }

  /**
   * @private
   * @param {RemoteTrack} track
   */
  _subscribed(track) {
    if (!this._track && track) {
      this._track = track;
      this.emit('subscribed', track);
    }
  }

  /**
   * @private
   */
  _unsubscribe() {
    if (this._track) {
      const track = this._track;
      this._track = null;
      this.emit('unsubscribed', track);
    }
  }
}

/**
 * The {@link RemoteTrack}'s publish {@link Track.Priority} was changed by the
 * {@link RemoteParticipant}.
 * @param {Track.Priority} priority - the {@link RemoteTrack}'s new publish
 *   {@link Track.Priority}; RemoteTrackPublication#publishPriority is also
 *   updated accordingly
 * @event RemoteTrackPublication#publishPriorityChanged
 */

/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteTrack}.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was subscribed to
 * @event RemoteTrackPublication#subscribed
 */

/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @event RemoteTrackPublication#subscriptionFailed
 */

/**
 * The {@link RemoteTrack} was disabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code>.
 * @deprecated Use <a href="event:trackSwitchedOff"><code>trackSwitchedOff</code></a> (<code>track.switchOffReason === "disabled-by-publisher"</code>) instead
 * @event RemoteTrackPublication#trackDisabled
 */

/**
 * The {@link RemoteTrack} was enabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code>.
 * @deprecated Use <a href="event:trackSwitchedOn"><code>trackSwitchedOn</code></a> instead
 * @event RemoteTrackPublication#trackEnabled
 */

/**
 * The {@link RemoteTrack} was switched off. The media server stops sending media or data
 * for the {@link RemoteTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code>
 * is set to a {@link TrackSwitchOffReason}. Also, if the {@link RemoteTrack} receives either
 * audio or video media, the <code>mediaStreamTrack</code> property is set to <code>null</code>.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched off
 * @param {?TrackSwitchOffReason} switchOffReason - the reason the {@link RemoteTrack}
 *   was switched off
 * @event RemoteTrackPublication#trackSwitchedOff
 */

/**
 * The {@link RemoteTrack} was switched on. The media server starts sending media or data
 * for the {@link RemoteMediaTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, if the {@link RemoteTrack} receives either audio or video
 * media,the <code>mediaStreamTrack</code> property is set to a MediaStreamTrack that is the
 * source of the {@link RemoteTrack}'s media.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched on
 * @event RemoteTrackPublication#trackSwitchedOn
 */

/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteTrack}.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was unsubscribed from
 * @event RemoteTrackPublication#unsubscribed
 */

/**
 * {@link RemoteTrackPublication} options
 * @typedef {object} RemoteTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = RemoteTrackPublication;
