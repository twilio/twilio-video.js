'use strict';

const constants = require('../../util/constants');
const defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
const LocalParticipantV2 = require('./localparticipant');
const Signaling = require('../');
const SIP = require('../../sip');
const SIPJSMediaHandler = require('./sipjsmediahandler');
const util = require('../../util');

/**
 * Construct {@link SignalingV2}.
 * @class
 * @classdesc {@link SignalingV2} implements version 2 of our signaling
 * protocol.
 * @extends {Signaling}
 * @param {string} wsServer
 * @param {?object} [options={}]
 */
class SignalingV2 extends Signaling {
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
    const ua = new UA({
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
      }
    });
  }

  _close(key) {
    this.transition('closing', key);
    this._ua.stop();
    this._ua.transport.disconnect();
    this.transition('closed', key);
    return Promise.resolve(this);
  }

  _open(key) {
    const self = this;

    function startUA() {
      self._ua.start();
    }

    this.transition('opening', key);
    return util.promiseFromEvents(startUA, this._ua, 'connected', 'disconnected').then(() => {
      self.transition('open', key);
      return self;
    }, () => {
      self.transition('closed', key);
      throw new Error('Open failed');
    });
  }

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

    return this._createCancelableRoomSignalingPromise.bind(
      null,
      token,
      ua,
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
