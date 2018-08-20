'use strict';

const constants = require('../../util/constants');
const defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
const LocalParticipantV2 = require('./localparticipant');
const Signaling = require('../');
const SIP = require('../../sip');
const SIPJSMediaHandler = require('./sipjsmediahandler');
const util = require('../../util');

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
    const uri = util.makeClientSIPURI();

    /* eslint new-cap:0 */
    options = Object.assign({
      createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise,
      registrarServer: constants.REGISTRAR_SERVER,
      UA: SIP.UA
    }, options);

    const debug = options.logLevel === 'debug';
    const useWssHack = wsServer.startsWith('wss://');

    const UA = options.UA;
    const ua = options._useTwilioConnection ? null : new UA({
      autostart: false,
      log: {
        builtinEnabled: debug
      },
      extraSupported: ['room-signaling', 'timer'],
      hackAllowUnregisteredOptionTags: true,
      keepAliveInterval: 30,
      mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
      register: false,
      registrarServer: options.registrarServer,
      traceSip: debug,
      uri,
      wsServers: wsServer,
      hackWssInTransport: useWssHack
    });

    super();

    Object.defineProperties(this, {
      _createCancelableRoomSignalingPromise: {
        value: options.createCancelableRoomSignalingPromise
      },
      _options: {
        value: options
      },
      _ua: {
        value: ua
      },
      _wsServer: {
        value: wsServer
      }
    });
  }

  /**
   * @private
   */
  _close(key) {
    if (!this._ua) {
      this.transition('closing', key);
      this.transition('closed', key);
      return Promise.resolve(this);
    }
    this.transition('closing', key);
    this._ua.stop();
    this._ua.transport.disconnect();
    this.transition('closed', key);
    return Promise.resolve(this);
  }

  /**
   * @private
   */
  _open(key) {
    if (!this._ua) {
      this.transition('opening', key);
      this.transition('open', key);
      return Promise.resolve(this);
    }
    const ua = this._ua;

    function startUA() {
      ua.start();
    }

    this.transition('opening', key);
    return util.promiseFromEvents(startUA, ua, 'connected', 'disconnected').then(() => {
      this.transition('open', key);
      return this;
    }, () => {
      this.transition('closed', key);
      throw new Error('Open failed');
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

    const ua = this._ua;
    const wsServer = this._wsServer;

    return this._createCancelableRoomSignalingPromise.bind(
      null,
      token,
      ua || wsServer,
      localParticipant,
      iceServerSource,
      encodingParameters,
      preferredCodecs,
      options);
  }

  createLocalParticipantSignaling(encodingParameters) {
    return new LocalParticipantV2(encodingParameters);
  }
}

module.exports = SignalingV2;
