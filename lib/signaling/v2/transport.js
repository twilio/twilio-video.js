'use strict';

const { getSdpFormat } = require('@twilio/webrtc/lib/util/sdp');
const constants = require('../../util/constants');
const packageInfo = require('../../../package.json');
const InsightsPublisher = require('../../util/insightspublisher');
const NullInsightsPublisher = require('../../util/insightspublisher/null');
const SIP = require('../../sip');
const DefaultSIPJSMediaHandler = require('./sipjsmediahandler');
const StateMachine = require('../../statemachine');
const util = require('../../util');
const { RoomCompletedError } = require('../../util/twilio-video-errors');

const {
  SignalingConnectionDisconnectedError,
  SignalingConnectionError,
  SignalingConnectionTimeoutError,
  SignalingIncomingMessageInvalidError,
  createTwilioError,
} = require('../../util/twilio-video-errors');

const RSP_VERSION = 2;
const SDK_NAME = `${packageInfo.name}.js`;
const SDK_VERSION = packageInfo.version;

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

const states = {
  connecting: [
    'connected',
    'disconnected'
  ],
  connected: [
    'disconnected',
    'syncing'
  ],
  syncing: [
    'connected',
    'disconnected'
  ],
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
class Transport extends StateMachine {
  /**
   * Construct a {@link Transport}.
   * @param {?string} name
   * @param {string} accessToken
   * @param {ParticipantSignaling} localParticipant
   * @param {PeerConnectionManager} peerConnectionManager
   * @param {object} ua
   * @param {object} [options]
   */
  constructor(name, accessToken, localParticipant, peerConnectionManager, ua, options) {
    options = Object.assign({
      InsightsPublisher,
      NullInsightsPublisher,
      SIPJSMediaHandler: DefaultSIPJSMediaHandler,
      sdpFormat: getSdpFormat(),
      userAgent: util.getUserAgent()
    }, options);
    super('connecting', states);

    const eventPublisherOptions = {};
    if (options.wsServerInsights) {
      eventPublisherOptions.gateway = options.wsServerInsights;
    }

    const EventPublisher = options.insights ? options.InsightsPublisher : options.NullInsightsPublisher;
    Object.defineProperties(this, {
      _eventPublisher: {
        value: new EventPublisher(
          accessToken,
          SDK_NAME,
          SDK_VERSION,
          options.environment,
          options.realm,
          eventPublisherOptions)
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

    Object.defineProperties(this, {
      _session: {
        value: createSession(this,
          name,
          accessToken,
          localParticipant,
          peerConnectionManager,
          ua,
          options.SIPJSMediaHandler,
          options.iceServerSourceStatus,
          options.dominantSpeaker,
          options.networkQuality)
      }
    });
    setupEventListeners(this, this._session, ua);

    this.once('connected', ({ sid, participant }) => {
      this._eventPublisher.connect(sid, participant.sid);
    });
  }

  /**
   * Disconnect the {@link Transport}. Returns true if calling the method resulted
   * in disconnection.
   * @param {TwilioError} [error]
   * @returns {boolean}
   */
  disconnect(error) {
    if (this.state !== 'disconnected') {
      this.preempt('disconnected', null, [error]);
      this._session.terminate({
        body: JSON.stringify({
          type: 'disconnect',
          version: RSP_VERSION
        }),
        extraHeaders: [
          'Content-Type: application/room-signaling+json'
        ]
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
  publish(update) {
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
  publishEvent(groupName, eventName, payload) {
    return this._eventPublisher.publish(groupName, eventName, payload);
  }

  /**
   * Sync the {@link Transport}. Returns true if calling the method resulted in
   * syncing.
   * @returns {boolean}
   */
  sync() {
    if (this.state === 'connected') {
      this.preempt('syncing');
      this._session.sendReinvite();
      return true;
    }
    return false;
  }
}

/**
 * @event Transport#connected
 * @param {object} initialState
 */

/**
 * @event Transport#message
 * @param {object} state
 */

function createSession(transport, name, accessToken, localParticipant, peerConnectionManager, ua, SIPJSMediaHandler, iceServerSourceStatus, dominantSpeaker, networkQuality) {
  const target = `sip:${util.makeServerSIPURI()}`;
  return ua.invite(target, {
    extraHeaders: [
      `${constants.headers.X_TWILIO_ACCESSTOKEN}: ${accessToken}`,
      'Session-Expires: 120'
    ],
    media: { stream: {} },
    mediaHandlerFactory: function mediaHandlerFactory() {
      return new SIPJSMediaHandler(peerConnectionManager, function createMessage() {
        if (transport.state === 'disconnected') {
          return {
            type: 'disconnect',
            version: RSP_VERSION
          };
        }
        const type = {
          connecting: 'connect',
          syncing: 'sync'
        }[transport.state] || 'update';

        const message = {
          name,
          participant: localParticipant.getState(),
          type,
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
              transports: [
                { type: 'data-channel' }
              ]
            };
          }
          if (dominantSpeaker) {
            message.media_signaling.active_speaker = {
              transports: [
                { type: 'data-channel' }
              ]
            };
          }
        }

        const sdpFormat = transport._sdpFormat;
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
  const rand = Math.random();
  return value - jitter + Math.floor(2 * jitter * rand + 0.5);
}

function publishWithRetries(transport, session, payload, attempts) {
  attempts = attempts || 0;
  return new Promise((resolve, reject) => {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        case 5:
          if (attempts < constants.PUBLISH_MAX_ATTEMPTS) {
            resolve(publishWithRetries(transport, session, payload, ++attempts));
          } else {
            reject(new Error(`Transport failed to send a message even after ${constants.PUBLISH_MAX_ATTEMPTS} attempts`));
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
        extraHeaders: [
          'Content-Type: application/room-signaling+json',
          'Event: room-signaling',
          'Info-Package: room-signaling'
        ],
        receiveResponse
      });
    }
    if (attempts === 0) {
      sendRequest();
      return;
    }

    const backOffMs = (1 << (attempts - 1)) * constants.PUBLISH_BACKOFF_MS;
    setTimeout(sendRequest, withJitter(backOffMs, constants.PUBLISH_BACKOFF_JITTER));
  });
}

function reducePeerConnections(peerConnections) {
  return Array.from(peerConnections.reduce((peerConnectionsById, update) => {
    const reduced = peerConnectionsById.get(update.id) || update;

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
  return updates.reduce((reduced, update) => {
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
      reduced.peer_connections = reducePeerConnections(
        reduced.peer_connections.concat(update.peer_connections));
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
    const message = parseRequestOrResponseBody(requestOrResponse);
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
  const headers = requestOrResponse.headers;
  if (headers && headers['X-Twilio-Error']) {
    const twilioErrorHeader = headers['X-Twilio-Error'][0].raw.split(' ');
    const code = parseInt(twilioErrorHeader[0], 10);
    const message = twilioErrorHeader.slice(1).join(' ');
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
  return getTwilioErrorFromRequestOrResponseHeaders(requestOrResponse)
    || getTwilioErrorFromRequestOrResponseBody(requestOrResponse);
}

function setupEventListeners(transport, session, ua) {
  function disconnect(requestOrResponse, cause) {
    let twilioError;

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
    let error;
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
    let message;
    try {
      message = parseRequestOrResponseBody(requestOrResponse);
    } catch (e) {
      // Do nothing.
    }

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
            transport.disconnect(message.status === 'completed'
              ? new RoomCompletedError()
              : null);
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
            transport.disconnect(message.status === 'completed'
              ? new RoomCompletedError()
              : null);
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
            transport.disconnect(message.status === 'completed'
              ? new RoomCompletedError()
              : null);
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
      case 'connected': {
        session.removeListener('accepted', handleRequestOrResponse);
        session.removeListener('failed', disconnect);

        const updates = transport._updatesToSend.splice(0);
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
  ua.once('keepAliveTimeout', () => transport.disconnect(new SignalingConnectionTimeoutError()));
}

module.exports = Transport;
