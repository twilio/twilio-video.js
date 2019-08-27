'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('@twilio/webrtc/lib/util/sdp'),
    getSdpFormat = _require.getSdpFormat;

var constants = require('../../util/constants');
var packageInfo = require('../../../package.json');
var InsightsPublisher = require('../../util/insightspublisher');
var NullInsightsPublisher = require('../../util/insightspublisher/null');
var SIP = require('../../sip');
var DefaultSIPJSMediaHandler = require('./sipjsmediahandler');
var StateMachine = require('../../statemachine');
var util = require('../../util');

var _require2 = require('../../util/twilio-video-errors'),
    RoomCompletedError = _require2.RoomCompletedError;

var _require3 = require('../../util/twilio-video-errors'),
    SignalingConnectionDisconnectedError = _require3.SignalingConnectionDisconnectedError,
    SignalingConnectionError = _require3.SignalingConnectionError,
    SignalingConnectionTimeoutError = _require3.SignalingConnectionTimeoutError,
    SignalingIncomingMessageInvalidError = _require3.SignalingIncomingMessageInvalidError,
    createTwilioError = _require3.createTwilioError;

var RSP_VERSION = 2;
var SDK_NAME = packageInfo.name + '.js';
var SDK_VERSION = packageInfo.version;

/*
Transport States
----------------

                      +-----------+
                      |           |
                      |  syncing  |---------+
                      |           |         |
                      +-----------+         |
                         ^     |            |
                         |     |            |
                         |     v            v
    +------------+    +-----------+    +--------------+
    |            |    |           |    |              |
    | connecting |--->| connected |--->| disconnected |
    |            |    |           |    |              |
    +------------+    +-----------+    +--------------+
             |                              ^
             |                              |
             |                              |
             +------------------------------+

*/

var states = {
  connecting: ['connected', 'disconnected'],
  connected: ['disconnected', 'syncing'],
  syncing: ['connected', 'disconnected'],
  disconnected: []
};

/**
 * A {@link Transport} supports sending and receiving Room Signaling Protocol
 * (RSP) messages. It also supports RSP requests, such as Sync and Disconnect.
 * @extends StateMachine
 * @implements MediaSignalingTransport
 * @emits Transport#connected
 * @emits Transport#message
 */

var Transport = function (_StateMachine) {
  _inherits(Transport, _StateMachine);

  /**
   * Construct a {@link Transport}.
   * @param {?string} name
   * @param {string} accessToken
   * @param {ParticipantSignaling} localParticipant
   * @param {PeerConnectionManager} peerConnectionManager
   * @param {object} ua
   * @param {object} [options]
   */
  function Transport(name, accessToken, localParticipant, peerConnectionManager, ua, options) {
    _classCallCheck(this, Transport);

    options = Object.assign({
      InsightsPublisher: InsightsPublisher,
      NullInsightsPublisher: NullInsightsPublisher,
      SIPJSMediaHandler: DefaultSIPJSMediaHandler,
      sdpFormat: getSdpFormat(),
      userAgent: util.getUserAgent()
    }, options);

    var _this = _possibleConstructorReturn(this, (Transport.__proto__ || Object.getPrototypeOf(Transport)).call(this, 'connecting', states));

    var eventPublisherOptions = {};
    if (options.wsServerInsights) {
      eventPublisherOptions.gateway = options.wsServerInsights;
    }

    var EventPublisher = options.insights ? options.InsightsPublisher : options.NullInsightsPublisher;
    Object.defineProperties(_this, {
      _eventPublisher: {
        value: new EventPublisher(accessToken, SDK_NAME, SDK_VERSION, options.environment, options.realm, eventPublisherOptions)
      },
      _sdpFormat: {
        value: options.sdpFormat
      },
      _updatesReceived: {
        value: []
      },
      _updatesToSend: {
        value: []
      },
      _userAgent: {
        value: options.userAgent
      }
    });

    Object.defineProperties(_this, {
      _session: {
        value: createSession(_this, name, accessToken, localParticipant, peerConnectionManager, ua, options.SIPJSMediaHandler, options.iceServerSourceStatus, options.dominantSpeaker, options.networkQuality)
      }
    });
    setupEventListeners(_this, _this._session, ua);

    _this.once('connected', function (_ref) {
      var sid = _ref.sid,
          participant = _ref.participant;

      _this._eventPublisher.connect(sid, participant.sid);
    });
    return _this;
  }

  /**
   * Disconnect the {@link Transport}. Returns true if calling the method resulted
   * in disconnection.
   * @param {TwilioError} [error]
   * @returns {boolean}
   */


  _createClass(Transport, [{
    key: 'disconnect',
    value: function disconnect(error) {
      if (this.state !== 'disconnected') {
        this.preempt('disconnected', null, [error]);
        this._session.terminate({
          body: JSON.stringify({
            type: 'disconnect',
            version: RSP_VERSION
          }),
          extraHeaders: ['Content-Type: application/room-signaling+json']
        });
        this._eventPublisher.disconnect();
        return true;
      }
      return false;
    }

    /**
     * Publish an RSP Update. Returns true if calling the method resulted in
     * publishing (or eventually publishing) the update.
     * @param {object} update
     * @returns {boolean}
     */

  }, {
    key: 'publish',
    value: function publish(update) {
      update = Object.assign({
        type: 'update',
        version: RSP_VERSION
      }, update);
      switch (this.state) {
        case 'connected':
          publishWithRetries(this, this._session, update);
          return true;
        case 'connecting':
        case 'syncing':
          this._updatesToSend.push(update);
          return true;
        case 'disconnected':
        default:
          return false;
      }
    }

    /**
     * Publish (or queue) an event to the Insights gateway.
     * @param {string} groupName - Event group name
     * @param {string} eventName - Event name
     * @param {object} payload - Event payload
     * @returns {boolean} true if queued or published, false if disconnected from the Insights gateway
     */

  }, {
    key: 'publishEvent',
    value: function publishEvent(groupName, eventName, payload) {
      return this._eventPublisher.publish(groupName, eventName, payload);
    }

    /**
     * Sync the {@link Transport}. Returns true if calling the method resulted in
     * syncing.
     * @returns {boolean}
     */

  }, {
    key: 'sync',
    value: function sync() {
      if (this.state === 'connected') {
        this.preempt('syncing');
        this._session.sendReinvite();
        return true;
      }
      return false;
    }
  }]);

  return Transport;
}(StateMachine);

