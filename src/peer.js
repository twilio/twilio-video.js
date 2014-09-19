var events = require('events');
var util = require('util');

var Transport = require('./transport');

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
  expires.setHours(expires.getHoures() + 1);
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
 * Calls a Twilio endpoint, including other {@link Peer}s. This is equivalent to calling {@link Peer#connect} and
 * adding a MediaStream to the {@link Session}.
 *
 * @example
 * var peer = new Peer('cheerful-owl-637.twil.io', 'alice');
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
 * @param {Object} mediaStream - The MediaStream to make the call with
 * @param {function} callback - A callback whose first parameter is an error, if any, and whose second parameter is an
 *                              instance of {@link Session}
 * @returns Peer
 *//**
 * Calls a Twilio endpoint, including other {@link Peer}s. This will call <code>navigator.getUserMedia</code> to
 * request a MediaStream.
 *
 * @example
 * var peer = new Peer('cheerful-owl-637.twil.io', 'alice');
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
 * Call a Twilio endpoint, including other {@link Peer}s. This will call <code>navigator.getUserMedia</code> to
 * request a MediaStream with the given constraints.
 *
 * @example
 * var peer = new Peer('cheerful-owl-637.twil.io', 'alice');
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
Peer.prototype.call = function call(target, mediaStream, callback) {
  // We have to do these checks to support function overloading.
  var constraints = null;
  if (typeof mediaStream === 'function' && !callback) {
    callback = mediaStream;
    mediaStream = null;
  } else if (typeof mediaStream === 'object' && mediaStream != '[object MediaStream]') {
    constraints = mediaStream;
    mediaStream = null;
  }

  // next will yield to getUserMedia if necessary.
  var next = mediaStream ? function(constraints, successCallback, errorCallback) {
    successCallback(mediaStream);
  } : (navigator.getUserMedia || navigator.webkitGetUserMedia ||
       navigator.mozGetUserMedia || navigator.msGetUserMedia);

  function successCallback(mediaStream) {
    this.connect(target, function(error, stream) {
      session.addStream(mediaStream, function(error) {
        if (error) {
          return callback(error);
        }
        callback(null, session);
      });
    });
  }

  function errorCallback(error) {
    callback(error);
  }

  next(constraints, successCallback, errorCallback);

  return this;
};

module.exports = Peer;
