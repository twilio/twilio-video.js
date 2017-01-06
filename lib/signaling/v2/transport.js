'use strict';

var constants = require('../../util/constants');
var inherits = require('util').inherits;
var SIP = require('../../sip');
var DefaultSIPJSMediaHandler = require('./sipjsmediahandler');
var StateMachine = require('../../statemachine');
var util = require('../../util');

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
 * @param {string} accountSid
 * @param {string} accessToken
 * @param {ParticipantSignaling} localParticipant
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {object} ua
 * @param {object} [options]
 * @emits Transport#connected
 * @emits Transport#message
 */
function Transport(name, accountSid, accessToken, localParticipant, peerConnectionManager, ua, options) {
  if (!(this instanceof Transport)) {
    return new Transport(name, accountSid, accessToken, localParticipant, peerConnectionManager, ua, options);
  }
  options = Object.assign({
    SIPJSMediaHandler: DefaultSIPJSMediaHandler
  }, options);
  StateMachine.call(this, 'connecting', states);
  var session = createSession(this, name, accountSid, accessToken, localParticipant, peerConnectionManager, ua, options.SIPJSMediaHandler);
  Object.defineProperties(this, {
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
 * @returns {boolean}
 */
Transport.prototype.disconnect = function disconnect() {
  if (this.state !== 'disconnected') {
    this.preempt('disconnected');
    this._session.terminate({
      body: JSON.stringify({
        type: 'disconnect',
        version: VERSION
      }),
      extraHeaders: [
        'Content-Type: application/room-signaling+json'
      ]
    });
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
      publishWithRetries(this._session, update);
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

function createSession(transport, name, accountSid, accessToken, localParticipant, peerConnectionManager, ua, SIPJSMediaHandler) {
  var target = 'sip:' + util.makeSIPURI(accountSid, 'orchestrator');
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

function publishWithRetries(session, payload, attempts) {
  attempts = attempts || 0;
  return new Promise(function(resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        case 5:
          if (attempts < constants.PUBLISH_MAX_ATTEMPTS) {
            resolve(publishWithRetries(session, payload, ++attempts));
            break;
          }
          break;
        default:
          reject(response);
      }
    }
    function sendRequest() {
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
    setTimeout(sendRequest, attempts * constants.PUBLISH_BACKOFF_MS);
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

function setupEventListeners(transport, session, ua) {
  function disconnect() {
    transport.disconnect();
  }

  function handleRequestOrResponse(requestOrResponse) {
    if (requestOrResponse instanceof SIP.OutgoingRequest) {
      return;
    }

    var message;
    try {
      message = JSON.parse(requestOrResponse.body);
    } catch (error) {
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
          case 'error':
          case 'disconnected':
            transport.disconnect();
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
          case 'error':
          case 'disconnected':
            transport.disconnect();
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
          case 'error':
            transport.disconnect();
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
