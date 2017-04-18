'use strict';

var constants = require('../../util/constants');
var inherits = require('util').inherits;
var packageInfo = require('../../../package.json');
var InsightsPublisher = require('../../util/insightspublisher');
var SIP = require('../../sip');
var DefaultSIPJSMediaHandler = require('./sipjsmediahandler');
var StateMachine = require('../../statemachine');
var util = require('../../util');
var TwilioErrors = require('../../util/twilio-video-errors');
var createTwilioError = TwilioErrors.createTwilioError;
var SignalingConnectionError = TwilioErrors.SignalingConnectionError;
var SignalingConnectionTimeoutError = TwilioErrors.SignalingConnectionTimeoutError;
var SignalingIncomingMessageInvalidError = TwilioErrors.SignalingIncomingMessageInvalidError;

var SDK_NAME = packageInfo.name + '.js';
var SDK_VERSION = packageInfo.version;
var VERSION = 1;

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
 * Construct a {@link Transport}.
 * @extends StateMachine
 * @class
 * @classdesc A {@link Transport} supports sending and receiving Room Signaling
 * Protocol (RSP) messages. It also supports RSP requests, such as Sync and
 * Disconnect.
 * @param {?string} name
 * @param {string} accessToken
 * @param {ParticipantSignaling} localParticipant
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {object} ua
 * @param {object} [options]
 * @emits Transport#connected
 * @emits Transport#message
 */
function Transport(name, accessToken, localParticipant, peerConnectionManager, ua, options) {
  if (!(this instanceof Transport)) {
    return new Transport(name, accessToken, localParticipant, peerConnectionManager, ua, options);
  }
  options = Object.assign({
    InsightsPublisher: InsightsPublisher,
    SIPJSMediaHandler: DefaultSIPJSMediaHandler
  }, options);
  StateMachine.call(this, 'connecting', states);

  var eventPublisherOptions = {};
  if (options.wsServerInsights) {
    eventPublisherOptions.gateway = options.wsServerInsights;
  }

  var session = createSession(this, name, accessToken, localParticipant, peerConnectionManager, ua, options.SIPJSMediaHandler);
  Object.defineProperties(this, {
    _eventPublisher: {
      value: new options.InsightsPublisher(
        accessToken,
        SDK_NAME,
        SDK_VERSION,
        options.environment,
        options.realm,
        eventPublisherOptions)
    },
    _session: {
      value: session
    },
    _updatesReceived: {
      value: []
    },
    _updatesToSend: {
      value: []
    }
  });
  setupEventListeners(this, session, ua);
}

inherits(Transport, StateMachine);

/**
 * Disconnect the {@link Transport}. Returns true if calling the method resulted
 * in disconnection.
 * @param {TwilioError} [error]
 * @returns {boolean}
 */
Transport.prototype.disconnect = function disconnect(error) {
  if (this.state !== 'disconnected') {
    this.preempt('disconnected', null, [error]);
    this._session.terminate({
      body: JSON.stringify({
        type: 'disconnect',
        version: VERSION
      }),
      extraHeaders: [
        'Content-Type: application/room-signaling+json'
      ]
    });
    this._eventPublisher.disconnect();
    return true;
  }
  return false;
};

/**
 * Publish an RSP Update. Returns true if calling the method resulted in
 * publishing (or eventually publishing) the update.
 * @param {object} update
 * @returns {boolean}
 */
Transport.prototype.publish = function publish(update) {
  update = Object.assign({
    type: 'update',
    version: VERSION
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
};

/**
 * Publish (or queue) an event to the Insights gateway.
 * @method
 * @param {string} groupName - Event group name
 * @param {string} eventName - Event name
 * @param {object} payload - Event payload
 * @returns {boolean} true if queued or published, false if disconnected from the Insights gateway
 */
Transport.prototype.publishEvent = function publishEvent(groupName, eventName, payload) {
  return this._eventPublisher.publish(groupName, eventName, payload);
};

/**
 * Sync the {@link Transport}. Returns true if calling the method resulted in
 * syncing.
 * @returns {boolean}
 */
Transport.prototype.sync = function sync() {
  if (this.state === 'connected') {
    this.preempt('syncing');
    this._session.sendReinvite();
    return true;
  }
  return false;
};

/**
 * @event Transport#connected
 * @param {object} initialState
 */

/**
 * @event Transport#message
 * @param {object} state
 */

function createSession(transport, name, accessToken, localParticipant, peerConnectionManager, ua, SIPJSMediaHandler) {
  var target = 'sip:' + util.makeServerSIPURI();
  return ua.invite(target, {
    extraHeaders: [
      constants.headers.X_TWILIO_ACCESSTOKEN + ': ' + accessToken,
      'Session-Expires: 120'
    ],
    media: { stream: {} },
    mediaHandlerFactory: function mediaHandlerFactory() {
      return new SIPJSMediaHandler(peerConnectionManager, function createMessage() {
        if (transport.state === 'disconnected') {
          return {
            type: 'disconnect',
            version: VERSION
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
          version: VERSION
        };

        var sdpFormat = util.getSdpFormat();
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
  return new Promise(function(resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        case 5:
          if (attempts < constants.PUBLISH_MAX_ATTEMPTS) {
            resolve(publishWithRetries(transport, session, payload, ++attempts));
          } else {
            reject(new Error('Transport failed to send a message even '
              + 'after ' + constants.PUBLISH_MAX_ATTEMPTS + ' attempts'));
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
        receiveResponse: receiveResponse
      });
    }
    if (attempts === 0) {
      sendRequest();
      return;
    }

    var backOffMs = (1 << (attempts - 1)) * constants.PUBLISH_BACKOFF_MS;
    setTimeout(sendRequest, withJitter(backOffMs, constants.PUBLISH_BACKOFF_JITTER));
  });
}

function reducePeerConnections(peerConnections) {
  return Array.from(peerConnections.reduce(function(peerConnectionsById, update) {
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
  return updates.reduce(function(reduced, update) {
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
    version: VERSION
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
    return message && message.type === 'error'
      ? createTwilioError(message.code, message.message)
      : null;
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
  return getTwilioErrorFromRequestOrResponseHeaders(requestOrResponse)
    || getTwilioErrorFromRequestOrResponseBody(requestOrResponse);
}

function setupEventListeners(transport, session, ua) {
  function disconnect(requestOrResponse, cause) {
    var twilioError;

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
    var error;
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
    var message;
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
            transport.preempt('disconnected');
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
            transport.preempt('disconnected');
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
            transport.preempt('disconnected');
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
        session.removeListener('accepted', handleRequestOrResponse);
        session.removeListener('failed', disconnect);

        var updates = transport._updatesToSend.splice(0);
        if (updates.length) {
          transport.publish(reduceUpdates(updates));
        }

        transport._updatesReceived.splice(0).forEach(transport.emit.bind(transport, 'message'));

        return;
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
}

module.exports = Transport;
