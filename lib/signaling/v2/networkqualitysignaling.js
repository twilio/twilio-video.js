'use strict';

const { EventEmitter } = require('events');

const AsyncVar = require('../../util/asyncvar');

/**
 * @interface MediaSignalingTransport
 * @property {function(object): boolean} send
 * @emits MediaSignalingTransport#message
 */

/**
 * The {@link MediaSignalingTransport} received a message.
 * @event MediaSignalingTransport#message
 * @param {object} message
 */

/**
 * @interface SendAndReceiveLevels
 * @deprecated - the decomposed levels are only used for debugging and will be
 *   removed as soon as we are confident in our implementation
 * @property {number} send
 * @property {number} recv
 */

/**
 * @interface NetworkQualityLevels
 * @deprecated - the decomposed levels are only used for debugging and will be
 *   removed as soon as we are confident in our implementation
 * @property {SendAndReceiveLevels} audio
 * @property {SendAndReceiveLevels} video
 */

/**
 * @typedef {PeerConnectionSummary} NetworkQualityInputs
 */

/**
 * @classdesc The {@link NetworkQualitySignaling} class allows submitting
 *   {@link NetworkQualityInputs} for computing {@link NetworkQualityLevel}. It
 *   does so by sending and receiving messages over a
 *   {@link MediaSignalingTransport}. The exact transport used depends on the
 *   topology of the {@link Room} that {@link NetworkQualitySignaling} is being
 *   used within: for P2P Rooms, we re-use the {@link TransportV2}; and for
 *   Group Rooms, we use a {@link DataTransport}.
 * @emits NetworkQualitySignaling#updated
 */
class NetworkQualitySignaling extends EventEmitter {
  /**
   * Construct a {@link NetworkQualitySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  constructor(mediaSignalingTransport) {
    super();

    Object.defineProperties(this, {
      _level: {
        value: null,
        writable: true
      },
      _levels: {
        value: null,
        writable: true
      },
      _remoteLevels: {
        value: new Map(),
        writable: true
      },
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      },
      _networkQualityInputs: {
        value: new AsyncVar()
      }
    });

    mediaSignalingTransport.on('message', message => {
      switch (message.type) {
        case 'network_quality':
          this._handleNetworkQualityMessage(message);
          break;
        default:
          break;
      }
    });

    this._sendNetworkQualityInputs();
  }

  /**
   * Get the current {@link NetworkQualityLevel}, if any.
   * @returns {?NetworkQualityLevel} level - initially null
   */
  get level() {
    return this._level;
  }

  /**
   * Get the current {@link NetworkQualityLevels}, if any.
   * @deprecated - the decomposed levels are only used for debugging and will be
   *  removed as soon as we are confident in our implementation
   * @returns {?NetworkQualityLevels} levels - initially null
   */
  get levels() {
    return this._levels;
  }

  /**
   * Get the current {@link NetworkQualityLevels} of remote participants, if any.
   * @returns {Map<String, NetworkQualityLevels>} remoteLevels
   */
  get remoteLevels() {
    return this._remoteLevels;
  }

  /**
   * Check to see if the {@link NetworkQualityLevel} is new, and raise an
   * event if necessary.
   * @private
   * @param {object} message
   * @returns {void}
   */
  _handleNetworkQualityMessage(message) {
    let updated = false;
    let level = null;
    const local = message ? message.local : null;
    if (typeof local === 'number') {
      // NOTE(mroberts): In prod, we plan to only send the level.
      level = local;
      this._levels = null;
    } else if (typeof local === 'object' && local) {
      // NOTE(mroberts): In dev, we plan to send the decomposed levels. An early
      // VMS version does not compute `level` for us, so we fallback to taking
      // the minimum ourselves.
      this._levels = local;
      level = typeof local.level === 'number'
        ? local.level
        : Math.min(
            local.audio.send,
            local.audio.recv,
            local.video.send,
            local.video.recv);
    }
    if (level !== null && this.level !== level) {
      this._level = level;
      updated = true;
    }

    this._remoteLevels = message && message.remotes
      ? message.remotes.reduce((levels, obj) => {
          const oldObj = this._remoteLevels.get(obj.sid) || {};
          if (oldObj.level !== obj.level) {
            updated = true;
          }
          return levels.set(obj.sid, obj);
        }, new Map())
      : this._remoteLevels;

    if (updated) {
      this.emit('updated');
    }
    setTimeout(() => this._sendNetworkQualityInputs(), 1000);
  }

  /**
   * Start sending {@link NetworkQualityInputs}.
   * @private
   * @returns {Promise<void>}
   */
  _sendNetworkQualityInputs() {
    return this._networkQualityInputs.take().then(networkQualityInputs => {
      this._mediaSignalingTransport.publish(createNetworkQualityInputsMessage(networkQualityInputs));
    });
  }

  /**
   * Put {@link NetworkQualityInputs} to be used for computing
   * {@link NetworkQualityLevel}.
   * @param {NetworkQualityInputs} networkQualityInputs
   * @returns {void}
   */
  put(networkQualityInputs) {
    this._networkQualityInputs.put(networkQualityInputs);
  }
}

/**
 * The {@link NetworkQualityLevel} changed.
 * @event NetworkQualitySignaling#updated
 */

/**
 * @param {NetworkQualityInputs} networkQualityInputs
 * @returns {object} message
 */
function createNetworkQualityInputsMessage(networkQualityInputs) {
  return Object.assign({
    type: 'network_quality',
    remoteReportLevel: 1
  }, networkQualityInputs);
}

module.exports = NetworkQualitySignaling;
