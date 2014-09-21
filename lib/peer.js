var events = require('events');
var util = require('util');

var Transport = require('./transport');
var webrtc = require('./webrtc');

/**
 * A {@link Peer} can make connections to Twilio endpoints, including other {@link Peer}s.
 * @class
 * @param {string} domain - Your Twilio account's Simple Signaling domain
 * @param {?string} name - An optional name so that others can address your {@link Peer}
 * @param {?function} callback - A callback to be called once registered
 * @property {string} dom - Your Twilio account's Simple Signaling domain
 * @property {?string} name - Your {@link Peer}'s name, if any
 */
function Peer(domain, name, callback) {
  // Return an existing Peer, if it exists.
  var transport = Transport.getInstance();
  var existing = transport.lookupPeer(domain, name);
  if (existing) {
    return existing;
  }

  // Otherwise construct it and connect to the Transport.
  var self = this instanceof Peer ? this : Object.create(Peer.prototype);
  events.EventEmitter.call(self);
  Object.defineProperties(self, {
    'dom': {
      value: domain
    },
    'name': {
      value: name
    }
  });
  if (callback && typeof callback === 'function') {
    self.once('registered', callback);
  }
  transport.register(self);

  return self;
}

util.inherits(Peer, events.EventEmitter);

/**
 * Authenticate a {@link Peer}.
 * @instance
 * @param {string} authToken - A JSON Web Token (JWT)
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is
 *                              the result of authentication
 * @returns Peer
 */
Peer.prototype.auth = function auth(authToken, callback) {
  // Mock successful authentication for 1 hour.
  var expires = new Date();
  expires.setHours(expires.getHours() + 1);
  var result = {
    expires: expires
  };
  callback(null, result);
  return this;
};

/**
 * Connects a {@link Peer} to a Twilio endpoint, including other {@link Peer}s.
 * @instance
 * @param {string} target - The Twilio endpoint to connect to
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is an
 *                              instance of {@link Session}
 * @returns Peer
 */
Peer.prototype.connect = function connect(target, callback) {
  var session = Transport.getInstance().connect(this, target, callback);
  if (!callback) {
    return Transport.getInstance().connect(this, target);
  }
  this.once('connected', function(session) {
    // TODO(mroberts): Filter by name.
    callback(null, session);
  });
  Transport.getInstance().connect(this, target, callback);
  return this;
};

/**
 * Calls a Twilio endpoint, including other {@link Peer}s. This will call <code>navigator.getUserMedia</code> to
 * request a <code>MediaStream</code>, and it is equivalent to calling {@link Peer#connect} and adding the <code>MediaStream</code> to the
 * {@link Session}.
 *
 * @example
 * var Twilio = require('twilio-simple-signaling');
 *
 * var peer = new Twilio.Peer('cheerful-owl-637.twil.io', 'alice');
 * 
 * // Before calling Bob, the browser will request access to the microphone and webcam.
 * peer.call('bob', function(error, session) {
 *   session.on('mediaStreamAdded', function(remoteStream) {
 *     // Bob added his MediaStream to the Session.
 *   });
 * });
 *
 * @instance
 * @param {string} target - The Twilio endpoint to connect to
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is an
 *                              instance of {@link Session}
 * @returns Peer
 *//**
 * Calls a Twilio endpoint, including other {@link Peer}s. This is equivalent to calling {@link Peer#connect} and
 * adding a <code>MediaStream</code> to the {@link Session}.
 *
 * @example
 * var Twilio = require('twilio-simple-signaling');
 *
 * var peer = new Twilio.Peer('cheerful-owl-637.twil.io', 'alice');
 *
 * navigator.getUserMedia({ video: true, audio: true }, function(localStream) {
 *   // Got a MediaStream. Let's call Bob.
 *   peer.call('bob', localStream, function(error, session) {
 *     session.on('mediaStreamAdded', function(remoteStream) {
 *       // Bob added his MediaStream to the Session.
 *     });
 *   });
 * });
 *
 * @instance
 * @param {string} target - The Twilio endpoint to connect to
 * @param {Object} mediaStream - The <code>MediaStream</code> to make the call with
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is an
 *                              instance of {@link Session}
 * @returns Peer
 *//**
 * Calls a Twilio endpoint, including other {@link Peer}s. This will call <code>navigator.getUserMedia</code> to
 * request a <code>MediaStream</code> with the given constraints, and it is equivalent to calling {@link Peer#connect} and
 * adding the <code>MediaStream</code> to the {@link Session}.
 *
 * @example
 * var Twilio = require('twilio-simple-signaling');
 *
 * var peer = new Twilio.Peer('cheerful-owl-637.twil.io', 'alice');
 * 
 * // Before calling Bob, the browser will request access to the microphone only.
 * peer.call('bob', { audio: true, video: false }, function(error, session) {
 *   session.on('mediaStreamAdded', function(remoteStream) {
 *     // Bob added his MediaStream to the Session.
 *   });
 * });
 *
 * @instance
 * @param {string} target - The Twilio endpoint to connect to
 * @param {Object} constraints - The constraints to pass to <code>navigator.getUserMedia</code>
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is an
 *                              instance of {@link Session}
 * @returns Peer
 */
Peer.prototype.call = function call() {
  var args = [].slice.call(arguments);
  var peer = this;
  var target = args[0];
  var mediaStream = null;
  var constraints = null;
  var callback = null;
  if (args.length === 2) {
    if (typeof args[0] === 'string' && typeof args[1] === 'function') {
      callback = args[1];
      constraints = {
        audio: true,
        video: true
      };
      return this.call(target, constraints, callback);
    }
  } else if (args.length === 3) {
    if (typeof args[0] === 'string' && typeof args[1] === 'object' &&
      typeof args[2] === 'function')
    {
      callback = args[2];
      if (args[1] instanceof webrtc.MediaStream) {
        mediaStream = args[1];
        return callWithMediaStream(peer, target, mediaStream, callback);
      } else {
        constraints = args[1];
        return callWithConstraints(peer, target, constraints, callback);
      }
    }
  }
  throw new TypeError('Ambiguous invocation of Peer.call()');
};

function callWithConstraints(peer, target, constraints, callback) {
  function onSuccess(mediaStream) {
    callWithMediaStream(peer, target, mediaStream, callback);
  }
  webrtc.getUserMedia(constraints, onSuccess, callback);
  return peer;
}

function callWithMediaStream(peer, target, mediaStream, callback) {
  function onConnect(error, session) {
    if (error) {
      return callback(error);
    }
    function onAddStream(error) {
      if (error) {
        return callback(error);
      }
      callback(null, session);
    }
    session.addStream(mediaStream, onAddStream);
  }
  return peer.connect(target, onConnect);
}

module.exports = Peer;