/**
 * @event Transport#connected
 * @param {object} initialState
 */

/**
 * @event Transport#message
 * @param {object} state
 */

function createSession(transport, name, accessToken, localParticipant, peerConnectionManager, ua, SIPJSMediaHandler, iceServerSourceStatus, dominantSpeaker, networkQuality) {
  var target = 'sip:' + util.makeServerSIPURI();
  return ua.invite(target, {
    extraHeaders: [constants.headers.X_TWILIO_ACCESSTOKEN + ': ' + accessToken, 'Session-Expires: 120'],
    media: { stream: {} },
    mediaHandlerFactory: function mediaHandlerFactory() {
      return new SIPJSMediaHandler(peerConnectionManager, function createMessage() {
        if (transport.state === 'disconnected') {
          return {
            type: 'disconnect',
            version: RSP_VERSION
          };
        }
        var type = {
          connecting: 'connect',
          syncing: 'sync'
        }[transport.state] || 'update';

        var message = {
          name: name,
          participant: localParticipant.getState(),
          type: type,
          version: RSP_VERSION
        };

        if (message.type === 'connect') {
          message.ice_servers = iceServerSourceStatus;
          message.publisher = {
            name: SDK_NAME,
            sdk_version: SDK_VERSION,
            user_agent: transport._userAgent
          };
          message.media_signaling = {};
          if (networkQuality) {
            message.media_signaling.network_quality = {
              transports: [{ type: 'data-channel' }]
            };
          }
          if (dominantSpeaker) {
            message.media_signaling.active_speaker = {
              transports: [{ type: 'data-channel' }]
            };
          }
        }

        var sdpFormat = transport._sdpFormat;
        if (type === 'connect' && sdpFormat) {
          message.format = sdpFormat;
        }

        return message;
      });
    },
    onInfo: function onInfo(request) {
      this.emit('info', request);
      request.reply(200);
    }
  });
}

/**
 * Add random jitter to a given value in the range [-jitter, jitter].
 * @private
 * @param {number} value
 * @param {number} jitter
 * @returns {number} value + random(-jitter, +jitter)
 */
function withJitter(value, jitter) {
  var rand = Math.random();
  return value - jitter + Math.floor(2 * jitter * rand + 0.5);
}

