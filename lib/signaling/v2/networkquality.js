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
 * @property {number} send
 * @property {number} recv
 */

/**
 * @interface NetworkQualityLevels
 * @property {SendAndReceiveLevels} audio
 * @property {SendAndReceiveLevels} video
 */

/**
 * @typedef {PeerConnectionSummary} NetworkQualityInputs
 */

/**
 * @classdesc The {@link NetworkQualitySignaling} class allows submitting
 *   {@link NetworkQualityInputs} for computing {@link NetworkQualityLevels}. It
 *   does so by sending and receivin messages over a
 *   {@link MediaSignalingTransport}. The exact transport used depends on the
 *   topology of the {@link Room} that {@link NetworkQualitySignaling} is being
 *   used within: for P2P Rooms, we re-use the {@link TransportV2}; and for
 *   Group Rooms, we use a {@link DataTransport}.
 * @emits NetworkQualitySignaling#networkQualityLevelsChanged
 */
class NetworkQualitySignaling extends EventEmitter {
  /**
   * Construct a {@link NetworkQualitySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  constructor(mediaSignalingTransport) {
    super();

    Object.defineProperties(this, {
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      },
      _networkQualityInputs: {
        value: new AsyncVar()
      },
      _networkQualityLevels: {
        value: null,
        writable: true
      }
    });

    mediaSignalingTransport.on('message', message => {
      switch (message.type) {
        case 'network_quality':
          this._handleNetworkQualityLevels(message);
          break;
        default:
          break;
      }
    });

    this._sendNetworkQualityInputs();
  }

  /**
   * Get the current {@link NetworkQualityLevels}, if any.
   * @returns {NetworkQualityLevels?} networkQualityLevels - initially null
   */
  get networkQualityLevels() {
    return this._networkQualityLevels;
  }

  /**
   * Check to see if the {@link NetworkQualityLevels} are new, and raise an
   * event if necessary.
   * @private
   * @param {NetworkQualityLevels} networkQualityLevels
   * @returns {void}
   */
  _handleNetworkQualityLevels(networkQualityLevels) {
    if (!this.networkQualityLevels ||
      !areNetworkQualityLevelsEqual(this.networkQualityLevels, networkQualityLevels.local)) {
      this._networkQualityLevels = {
        audio: networkQualityLevels.local.audio,
        video: networkQualityLevels.local.video
      };
      this.emit('networkQualityLevelsChanged', this.networkQualityLevels);
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
   * {@link NetworkQualityLevels}.
   * @param {NetworkQualityInputs} networkQualityInputs
   * @returns {void}
   */
  put(networkQualityInputs) {
    this._networkQualityInputs.put(networkQualityInputs);
  }
}

/**
 * The {@link NetworkQualityLevels} changed.
 * @event NetworkQualitySignaling#networkQualityLevelsChanged
 * @param {NetworkQualityLevels} networkQualityLevels
 */

/**
 * @param {NetworkQualityInputs} networkQualityInputs
 * @returns {object} message
 */
function createNetworkQualityInputsMessage(networkQualityInputs) {
  return Object.assign({
    type: 'network_quality'
  }, networkQualityInputs);
}

/**
 * @param {NetworkQualityLevels} a
 * @param {NetworkQualityLevels} b
 * @returns {boolean}
 */
function areNetworkQualityLevelsEqual(a, b) {
  return a.audio.send === b.audio.send
      && a.audio.recv === b.audio.recv
      && a.video.send === b.video.send
      && a.video.recv === b.video.recv;
}

module.exports = NetworkQualitySignaling;
