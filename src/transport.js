// Node support for WebSockets.
if (typeof process !== 'undefined' && typeof WebSocket === 'undefined') {
  var WebSocket = require('ws');
}

var events = require('events');
var util = require('util');

var PeerSession = require('./session/peersession');
var TwiMLSession = require('./session/twimlsession');

/**
 * The {@link Transport} instance's WebSocket.
 */
var webSocket = null;

/**
 * The {@link Transport} instance.
 */
var transport = null;

/**
 * A map from Simple Signaling domains to a map from {@link Peer} names to {@link Peer}s.
 */
var peers = {};

/**
 * A map from {@link Peer}s to a map from {@link Session} IDs to {@link Session}s.
 */
var sessions = {};

/**
 * A map from {@link Session}s to {@link Session} IDs.
 */
var sessionToId = {};

/**
 * A queue of messages (strings) to send once the WebSocket is open.
 */
var queue = [];

/**
 * The {@link Transport} encapsulates a WebSocket connection to Twilio and handles the dispatch of messages to
 * {@link Peer}s and {@link Session}s. {@link Transport} is a singleton and so this constructor should never be
 * called directly; instead, use {@link Transport.getInstance}.
 * @class
 * @param {Object} webSocket - The WebSocket connection to encapsulate
 */
function Transport(_webSocket) {
  var self = this instanceof Transport ? this : Object.create(Transport.prototype);
  events.EventEmitter.call(self);

  // Setup the WebSocket.
  webSocket = _webSocket;
  webSocket.onopen = function onopen() {
    queue.forEach(function(message) {
      try {
        webSocket.send(message);
      } catch (e) {
        self.emit('error', e, message);
      }
    });
    queue = [];
  };
  webSocket.onmessage = function onmessage(event) {
    var message = null;

    // Attempt to parse the message.
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      return self.emit('error', e, event.data);
    }

    // Verify that the message contains the required fields.
    var domain = message.domain;
    if (!domain) {
      return self.emit('error', new TypeError('Message lacks domain'), message);
    }
    if (!getPeers(domain)) {
      return self.emit('error', new Error('No domain to route to'), message);
    }
    var peer = message.peer;
    if (!peer) {
      return self.emit('error', new TypeError('Message lacks peer'), message);
    }
    peer = getPeer(message.domain, message.peer);
    if (!peer) {
      return self.emit('error', new Error('No peer to route to'), message);
    }

    // TODO(mroberts): Refactor this. Right now, we have more sophisticated
    // logic for dispatching on messages in `test/server.js'.
    if (message.type === 'register') {
      peer.emit('registered');
      return self;
    } else if (message.type === 'connect') {
      var recv_target = message.target;
      var new_session;
      switch (recv_target.type) {
        case 'twiml':
          new_session = new TwiMLSession(recv_target.name);
          break;
        case 'peer':
          new_session = new PeerSession(recv_target.name);
          break;
        default:
          // TODO(mroberts): Handle error.
          break;
      }
      peer.emit('connected', new_session);
      return self;
    }

    // Lookup and send to the recipient.
    var recipient = peer;
    if (message.session) {
      recipient = sessions[peer][message.session];
      if (!recipient) {
        return self.emit('error', new Error('No session to route to'), message);
      }
    }
    // recipient.receiveMessage(message.data);
    recipient.emit('message', message.data || null);
  };

  return self;
}

/**
 * Get the {@link Transport} instance.
 * @returns Transport
 */
Transport.getInstance = function getInstance() {
  transport = transport || new Transport(new WebSocket('ws://127.0.0.1:8080'));
  return transport;
};

util.inherits(Transport, events.EventEmitter);

Transport.prototype.register = function register(peer, callback) {
  var domain = peer.dom;
  var name = peer.name;
  var request = JSON.stringify({
    domain: domain,
    type: 'register',
    peer: name
  });
  setPeer(peer);
  if (callback) {
    peer.once('registered', callback);
  }
  if (webSocket.readyState < 1) {
    queue.push(request);
    return this;
  }
  try {
    webSocket.send(request);
  } catch (e) {
    this.emit('error', e, request);
  }
  return this;
};

/**
 * Connects a {@link Peer} to a Twilio endpoint, including other {@link Peer}s.
 * @instance
 * @param {Peer} peer - The {@link Peer} connecting
 * @param {string} target - The Twilio endpoint to connect to
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is an
 *                              instance of {@link Session}
 * @returns Transport
 *//**
 * Connects a {@link Peer} to Twilio.
 * @instance
 * @param {Peer} peer - The {@link Peer} to connect
 * @param {?function} callback - A callback whose first parameter is an error, if any
 * @returns Transport
 */
Transport.prototype.connect = function(peer, target, callback) {
  // Transport#connect either connect a Peer to Twilio,
  if (!target && !callback || typeof target === 'function' && !callback) {
    return register.call(this, peer, callback);
  } else if (typeof target === 'string' && typeof callback === 'function') {
    return connect.call(this, peer, target, callback);
  }

  /*
  // Or it connects an already-connected Peer to another Twilio endpoint.
  var parts = target.split(':');
  var type = parts[0].toLowerCase();

  // Eventually we'll rely on a message back from the Transport to dispatch on the appropriate Session constructor, and
  // all Twilio endpoint identifiers will be uniform (e.g. no 'sip:' prefix).
  var session = null;
  switch (type) {
    case 'twiml':
      session = new TwiMLSession(parts[1]);
      break;
    case 'tel':
      session = new PSTNSession(parts[1]);
      break;
    case 'sip':
      session = new SIPSession(parts[1]);
      break;
    case 'client':
      session = new PeerSession(parts[1]);
      break;
    default:
      callback(new TypeError('Please specify a valid Twilio endpoint'));
  }
  */

  // We'll also get the session ID back from the Transport; in fact, most of this code might move to the Transport.
  var id = Math.round(Math.random() * 1000);
  sessions[peer][id] = session;
  sessionToId[session] = id;

  callback(null, session);
  return this;
};

function connect(peer, target, callback) {
  var domain = peer.dom;
  var name = peer.name;
  var request = JSON.stringify({
    domain: domain,
    type: 'connect',
    peer: name,
    target: {
      name: target
    }
  });
  // TODO(mroberts): We need to ensure we're registered.
  if (webSocket.readyState < 1) {
    queue.push(request);
    return this;
  }
  try {
    webSocket.send(request);
  } catch (e) {
    this.emit('error', e, request);
  }
  return this;
}

function register(peer, callback) {
}

function getPeers(domain) {
  return peers[domain] || null;
}

function getPeer(domain, name) {
  var peers = getPeers(domain);
  return peers && peers[name] || null;
}

function setPeer(peer) {
  peers[peer.dom] = peers[peer.dom] || {};
  peers[peer.dom][peer.name] = peer;
  return peer;
}

/**
 * Lookup a {@link Peer} connected to this {@link Transport}, if any.
 * @instance
 * @param {string} domain - A Simple Signaling domain
 * @param {?string} name - A {@link Peer}'s name, if any
 * @returns ?Peer
 */
Transport.prototype.lookupPeer = function lookupPeer(domain, name) {
  return peers[domain] && peers[domain][name] && peers[domain][name].peer || null;
};

module.exports = Transport;