function publishWithRetries(transport, session, payload, attempts) {
  attempts = attempts || 0;
  return new Promise(function (resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        case 5:
          if (attempts < constants.PUBLISH_MAX_ATTEMPTS) {
            resolve(publishWithRetries(transport, session, payload, ++attempts));
          } else {
            reject(new Error('Transport failed to send a message even after ' + constants.PUBLISH_MAX_ATTEMPTS + ' attempts'));
          }
          break;
        default:
          reject(response);
      }
    }
    function sendRequest() {
      if (transport.state === 'disconnected') {
        return;
      }
      session.sendRequest('INFO', {
        body: JSON.stringify(payload),
        extraHeaders: ['Content-Type: application/room-signaling+json', 'Event: room-signaling', 'Info-Package: room-signaling'],
        receiveResponse: receiveResponse
      });
    }
    if (attempts === 0) {
      sendRequest();
      return;
    }

    var backOffMs = (1 << attempts - 1) * constants.PUBLISH_BACKOFF_MS;
    setTimeout(sendRequest, withJitter(backOffMs, constants.PUBLISH_BACKOFF_JITTER));
  });
}

function reducePeerConnections(peerConnections) {
  return Array.from(peerConnections.reduce(function (peerConnectionsById, update) {
    var reduced = peerConnectionsById.get(update.id) || update;

    // First, reduce the top-level `description` property.
    if (!reduced.description && update.description) {
      reduced.description = update.description;
    } else if (reduced.description && update.description) {
      if (update.description.revision > reduced.description.revision) {
        reduced.description = update.description;
      }
    }

    // Then, reduce the top-level `ice` property.
    if (!reduced.ice && update.ice) {
      reduced.ice = update.ice;
    } else if (reduced.ice && update.ice) {
      if (update.ice.revision > reduced.ice.revision) {
        reduced.ice = update.ice;
      }
    }

    // Finally, update the map.
    peerConnectionsById.set(reduced.id, reduced);

    return peerConnectionsById;
  }, new Map()).values());
}

function reduceUpdates(updates) {
  return updates.reduce(function (reduced, update) {
    // First, reduce the top-level `participant` property.
    if (!reduced.participant && update.participant) {
      reduced.participant = update.participant;
    } else if (reduced.participant && update.participant) {
      if (update.participant.revision > reduced.participant.revision) {
        reduced.participant = update.participant;
      }
    }

    // Then, reduce the top-level `peer_connections` property.
    /* eslint camelcase:0 */
    if (!reduced.peer_connections && update.peer_connections) {
      reduced.peer_connections = reducePeerConnections(update.peer_connections);
    } else if (reduced.peer_connections && update.peer_connections) {
      reduced.peer_connections = reducePeerConnections(reduced.peer_connections.concat(update.peer_connections));
    }

    return reduced;
  }, {
    type: 'update',
    version: RSP_VERSION
  });
}

/**
 * Parse the body of a SIP incoming request or response.
 * @param {object} requestOrResponse
 * @returns {?object}
 * @throws {SignalingIncomingMessageInvalidError}
 */
function parseRequestOrResponseBody(requestOrResponse) {
  if (requestOrResponse.body) {
    try {
      return JSON.parse(requestOrResponse.body);
    } catch (e) {
      throw new SignalingIncomingMessageInvalidError();
    }
  }
  return null;
}

/**
 * Get a {@link TwilioError} for a SIP incoming request or response from its body.
 * @param {object} requestOrResponse
 * @returns {?TwilioError}
 */
