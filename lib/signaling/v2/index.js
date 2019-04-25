'use strict';

const defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
const LocalParticipantV2 = require('./localparticipant');
const Signaling = require('../');

/**
 * {@link SignalingV2} implements version 2 of our signaling protocol.
 * @extends Signaling
 */
class SignalingV2 extends Signaling {
  /**
   * Construct {@link SignalingV2}.
   * @param {string} wsServer
   * @param {?object} [options={}]
   */
  constructor(wsServer, options) {
    /* eslint new-cap:0 */
    options = Object.assign({
      createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise
    }, options);

    super();

    Object.defineProperties(this, {
      _createCancelableRoomSignalingPromise: {
        value: options.createCancelableRoomSignalingPromise
      },
      _options: {
        value: options
      },
      _wsServer: {
        value: wsServer
      }
    });
  }

  /**
   * @private
   */
  _connect(
    localParticipant,
    token,
    iceServerSource,
    encodingParameters,
    preferredCodecs,
    options
  ) {
    options = Object.assign({}, this._options, options);
    return this._createCancelableRoomSignalingPromise.bind(
      null,
      token,
      this._wsServer,
      localParticipant,
      iceServerSource,
      encodingParameters,
      preferredCodecs,
      options);
  }

  createLocalParticipantSignaling(encodingParameters, networkQualityConfiguration) {
    return new LocalParticipantV2(encodingParameters, networkQualityConfiguration);
  }
}

module.exports = SignalingV2;