function getTwilioErrorFromRequestOrResponseBody(requestOrResponse) {
  try {
    var message = parseRequestOrResponseBody(requestOrResponse);
    if (message) {
      switch (message.type) {
        case 'disconnected':
          if (message.status === 'completed') {
            return new RoomCompletedError();
          }
          break;
        case 'error':
          return createTwilioError(message.code, message.message);
        default:
          break;
      }
    }
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Get a {@link TwilioError} for a SIP incoming request or response from its headers.
 * @param {object} requestOrResponse
 * @returns {?TwilioError}
 */
function getTwilioErrorFromRequestOrResponseHeaders(requestOrResponse) {
  var headers = requestOrResponse.headers;
  if (headers && headers['X-Twilio-Error']) {
    var twilioErrorHeader = headers['X-Twilio-Error'][0].raw.split(' ');
    var code = parseInt(twilioErrorHeader[0], 10);
    var message = twilioErrorHeader.slice(1).join(' ');
    return createTwilioError(code, message);
  }
  return null;
}

/**
 * Create a {@link TwilioError} from a SIP request or response.
 * @param {object} requestOrResponse - SIP request or response
 * @returns {?TwilioError}
 */
function getTwilioErrorFromRequestOrResponse(requestOrResponse) {
  return getTwilioErrorFromRequestOrResponseHeaders(requestOrResponse) || getTwilioErrorFromRequestOrResponseBody(requestOrResponse);
}

function setupEventListeners(transport, session, ua) {
  function disconnect(requestOrResponse, cause) {
    var twilioError = void 0;

    if (requestOrResponse && !(requestOrResponse instanceof SIP.OutgoingRequest)) {
      twilioError = getTwilioErrorFromRequestOrResponse(requestOrResponse);
    }

    if (!twilioError) {
      switch (cause) {
        case SIP.C.causes.REQUEST_TIMEOUT:
          twilioError = new SignalingConnectionTimeoutError();
          break;
        case SIP.C.causes.CONNECTION_ERROR:
          twilioError = new SignalingConnectionError();
          break;
        default:
          twilioError = new SignalingConnectionDisconnectedError();
      }
    }

    transport.disconnect(twilioError);
  }

  function handleRequestOrResponse(requestOrResponse) {
    // We don't need to handle requests we sent ourselves.
    if (requestOrResponse instanceof SIP.OutgoingRequest) {
      return;
    }

    // Handle any errors first.
    var error = void 0;
    try {
      error = getTwilioErrorFromRequestOrResponse(requestOrResponse);
    } catch (e) {
      if (e instanceof SignalingIncomingMessageInvalidError) {
        return;
      }
      error = e;
    }

    // If we get an error other than a SignalingIncomingMessageInvalidError,
    // then disconnect.
    if (error) {
      transport.disconnect(error);
      return;
    }

    // Otherwise, try to parse the RSP message.
    var message = void 0;
    try {
      message = parseRequestOrResponseBody(requestOrResponse);
    } catch (e) {}
    // Do nothing.


    // If there's no RSP message to handle, just return.
    if (!message) {
      return;
    }

    switch (transport.state) {
      case 'connected':
        switch (message.type) {
          case 'connected':
          case 'synced':
          case 'update':
            transport.emit('message', message);
            return;
          case 'disconnected':
            transport.disconnect(message.status === 'completed' ? new RoomCompletedError() : null);
            return;
          default:
            // Do nothing.
            return;
        }
      case 'connecting':
        switch (message.type) {
          case 'connected':
            transport.emit('connected', message);
            transport.preempt('connected');
            return;
          case 'synced':
          case 'update':
            transport._updatesReceived.push(message);
            return;
          case 'disconnected':
            transport.disconnect(message.status === 'completed' ? new RoomCompletedError() : null);
            return;
          default:
            // Do nothing.
            return;
        }
      case 'disconnected':
        // Do nothing.
        return;
      case 'syncing':
        switch (message.type) {
          case 'connected':
          case 'update':
            transport._updatesReceived.push(message);
            return;
          case 'synced':
            transport.emit('message', message);
            transport.preempt('connected');
            return;
          case 'disconnected':
            transport.disconnect(message.status === 'completed' ? new RoomCompletedError() : null);
            return;
          default:
            // Do nothing.
            return;
        }
      default:
        // Impossible
        return;
    }
  }

  session.on('info', handleRequestOrResponse);
  session.once('bye', disconnect);

  session.once('accepted', handleRequestOrResponse);
  session.once('failed', disconnect);

  transport.on('stateChanged', function stateChanged(state) {
    switch (state) {
      case 'connected':
        {
          session.removeListener('accepted', handleRequestOrResponse);
          session.removeListener('failed', disconnect);

          var updates = transport._updatesToSend.splice(0);
          if (updates.length) {
            transport.publish(reduceUpdates(updates));
          }

          transport._updatesReceived.splice(0).forEach(transport.emit.bind(transport, 'message'));

          return;
        }
      case 'disconnected':
        session.removeListener('accepted', handleRequestOrResponse);
        session.removeListener('failed', disconnect);
        session.removeListener('info', handleRequestOrResponse);
        session.removeListener('bye', disconnect);
        transport.removeListener('stateChanged', stateChanged);
        ua.stop();
        return;
      case 'syncing':
        // Do nothing.
        return;
      default:
        // Impossible
        return;
    }
  });

  ua.once('disconnected', disconnect);
  ua.once('keepAliveTimeout', function () {
    return transport.disconnect(new SignalingConnectionTimeoutError());
  });
}

module.exports = Transport;