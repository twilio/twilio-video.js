/*! twilio-conversations.js 0.13.2

The following license applies to all parts of this software except as
documented below.

    Copyright (c) 2015, Twilio, inc.
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are
    met:

      1. Redistributions of source code must retain the above copyright
         notice, this list of conditions and the following disclaimer.

      2. Redistributions in binary form must reproduce the above copyright
         notice, this list of conditions and the following disclaimer in
         the documentation and/or other materials provided with the
         distribution.

      3. Neither the name of Twilio nor the names of its contributors may
         be used to endorse or promote products derived from this software
         without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This software includes SIP.js under the following license.

    Copyright (c) 2014 Junction Networks, Inc. <http://www.onsip.com>

    License: The MIT License

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

SIP.js contains substantial portions of the JsSIP software under the following
license.

    Copyright (c) 2012-2013 José Luis Millán - Versatica <http://www.versatica.com>

    License: The MIT License

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */
/* eslint strict:0 */
(function(root) {
  var Conversations = (function unpack(){var id=1, bundle=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

function Conversations(accessManager, options) {
  return new Conversations.Client(accessManager, options);
}

Object.defineProperties(Conversations, {
  Client: {
    enumerable: true,
    value: require('./client')
  },
  getUserMedia: {
    enumerable: true,
    value: require('./webrtc/getusermedia')
  },
  LocalMedia: {
    enumerable: true,
    value: require('./media/localmedia')
  }
});

module.exports = Conversations;

},{"./client":2,"./media/localmedia":6,"./webrtc/getusermedia":39}],2:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
var constants = require('./util/constants');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var IncomingInvite = require('./incominginvite');
var Log = require('./util/log');
var OutgoingInvite = require('./outgoinginvite');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var StatsReporter = require('./statsreporter');
var util = require('./util');

/**
 * Constructs a new {@link Client} with an AccessManager. Alternatively, you
 * can pass an Access Token string and the {@link Client} will construct an
 * AccessManager for you. AccessManager is provided by twilio-common.js, which
 * must be included alongside twilio-conversations.js.
 * @class
 * @classdesc Construct a {@link Client} to start creating and participating
 *   in {@link Conversation}s with other {@link Participant}s.
 * @param {AccessManager|string} managerOrToken - The {@link Client}'s AccessManager or an Access Token string to use when constructing an AccessManager
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @property {string} identity - The {@link Client}'s identity
 * @property {Map<Conversation.SID, Conversation>} conversations - The {@link Conversation}s this
 *   {@link Client} is participating in
 * @property {bool} isListening - Whether the {@link Client} is listening for
 *   {@link IncomingInvite}s to {@link Conversation}s
 * @fires Client#invite
 * @fires Client#error
 */
function Client(accessManager, options) {
  if (!(this instanceof Client)) {
    return new Client(accessManager, options);
  }

  if (typeof accessManager === 'string') {
    accessManager = new AccessManager(accessManager);
  }

  var self = this;
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    eventGateway: constants.EVENT_GATEWAY,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    useConversationEvents: true,
    userAgent: SIPJSUserAgent
  });

  var logLevel = options.logLevel;
  var log = new Log('Client', logLevel);

  var conversations = new Map();
  var eventGateway = options.eventGateway;
  var incomingInvites = new Map();
  var rejectedIncomingInvites = new Map();
  var isListening = false;
  var outgoingInvites = new Map();
  var canceledOutgoingInvites = new Map();

  var UserAgent = options.userAgent;
  var userAgent = new UserAgent(accessManager, options);

  userAgent.on('invite', function onInviteServerTransaction(inviteServerTransaction) {
    var cookie = inviteServerTransaction.cookie;
    var outgoingInvite = outgoingInvites.get(cookie) || canceledOutgoingInvites.get(cookie);
    if (outgoingInvite) {
      return outgoingInvite._onInviteServerTransaction(inviteServerTransaction);
    }

    var key = inviteServerTransaction.key;
    var incomingInvite = incomingInvites.get(key) || rejectedIncomingInvites.get(key);
    if (incomingInvite) {
      return incomingInvite._onInviteServerTransaction(inviteServerTransaction);
    }

    var conversation = conversations.get(inviteServerTransaction.conversationSid);
    if (conversation) {
      return conversation._onInviteServerTransaction(inviteServerTransaction);
    }

    self._onInviteServerTransaction(inviteServerTransaction);
  });

  userAgent.on('dialogCreated', function(dialog) {
    new StatsReporter(eventGateway, dialog, logLevel);
  });

  userAgent.on('keepAliveTimeout', function() {
    self.emit('error', E.GATEWAY_DISCONNECTED);
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _canceledOutgoingInvites: {
      value: canceledOutgoingInvites
    },
    _incomingInvites: {
      value: incomingInvites
    },
    _isListening: {
      set: function(_isListening) {
        isListening = _isListening;
      }
    },
    _isRegistered: {
      enumerable: true,
      get: function() {
        return this._userAgent.isRegistered;
      }
    },
    _log: {
      value: log
    },
    _logLevel: {
      value: logLevel
    },
    _needsRegistration: {
      get: function() {
        return isListening
          || outgoingInvites.size
          || incomingInvites.size
          || conversations.size;
      }
    },
    _options: {
      value: options
    },
    _outgoingInvites: {
      value: outgoingInvites
    },
    _rejectedIncomingInvites: {
      value: rejectedIncomingInvites
    },
    _userAgent: {
      value: userAgent
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    conversations: {
      enumerable: true,
      value: conversations
    },
    identity: {
      enumerable: true,
      get: function() {
        return accessManager.identity;
      }
    },
    isListening: {
      enumerable: true,
      get: function() {
        return isListening;
      }
    }
  });

  accessManager.on('tokenUpdated', this._register.bind(this, true));

  return this;
}

inherits(Client, EventEmitter);

Client.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  // If not listening, do nothing. Do not even reject, as that would cause
  // other listening Clients to be unable to accept the
  // InviteServerTransaction.
  if (!this.isListening) {
    return;
  }

  var incomingInvite = new IncomingInvite(inviteServerTransaction, this._options);
  var key = inviteServerTransaction.key;
  this._incomingInvites.set(key, incomingInvite);

  var self = this;

  // If accepted, the Client has joined the Conversation and will pass any
  // InviteServerTransactions with matching Conversation SID to the
  // Conversation in order to be accepted or rejected.
  incomingInvite.once('accepted', function incomingInviteAccepted() {
    self._incomingInvites.delete(key);

    var conversation = incomingInvite._conversation;
    self.conversations.set(conversation.sid, conversation);

    conversation.once('disconnected', function() {
      self.conversations.delete(conversation.sid);
      self._unregisterIfNotNeeded();
    });
  });

  incomingInvite.once('canceled', function incomingInviteCanceled() {
    self._incomingInvites.delete(key);
    self._unregisterIfNotNeeded();
  });

  // If rejected, the Client remembers the IncomingInvite until all the
  // InviteServerTransactions with matching Conversation SID and Participant
  // SID would have been received and passes them to the IncomingInvite in
  // order to be rejected.
  incomingInvite.once('rejected', function incomingInviteRejected() {
    self._incomingInvites.delete(key);
    self._rejectedIncomingInvites.set(key, incomingInvite);

    setTimeout(function deleteRejectedIncomingInvite() {
      self._rejectedIncomingInvites.delete(key);
    }, 3 * constants.DEFAULT_CALL_TIMEOUT);

    self._unregisterIfNotNeeded();
  });

  this.emit('invite', incomingInvite);
};

/**
 * Causes this {@link Client} to stop listening for {@link IncomingInvite}s to
 *   {@link Conversation}s until {@link Client#listen} is called again.
 * @returns {this}
 */
Client.prototype.unlisten = function unlisten() {
  this._isListening = false;
  this._unregisterIfNotNeeded();
  return this;
};

Client.prototype._unregister = function _unregister() {
  if (!this._isRegistered) {
    return Promise.resolve(this);
  }
  var self = this;
  return this._userAgent.unregister().then(function() {
    self._isListening = false;
    return self;
  });
};

/**
 * Causes this {@link Client} to start listening for {@link IncomingInvite}s to
 *   {@link Conversation}s.
 * @returns {Promise<this>}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var alice = new Twilio.Conversations.Client(manager);
 *
 * alice.listen().then(function() {
 *   console.log('Alice is listening');
 * }, function(error) {
 *   console.error(error);
 * });
 */
Client.prototype.listen = function listen() {
  var self = this;
  return this._register().then(function() {
    self._isListening = true;
    return self;
  });
};

Client.prototype._register = function _register(reregister) {
  var self = this;
  if (!reregister && this._isRegistered) {
    return Promise.resolve(this);
  }
  return this._userAgent.register().then(function onRegistered() {
    return self;
  }, function onRegisterFailed(response) {
    var gatewayMessage = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw');
    var sipMessage = response.cause;

    if (sipMessage) {
      self._log.throw(E.LISTEN_FAILED, 'Received SIP error: ' + sipMessage);
    } else if (gatewayMessage) {
      self._log.throw(E.LISTEN_FAILED, 'Gateway responded with: ' + gatewayMessage);
    } else {
      self._log.throw(E.LISTEN_FAILED, response.message || response);
    }
  });
};

/**
 * Invite remote {@link Client}s to join a {@link Conversation}.
 *   <br><br>
 *   By default, this will attempt to setup an {@link AudioTrack} and
 *   {@link VideoTrack} between local and remote {@link Client}s. You can
 *   override this by specifying <code>options</code>.
 * @param {Array<string>|string} participants - {@link Participant} identities to invite to the {@link Conversation}
 * @param {Client.InviteToConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Client#inviteToConversation}'s default behavior
 * @returns {OutgoingInvite}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.inviteToConversation(['bob', 'charlie']).then(function(conversation) {
 *   conversation.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 */
Client.prototype.inviteToConversation = function inviteToConversation(participants, options) {
  options = util.withDefaults({ }, options, this._options);

  if (!participants) {
    this._log.throw(E.INVALID_ARGUMENT, 'No Participant identities were provided');
  }

  participants = participants.forEach ? participants : [participants];
  util.validateAddresses(this.accessManager._tokenPayload.sub, participants);

  // Save a reference to the OutgoingInvite; the Client will pass any
  // InviteServerTransactions with matching cookie to the OutgoingInvite
  // in order to be accepted or rejected.
  var outgoingInvite = new OutgoingInvite(this._userAgent, participants, options);
  var cookie = outgoingInvite._cookie;
  this._outgoingInvites.set(cookie, outgoingInvite);

  var self = this;

  // If accepted, the Client has joined the Conversation and will pass any
  // InviteServerTransactions with matching Conversation SID to the
  // Conversation in order to be accepted or rejected.
  outgoingInvite.once('accepted', function() {
    self._outgoingInvites.delete(cookie);

    var conversation = outgoingInvite._conversation;
    self.conversations.set(conversation.sid, conversation);

    conversation.once('disconnected', function() {
      self.conversations.delete(conversation.sid);
      self._unregisterIfNotNeeded();
    });
  });

  // If canceled, the Client remembers the OutgoingInvite until all the
  // InviteServerTransactions with matching cookies would have been received
  // and passes them to the OutgoingInvite in order to be rejected.
  outgoingInvite.once('canceled', function outgoingInviteCanceled() {
    self._outgoingInvites.delete(cookie);
    self._canceledOutgoingInvites.set(cookie, outgoingInvite);

    setTimeout(function deleteCanceledOutgoingInvite() {
      self._canceledOutgoingInvites.delete(cookie);
    }, constants.DEFAULT_CALL_TIMEOUT * 3);

    self._unregisterIfNotNeeded();
  });

  outgoingInvite.once('rejected', function() {
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._unregisterIfNotNeeded();
  });

  return outgoingInvite;
};

Client.prototype._unregisterIfNotNeeded = function _unregisterIfNotNeeded() {
  return this._needsRegistration ? Promise.resolve(this) : this._unregister();
};

Object.freeze(Client.prototype);

/**
 * Your {@link Client} has run into an error.
 * @param {Error} error - The Error
 * @event Client#error
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('error', function(error) {
 *  console.error(error);
 * });
 */

/**
 * Your {@link Client} has received an {@link IncomingInvite} to participant in a
 * {@link Conversation}.
 * @param {IncomingInvite} invite - the {@link IncomingInvite}
 * @event Client#invite
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Received an IncomingInvite to join a Conversation from ' + invite.from);
 * });
 */

/**
 * You may pass these options to {@link Client}'s constructor to override
 * its default behavior.
 * @typedef {object} Client.ConstructorOptions
 * @property {string} [logLevel='warn'] - Set the verbosity of logging to console.
 *   Valid values: ['off', 'error', 'warn', 'info', 'debug']
 */

/**
 * You may pass these options to {@link Client#inviteToConversation} to
 * override the default behavior.
 * @typedef {object} Client.InviteToConversationOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Conversation}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = Client;

},{"./incominginvite":4,"./outgoinginvite":13,"./signaling/sipjsuseragent":26,"./statsreporter":28,"./util":31,"./util/constants":30,"./util/log":32,"events":44,"twilio-common":90,"util":48}],3:[function(require,module,exports){
'use strict';

var constants = require('./util/constants');
var ConversationInfo = require('./signaling/conversation-info');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('./media');
var Participant = require('./participant');
var util = require('./util');

var Log = require('./util/log');
var E = constants.twilioErrors;

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents communication between your
 *   {@link Client} and one or more {@link Participant}s sharing
 *   {@link AudioTrack}s and {@link VideoTrack}s.
 *   <br><br>
 *   You can join a {@link Conversation} by first creating an
 *   {@link OutgoingInvite} with {@link Client#inviteToConversation} or by
 *   accepting an {@link IncomingInvite} with {@link IncomingInvite#accept}.
 * @param {Object} [options] - Options to override the constructor's default
 *   behavior.
 * @property {LocalMedia} localMedia - Your {@link Client}'s {@link LocalMedia} in the {@link Conversation}
 * @property {Map<Participant.SID, Participant>} participants - The {@link Participant}s
 *   participating in this {@link Conversation}
 * @property {Conversation.SID} sid - The {@link Conversation}'s SID
 * @fires Conversation#disconnected
 * @fires Conversation#participantConnected
 * @fires Conversation#participantDisconnected
 * @fires Conversation#participantFailed
 * @fires Conversation#trackAdded
 * @fires Conversation#trackDimensionsChanged
 * @fires Conversation#trackDisabled
 * @fires Conversation#trackEnabled
 * @fires Conversation#trackEnded
 * @fires Conversation#trackRemoved
 * @fires Conversation#trackStarted
 */
function Conversation(options) {
  if (!(this instanceof Conversation)) {
    return new Conversation(options);
  }
  EventEmitter.call(this);

  options = util.withDefaults({ }, options, {
    logLevel: constants.DEFAULT_LOG_LEVEL
  });

  var localMedia = options.localMedia;
  var participantSid = null;
  var shouldStopLocalMediaOnDisconnect = options.shouldStopLocalMediaOnDisconnect;
  var sid;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _dialogs: {
      value: new Set()
    },
    _localMedia: {
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    _log: {
      value: new Log('Conversation', options.logLevel)
    },
    _options: {
      value: options
    },
    _participantSid: {
      get: function() {
        return participantSid;
      },
      set: function(_participantSid) {
        participantSid = _participantSid;
      }
    },
    _shouldStopLocalMediaOnDisconnect: {
      get: function() {
        return shouldStopLocalMediaOnDisconnect;
      },
      set: function(_shouldStopLocalMediaOnDisconnect) {
        shouldStopLocalMediaOnDisconnect = _shouldStopLocalMediaOnDisconnect;
      }
    },
    _sid: {
      set: function(_sid) {
        sid = _sid;
      }
    },
    _trackIdToParticipants: {
      value: new Map()
    },
    localMedia: {
      enumerable: true,
      get: function() {
        return localMedia;
      }
    },
    participants: {
      enumerable: true,
      value: new Map()
    },
    sid: {
      enumerable: true,
      get: function() {
        return sid;
      }
    }
  });

  return this;
}

var TRACK_ADDED = Conversation.TRACK_ADDED = Participant.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = Conversation.TRACK_DIMENSIONS_CHANGED = Participant.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = Conversation.TRACK_DISABLED = Participant.TRACK_DISABLED;
var TRACK_ENABLED = Conversation.TRACK_ENABLED = Participant.TRACK_ENABLED;
var TRACK_ENDED = Conversation.TRACK_ENDED = Participant.TRACK_ENDED;
var TRACK_REMOVED = Conversation.TRACK_REMOVED = Participant.TRACK_REMOVED;
var TRACK_STARTED = Conversation.TRACK_STARTED = Participant.TRACK_STARTED;

inherits(Conversation, EventEmitter);

/**
 * Add a {@link Dialog} to the {@link Conversation}.
 * @private
 * @param {Dialog} dialog - The {@link Dialog}
 * @returns {this}
 */
Conversation.prototype._onDialog = function _onDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }

  this._sid = this.sid || dialog.conversationSid;
  this._localMedia = this.localMedia || dialog.localMedia;
  this._participantSid = this._participantSid || dialog.participantSid;
  this._dialogs.add(dialog);

  dialog.once('ended', this._removeDialog.bind(this));

  dialog.on('notification', this._onNotification.bind(this, dialog));
  dialog.dequeue('notification');
  handleDialogTrackEvents(dialog, this._trackIdToParticipants);

  // NOTE(mroberts): Simulate Conversation Events if disabled. Once we are
  // confident in the Conversation Events implementation we will completely
  // remove this path.
  if (!this._options.useConversationEvents) {
    var participantSid = util.makeUUID();
    var notification = ConversationInfo
      .simulateParticipantConnectedEvent(dialog, participantSid);
    this._onNotification(dialog, notification);
    var participant = this.participants.get(participantSid);
    handleDialogTrackEventsMesh(dialog, participant);
  }

  return this;
};

Conversation.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  this._options.localMedia = this.localMedia;
  return inviteServerTransaction.accept(this._options).then(this._onDialog.bind(this));
};

/**
 * Handle {@link Dialog} {@link Track} events using a Map from {@link Track} IDs
 * to {@link Participant}s. This technique relies on Conversation Events to
 * construct the Map. It is topology-independent.
 * @private
 * @param {Dialog} dialog - The {@link Dialog}
 * @param {Map<string, Set>} trackIdToParticipants - The Map from
 *   {@link Track} IDs to {@link Participant}s
 */
function handleDialogTrackEvents(dialog, trackIdToParticipants) {
  // Add the Track to any Participant associated with the Track ID.
  function addTrack(track) {
    var participants = trackIdToParticipants.get(track.id) || new Set();
    participants.forEach(function(participant) {
      participant.media._addTrack(track);
    });
  }

  // Remove the Track from any Participant associated with the Track ID, and
  // remove the Track from the Map.
  function removeTrack(track) {
    var participants = trackIdToParticipants.get(track.id) || new Set();
    participants.forEach(function(participant) {
      participant.media._removeTrack(track);
    });
    trackIdToParticipants.delete(track.id);
  }

  var dialogMedia = dialog.remoteMedia;
  dialogMedia.tracks.forEach(addTrack);
  dialogMedia.on(Media.TRACK_ADDED, addTrack);
  dialogMedia.on(Media.TRACK_REMOVED, removeTrack);
  dialog.once('ended', function() {
    dialogMedia.removeListener(Media.TRACK_ADDED, addTrack);
    dialogMedia.removeListener(Media.TRACK_REMOVED, removeTrack);
  });
}

/**
 * Handle {@link Dialog} {@link Track} events using a one-to-one association
 * with a {@link Participant}. This technique only works in mesh topologies.
 * @private
 * @param {Dialog} dialog - The {@link Dialog}
 * @param {Participant} participant - The {@link Participant}
 */
function handleDialogTrackEventsMesh(dialog, participant) {
  var dialogMedia = dialog.remoteMedia;
  var participantMedia = participant.media;
  dialogMedia.tracks.forEach(participantMedia._addTrack, participantMedia);
  dialogMedia.on(Media.TRACK_ADDED, participantMedia._addTrack.bind(participantMedia));
  dialogMedia.on(Media.TRACK_REMOVED, participantMedia._removeTrack.bind(participantMedia));
}

/**
 * Connect a {@link Participant} to the {@link Conversation}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @returns {this}
 */
Conversation.prototype._connectParticipant = function _connectParticipant(participant) {
  if (this.participants.has(participant.sid)) {
    return this;
  }

  this.participants.set(participant.sid, participant);

  var self = this;
  participant.on(Participant.TRACK_ADDED, function trackAdded(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_ADDED, trackAdded);
    }
    self.emit(TRACK_ADDED, participant, track);
  });
  participant.on(Participant.TRACK_DIMENSIONS_CHANGED, function trackDimensionsChanged(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_DIMENSIONS_CHANGED, trackDimensionsChanged);
    }
    self.emit(TRACK_DIMENSIONS_CHANGED, participant, track);
  });
  participant.on(Participant.TRACK_DISABLED, function trackDisabled(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_DISABLED, trackDisabled);
    }
    self.emit(TRACK_DISABLED, participant, track);
  });
  participant.on(Participant.TRACK_ENABLED, function trackEnabled(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_ENABLED, trackEnabled);
    }
    self.emit(TRACK_ENABLED, participant, track);
  });
  participant.on(Participant.TRACK_ENDED, function trackEnded(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_ENDED, trackEnded);
    }
    self.emit(TRACK_ENDED, participant, track);
  });
  participant.on(Participant.TRACK_REMOVED, function trackRemoved(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_REMOVED, trackRemoved);
    }
    self.emit(TRACK_REMOVED, participant, track);
  });
  participant.on(Participant.TRACK_STARTED, function trackStarted(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_STARTED, trackStarted);
    }
    self.emit(TRACK_STARTED, participant, track);
  });

  // Emit these events on the next tick so the customer has
  // a chance to listen for them.
  setTimeout(function() {
    self.emit('participantConnected', participant);

    // Re-emit the "trackAdded" event for each of the Participant's Tracks.
    participant.media.tracks.forEach(participant.emit.bind(participant, Participant.TRACK_ADDED));
  });

  return this;
};

Conversation.prototype._removeDialog = function _removeDialog(dialog) {
  this._dialogs.delete(dialog);

  // NOTE(mroberts): Simulate Conversation Events if disabled. Once we are
  // confident in the Conversation Events implementation we will completely
  // remove this path.
  if (!this._options.useConversationEvents) {
    var notification = ConversationInfo
      .simulateParticipantDisconnectedEvents(this.participants, dialog);
    this._onNotification(dialog, notification);
  }

  if (!this._dialogs.size) {
    if (this._shouldStopLocalMediaOnDisconnect) {
      this.localMedia.stop();
    }

    this.emit('disconnected', this);

    // NOTE(mroberts): Regardless of topology, zero dialogs implies we are
    // disconnected from the Conversation; so disconnect any remaining
    // Participants (hopefully they have already been disconnected).
    this.participants.forEach(this._disconnectParticipant, this);
  }

  return this;
};

/**
 * Associate a {@link Track} ID to a {@link Participant}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {{id: string}} track - An object containing the {@link Track} ID
 * @returns {this}
 */
Conversation.prototype._associateParticipantToTrackId = function _associateParticipantToTrackId(participant, track) {
  util.map.addToMapOfSets(this._trackIdToParticipants, track.id, participant);
  return this;
};

/**
 * Associate {@link Track} IDs to a {@link Participant}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {Array<{id: string}>} tracks - Objects containing the {@link Track} IDs
 * @returns {this}
 */
Conversation.prototype._associateParticipantToTrackIds = function _associateParticipantToTrackIds(participant, tracks) {
  tracks.forEach(this._associateParticipantToTrackId.bind(this, participant));
  return this;
};

/**
 * Disassociate a {@link Participant} from a {@link Track} ID.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {{id: string}} track - An object containing the {@link Track} ID
 * @returns {this}
 */
Conversation.prototype._disassociateParticipantFromTrackId = function _disassociateParticipantFromTrackId(participant, _track) {
  var id = _track.id;
  util.map.deleteFromMapOfSets(this._trackIdToParticipants, id, participant);
  var track = participant.media.tracks.get(id);
  if (track) {
    participant.media._removeTrack(track);
  }
  return this;
};

/**
 * Associate {@link Track} IDs to a {@link Participant}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {Array<{id: string}>} tracks - Objects containing the {@link Track} IDs
 * @returns {this}
 */
Conversation.prototype._disassociateParticipantFromTrackIds = function _disassociateParticipantFromTrackIds(participant, tracks) {
  tracks.forEach(this._disassociateParticipantFromTrackId.bind(this, participant));
  return this;
};

/**
 * Disconnect a {@link Participant} from the {@link Conversation}.
 * @private
 * @param {Participant} - The {@link Participant}
 * @returns {this}
 */
Conversation.prototype._disconnectParticipant = function _disconnectParticipant(participant) {
  participant.media.tracks.forEach(function(track) {
    this._disassociateParticipantFromTrackId(participant, track.id);
    participant.media._removeTrack(track);
  }, this);
  this.participants.delete(participant.sid);
  this.emit('participantDisconnected', participant);
  return this;
};

/**
 * Update the {@link Conversation} upon receipt of a {@link Notification}.
 * @private
 * @param {Dialog} dialog - the {@link Dialog} that received the
 *   {@link PartialNotification}
 * @param {PartialNotification} notification
 * @returns {this}
 */
Conversation.prototype._onNotification = function _onNotification(dialog, notification) {
  var conversationState = notification.conversation_state;
  if (conversationState) {
    if (this.sid !== conversationState.sid) {
      return this;
    }
    return this._onFullNotification(dialog, notification);
  }
  return this._onPartialNotification(dialog, notification);
};

Conversation.prototype._onFullNotification = function _onFullNotification(dialog, notification) {
  notification.conversation_state.participants.forEach(this._onParticipantConnected, this);
  return this;
};

Conversation.prototype._onPartialNotification = function _onPartialNotification(dialog, notification) {
  notification.event_list.forEach(function(event) {
    var eventType = event.event.toLowerCase();
    switch (eventType) {
      case 'participant_connected':
        this._onParticipantConnected(event);
        return;
      case 'participant_disconnected':
        this._onParticipantDisconnected(event);
        return;
      case 'participant_failed':
        this._onParticipantFailed(event);
        return;
    }
    var participant = this.participants.get(event.participant_sid);
    if (participant) {
      switch (eventType) {
        case 'track_added':
          this._associateParticipantToTrackIds(participant, event.tracks);
          return;
        case 'track_removed':
          this._disassociateParticipantFromTrackIds(participant, event.tracks);
          return;
      }
      participant._onConversationEvent(event);
    }
  }, this);
  return this;
};

/**
 * Handle a "participant_connected" Conversation Event.
 * @private
 * @param {Notification} event
 * @returns {this}
 */
Conversation.prototype._onParticipantConnected = function _onParticipantConnected(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid);
  var connectParticipant = false;

  if (!participant) {
    participant = new Participant(event.participant_sid, util.getUser(event.address));
    connectParticipant = true;
  }

  this._associateParticipantToTrackIds(participant, event.tracks);

  if (connectParticipant) {
    this._connectParticipant(participant);
  }

  return this;
};

Conversation.prototype._onParticipantFailed = function _onParticipantFailed(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid) ||
    new Participant(event.participant_sid, util.getUser(event.address));

  this.emit('participantFailed', participant);

  return this;
};

/**
 * Handle a "participant_disconnected" Conversation Event.
 * @private
 * @param {Notification} event
 * @returns {this}
 */
Conversation.prototype._onParticipantDisconnected = function _onParticipantDisconnected(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid);

  if (participant) {
    this._disconnectParticipant(participant);
  }

  return this;
};

Conversation.prototype.getStats = function getStats() {
  var promises = [];
  this._dialogs.forEach(function(dialog) {
    promises.push(dialog.getStats());
  });

  return Promise.all(promises);
};

/**
 * Disconnect from the {@link Conversation}.
 * @returns {this}
 */
Conversation.prototype.disconnect = function disconnect() {
  this._dialogs.forEach(function(dialog) {
    dialog.end();
  });
  return this;
};

/**
 * Add a {@link Participant} to the {@link Conversation}.
 * @param {string} identity - The identity of the {@link Participant} to add
 * @returns {this}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 *  client.inviteToConversation('alice').then(function(conversation) {
 *    conversation.invite('bob');
 *
 *    conversation.on('participantConnected', function(participant) {
 *      if (participant.identity === 'bob') {
 *        console.log('Bob has connected');
 *      }
 *    });
 *  });
 * @throws {Error} INVALID_ARGUMENT
 *//**
 * Add {@link Participant}s to the {@link Conversation}.
 * @param {Array<string>} identities - The identities of the {@link Participant}s to add
 * @returns {this}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 *  client.inviteToConversation('alice').then(function(conversation) {
 *    conversation.invite(['bob', 'charlie']);
 *
 *    conversation.on('participantConnected', function() {
 *      if (participant.identity === 'bob') {
 *        console.log('Bob has connected');
 *      } else if (participant.identity === 'charlie') {
 *        console.log('Charlie has connected');
 *      }
 *    });
 *  });
 * @throws {Error} INVALID_ARGUMENT
 */
Conversation.prototype.invite = function invite(identity) {
  if (!identity) {
    this._log.throw(E.INVALID_ARGUMENT, 'No Participant identities were provided');
  }

  // there maybe several dialogs within the conversation
  // we just pick the first dialog to send the REFER to conversation service
  var dialog;
  this._dialogs.forEach(function(_dialog) {
    dialog = dialog || _dialog;
  });

  var identities = identity.forEach ? identity : [identity];

  var accessManager = dialog.userAgent.accessManager;
  util.validateAddresses(accessManager._tokenPayload.sub, identities);

  identities.forEach(dialog.refer, dialog);

  return this;
};

Object.freeze(Conversation.prototype);

/**
 * A {@link Conversation.SID} is a 34-character string starting with "CV"
 * that uniquely identifies a {@link Conversation}.
 * @type string
 * @typedef Conversation.SID
 */

/**
 * Your {@link Client} was disconnected from the {@link Conversation} and all
 * other {@link Participant}s.
 * @param {Conversation} conversation - The {@link Conversation} your
 *   {@link Client} was disconnected from
 * @event Conversation#disconnected
 * @example
 * myConversation.on('disconnected', function() {
 *   myConversation.localMedia.detach();
 * });
 */

/**
 * A {@link Participant} joined the {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} who joined
 * @event Conversation#participantConnected
 * @example
 * myConversation.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Conversation');
 *
 *   // Get the participant's Media,
 *   var participantMedia = participant.media;
 *
 *   // And attach it to your application's view.
 *   var participantView = document.getElementById('participant-view');
 *   participantMedia.attach(participantView);
 *   participantVideos.appendChild(participantView);
 * });
 */

/**
 * A {@link Participant} left the {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} who left
 * @event Conversation#participantDisconnected
 * @example
 * myConversation.on('participantDisconnected', function(participant) {
 *   console.log(participant.identity + ' left the Conversation');
 * });
 */

/**
 * A {@link Participant} failed to join {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} that failed to join
 * @event Conversation#participantFailed
 * @example
 * myConversation.on('participantFailed', function(participant) {
 *   console.log(participant.identity + ' failed to join the Conversation');
 * });
 */

/**
 * A {@link Track} was added by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was added
 * @param {Participant} participant - The {@link Participant} who added the
 *   {@link Track}
 * @event Conversation#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @param {Participant} participant - The {@link Participant} whose {@link VideoTrack}'s
 *   dimensions changed
 * @event Conversation#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was disabled
 * @param {Participant} participant - The {@link Participant} who disabled the
 *   {@link Track}
 * @event Conversation#trackDisabled
 */

/**
 * A {@link Track} was enabled by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was enabled
 * @param {Participant} participant - The {@link Participant} who enabled the
 *   {@link Track}
 * @event Conversation#trackEnabled
 */

/**
 * One of a {@link Participant}'s {@link Track}s in the {@link Conversation} ended.
 * @param {Track} track - The {@link Track} that ended
 * @param {Participant} participant - The {@link Participant} whose {@link Track} ended
 * @event Conversation#trackEnded
 */

/**
 * A {@link Track} was removed by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was removed
 * @param {Participant} participant - The {@link Participant} who removed the
 *   {@link Track}
 * @event Conversation#trackRemoved
 */

/**
 * One of a {@link Participant}'s {@link Track}s in the {@link Conversation} started.
 * @param {Track} track - The {@link Track} that started
 * @param {Participant} participant - The {@link Participant} whose {@link Track} started
 * @event Conversation#trackStarted
 */

module.exports = Conversation;

},{"./media":5,"./participant":14,"./signaling/conversation-info":16,"./util":31,"./util/constants":30,"./util/log":32,"events":44,"util":48}],4:[function(require,module,exports){
'use strict';

var C = require('./util/constants');
var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');

var LocalMedia = require('./media/localmedia');

/**
 * Construct an {@link IncomingInvite}.
 * @class
 * @classdesc An {@link IncomingInvite} to a {@link Conversation} can be accepted or
 * rejected.
 * <br><br>
 * {@link IncomingInvite}s are returned by {@link Client#event:invite}.
 * @param {InviteServerTransaction} inviteServerTransaction - The
 *   {@link InviteServerTransaction} that this {@link IncomingInvite} wraps
 * @param {Object} [options] - Options to override the constructor's
 *   default behavior.
 * @property {Conversation.SID} conversationSid - The SID of the {@link Conversation}
 *   this {@link IncomingInvite} invites to
 * @property {string} from - The identity of the {@link Participant} that sent this
 *   {@link IncomingInvite}
 * @property {Array<string>} participants - The identities of the {@link Participant}s currently in the {@link Conversation}
 * @property {string} status - The status of this {@link IncomingInvite}, either
 *   "accepting", "accepted", "rejected", "canceled", "failed", or "pending"
 * @fires IncomingInvite#accepted
 * @fires IncomingInvite#canceled
 * @fires IncomingInvite#failed
 * @fires IncomingInvite#rejected
 */
function IncomingInvite(inviteServerTransaction, options) {
  if (!(this instanceof IncomingInvite)) {
    return new IncomingInvite(inviteServerTransaction, options);
  }

  options = util.withDefaults({ }, options, {
    logLevel: C.DEFAULT_LOG_LEVEL
  });

  var self = this;
  EventEmitter.call(this);

  var conversation = null;
  var from = util.getUser(inviteServerTransaction.from);
  var localMedia = null;
  var participants = [from];
  var participantSid = inviteServerTransaction.participantSid;
  var pending = 0;
  var shouldStopLocalMediaOnFailure = false;
  var status = 'pending';

  var deferred = util.defer();
  var inviteServerTransactions = new Set();
  inviteServerTransactions.add(inviteServerTransaction);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _conversation: {
      set: function(_conversation) {
        conversation = _conversation;
      },
      get: function() {
        return conversation;
      }
    },
    _deferred: {
      value: deferred
    },
    _inviteServerTransaction: {
      value: inviteServerTransaction
    },
    _inviteServerTransactions: {
      value: inviteServerTransactions
    },
    _localMedia: {
      get: function() {
        return localMedia;
      },
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    _logLevel: {
      value: options.logLevel
    },
    _options: {
      get: function() {
        return options;
      },
      set: function(_options) {
        options = _options;
      }
    },
    _pending: {
      get: function() {
        return pending;
      },
      set: function(_pending) {
        pending = _pending;
      }
    },
    _promise: {
      value: deferred.promise
    },
    _shouldStopLocalMediaOnFailure: {
      get: function() {
        return shouldStopLocalMediaOnFailure;
      },
      set: function(_shouldStopLocalMediaOnFailure) {
        shouldStopLocalMediaOnFailure = _shouldStopLocalMediaOnFailure;
      }
    },
    _status: {
      get: function() {
        return status;
      },
      set: function(_status) {
        status = _status;
      }
    },
    conversationSid: {
      enumerable: true,
      value: inviteServerTransaction.conversationSid
    },
    from: {
      enumerable: true,
      value: from
    },
    participants: {
      enumerable: true,
      value: participants
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    status: {
      enumerable: true,
      get: function() {
        return status;
      }
    }
  });

  inviteServerTransaction.once('canceled', function() {
    self.emit('canceled', self);
  });

  return this;
}

inherits(IncomingInvite, EventEmitter);

IncomingInvite.prototype._onAcceptFailure = function _onAcceptFailure(reason) {
  this._pending--;

  if (this.status === 'accepting' && !this._pending) {
    this._status = 'failed';
    if (this._shouldStopLocalMediaOnFailure && this._localMedia) {
      this._localMedia.stop();
    }
    this._deferred.reject(reason);
    this.emit('failed', this);
  }

  return this;
};

IncomingInvite.prototype._onDialog = function _onDialog(dialog) {
  this._pending--;

  var conversation
    = this._conversation
    = this._conversation || new Conversation(this._options);

  conversation._onDialog(dialog);

  if (this.status === 'accepting') {
    this._status = 'accepted';
    this._deferred.resolve(conversation);
    this.emit('accepted', this);
  }

  return conversation;
};

IncomingInvite.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  switch (this.status) {
    case 'canceled':
    case 'rejected':
      inviteServerTransaction.reject();
      return;
    case 'accepting':
      if (!this._inviteServerTransactions.has(inviteServerTransaction)) {
        this.participants.push(util.getUser(inviteServerTransaction.from));
        this._inviteServerTransactions.add(inviteServerTransaction);
      }
      this._pending++;
      inviteServerTransaction.accept(this._options)
        .then(this._onDialog.bind(this), this._onAcceptFailure.bind(this));
      return;
    case 'accepted':
      this._conversation._onInviteServerTransaction(inviteServerTransaction);
      return;
    default:
      if (!this._inviteServerTransactions.has(inviteServerTransaction)) {
        this.participants.push(util.getUser(inviteServerTransaction.from));
        this._inviteServerTransactions.add(inviteServerTransaction);
      }
  }
};

/**
 * Accept the {@link IncomingInvite} and join the {@link Conversation}.
 * @param {IncomingInvite.AcceptOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link IncomingInvite#accept}'s default behavior
 * @fires IncomingInvite#accepted
 * @fires IncomingInvite#failed
 * @returns {Promise<Conversation>}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Received IncomingInvite to join a Conversation with ' + invite.from);
 *
 *   // By default, accept will request the microphone and camera for you.
 *   invite.accept();
 * });
 */
IncomingInvite.prototype.accept = function accept(options) {
  if (this.status === 'accepted') {
    return this._promise;
  }

  options = this._options = util.withDefaults({ }, options, this._options);
  this._status = 'accepting';

  var self = this;

  function getLocalMedia() {
    if (!options.localMedia && !options.localStream) {
      self._shouldStopLocalMediaOnFailure = true;
      self._options.shouldStopLocalMediaOnDisconnect = true;
    }
    return LocalMedia.getLocalMedia(options);
  }

  return getLocalMedia().then(function(localMedia) {
    self._localMedia = localMedia;
    options.localMedia = localMedia;
    self._inviteServerTransactions.forEach(self._onInviteServerTransaction, self);
    return self._promise;
  });
};

/**
 * Reject the {@link IncomingInvite} to a {@link Conversation}.
 * @fires IncomingInvite#rejected
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Rejecting IncomingInvite to join a Conversation with ' + invite.from);
 *   invite.reject();
 * });
 *
 * @returns {this}
 */
IncomingInvite.prototype.reject = function reject() {
  this._inviteServerTransaction.reject();
  this.emit('rejected');
  return this;
};

Object.freeze(IncomingInvite.prototype);

/**
 * The {@link IncomingInvite} was accepted, and the {@link Client} is now
 * participating in the {@link Conversation}.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#accepted
 */

/**
 * The {@link IncomingInvite} was rejected.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#rejected
 */

/**
 * The {@link IncomingInvite} was canceled.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#canceled
 */

/**
 * The {@link IncomingInvite} failed.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#failed
 */

/**
 * You may pass these options to {@link IncomingInvite#accept} to
 * override the default behavior.
 * @typedef {object} IncomingInvite.AcceptOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when accepting an {@link IncomingInvite}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   MediaStream when accepting an {@link IncomingInvite}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = IncomingInvite;

},{"./conversation":3,"./media/localmedia":6,"./util":31,"./util/constants":30,"events":44,"util":48}],5:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var Track = require('./track');
var AudioTrack = require('./track/audiotrack');
var VideoTrack = require('./track/videotrack');

/**
 * Construct a {@link Media} object.
 * @class
 * @classdesc A {@link Media} object contains a number of {@link AudioTrack}s
 *   and {@link VideoTrack}s. You can call {@link Media#attach} with a
 *   &lt;div&gt; to automatically update your application's user interface with
 *   &lt;audio&gt; and &lt;video&gt; elements as {@link Track}s are added and
 *   removed.
 * @property {Map<HTMLElement, Map<Track, HTMLElement>>} attachments - A Map
 *   from &lt;div&gt; elements to a Map from {@link Track}s to their attached
 *   HTMLElements (managed by {@link Media#attach} and {@link Media#detach})
 * @property {Map<Track.ID, AudioTrack>} audioTracks - The {@link AudioTrack}s on
 *   this {@link Media} object
 * @property {boolean} isMuted - True if every {@link AudioTrack} on this
 *   {@link Media} object is disabled
 * @property {boolean} isPaused - True if every {@link VideoTrack} on this
 *   {@link Media} object is disabled
 * @property {Set<MediaStream>} mediaStreams - The MediaStreams associated with
 *   the {@link Track}s on this {@link Media} object
 * @property {Map<Track.ID, Track>} tracks - The {@link AudioTrack}s and
 *   {@link VideoTrack}s on this {@link Media} object
 * @property {Map<Track.ID, VideoTrack>} videoTracks - The {@link VideoTrack}s on
 *   this {@link Media} object
 * @fires Media#trackAdded
 * @fires Media#trackDimensionsChanged
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 * @fires Media#trackEnded
 * @fires Media#trackRemoved
 * @fires Media#trackStarted
 */
function Media() {
  EventEmitter.call(this);

  var attachments = new Map();
  var audioTracks = new Map();
  var mediaStreams = new Set();
  var tracks = new Map();
  var videoTracks = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    attachments: {
      enumerable: true,
      value: attachments
    },
    audioTracks: {
      enumerable: true,
      value: audioTracks
    },
    isMuted: {
      enumerable: true,
      get: function() {
        var isMuted = true;
        audioTracks.forEach(function(track) {
          isMuted = isMuted && !track.isEnabled;
        });
        return isMuted;
      }
    },
    isPaused: {
      enumerable: true,
      get: function() {
        var isPaused = true;
        videoTracks.forEach(function(track) {
          isPaused = isPaused && !track.isEnabled;
        });
        return isPaused;
      }
    },
    mediaStreams: {
      enumerable: true,
      value: mediaStreams
    },
    tracks: {
      enumerable: true,
      value: tracks
    },
    videoTracks: {
      enumerable: true,
      value: videoTracks
    }
  });
  return this;
}

var TRACK_ADDED = Media.TRACK_ADDED = 'trackAdded';
var TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED = 'trackDimensionsChanged';
var TRACK_DISABLED = Media.TRACK_DISABLED = 'trackDisabled';
var TRACK_ENABLED = Media.TRACK_ENABLED = 'trackEnabled';
var TRACK_ENDED = Media.TRACK_ENDED = 'trackEnded';
var TRACK_REMOVED = Media.TRACK_REMOVED = 'trackRemoved';
var TRACK_STARTED = Media.TRACK_STARTED = 'trackStarted';

inherits(Media, EventEmitter);

Media.prototype._addRemoteStream = function _addRemoteStream(mediaStream) {
  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new AudioTrack(mediaStream, mediaStreamTrack);
    this._addTrack(audioTrack);
  }, this);
  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new VideoTrack(mediaStream, mediaStreamTrack);
    this._addTrack(videoTrack);
  }, this);
  return this;
};

Media.prototype._updateMediaStreams = function _updateMediaStreams() {
  this.mediaStreams.clear();
  this.tracks.forEach(function(track) {
    this.mediaStreams.add(track.mediaStream);
  }, this);
  return this.mediaStreams;
};

Media.prototype._addTrack = function _addTrack(track) {
  if (this.tracks.has(track.id)) {
    return this;
  }

  var self = this;
  this.mediaStreams.add(track.mediaStream);

  this.tracks.set(track.id, track);
  this._reemitTrackEvent(track, VideoTrack.DIMENSIONS_CHANGED, TRACK_DIMENSIONS_CHANGED);
  this._reemitTrackEvent(track, Track.DISABLED, TRACK_DISABLED);
  this._reemitTrackEvent(track, Track.ENABLED, TRACK_ENABLED);
  this._reemitTrackEvent(track, Track.ENDED, TRACK_ENDED);
  this._reemitTrackEvent(track, Track.STARTED, TRACK_STARTED);
  if (track.kind === 'audio') {
    this._addAudioTrack(track);
  } else {
    this._addVideoTrack(track);
  }
  this._updateMediaStreams();

  track.once(Track.ENDED, function ended() {
    self._removeTrack(track);
  });

  this.emit(TRACK_ADDED, track);

  return this;
};

Media.prototype._addAudioTrack = function _addAudioTrack(track) {
  this.audioTracks.set(track.id, track);
  return this;
};

Media.prototype._addVideoTrack = function _addVideoTrack(track) {
  this.videoTracks.set(track.id, track);
  return this;
};

Media.prototype._reemitTrackEvent = function _reemitTrackEvent(track, trackEvent, event) {
  var self = this;
  var trackSet = track.kind === 'audio' ? this.audioTracks : this.videoTracks;
  track.on(trackEvent, function onTrackEvent() {
    // FIXME(mroberts): Lazily remove the event handler, but what happens
    // if we add the Track twice? We only want to emit the event once.
    if (!trackSet.has(track.id)) {
      return track.removeListener(trackEvent, onTrackEvent);
    }
    self.emit(event, track);
  });
  return this;
};

/**
 * Add any new {@link Track}s that did not trigger the onaddtrack event. WebRTC
 * does not always call this callback, so we have to check ourselves.
 * @private
 * @returns {Media}
 */
Media.prototype._refreshTracks = function _refreshTracks() {
  this.mediaStreams.forEach(this._addRemoteStream, this);
  return this;
};

Media.prototype._attachTrack = function _attachTrack(el, attachments, track) {
  var self = this;
  var trackEl = track.attach();
  // NOTE(mroberts): We want to mute local audio, otherwise we get feedback.
  if (this.constructor !== Media && track instanceof AudioTrack) {
    trackEl.muted = true;
  }
  el.appendChild(trackEl);
  attachments.set(track, trackEl);
  track.once('ended', function() {
    self._detachTrack(el, attachments, track);
  });
  return this;
};

Media.prototype._detachTrack = function _detachTrack(el, attachments, track) {
  var trackEl = attachments.get(track);
  if (!trackEl) {
    return this;
  }
  track.detach(trackEl);
  if (trackEl.parentNode) {
    trackEl.parentNode.removeChild(trackEl);
  }
  attachments.delete(track);
  return this;
};

Media.prototype._removeTrack = function _removeTrack(track) {
  if (!this.tracks.has(track.id)) {
    return this;
  }
  this.tracks.delete(track.id);
  (track.kind === 'audio' ? this.audioTracks : this.videoTracks).delete(track.id);
  this._updateMediaStreams();
  this.emit(TRACK_REMOVED, track);
  return this;
};

/**
 * Attach the {@link Media} to a newly created &lt;div&gt; element.
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = media.attach();
 * document.getElementById('div#remote-media-container').appendChild(remoteMediaEl);
*//**
 * Attach the {@link Media} to an existing HTMLElement.
 * @param {HTMLElement} el - The HTMLElement to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = document.getElementById('remote-media');
 * media.attach(remoteMediaEl);
*//**
 * Attach the {@link Media} to an HTMLElement selected by
 * <code>document.querySelector</code>.
 * @param {string} selector - A query selector for the HTMLElement to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = media.attach('div#remote-media');
 */
Media.prototype.attach = function attach(el) {
  if (!el) {
    return createDivAndAttach(this);
  } else if (typeof el === 'string') {
    return selectElementAndAttach(this, el);
  }
  return attachToElement(this, el);
};

function attachToElement(media, el) {
  if (media.attachments.has(el)) {
    return el;
  }
  var attachments = new Map();
  // Attach existing audio and video tracks to the element,
  media.tracks.forEach(function(track) {
    media._attachTrack(el, attachments, track);
  }, media);
  // And update the element as tracks are added,
  media.on(TRACK_ADDED, function trackAdded(track) {
    // But stop updating the element if we've been detached.
    if (!media.attachments.has(el)) {
      return media.removeListener(TRACK_ADDED, trackAdded);
    }
    media._attachTrack(el, attachments, track);
  });
  media.on(TRACK_REMOVED, function trackRemoved(track) {
    if (!media.attachments.has(el)) {
      return media.removeListener(TRACK_REMOVED, trackRemoved);
    }
    media._detachTrack(el, attachments, track);
  });
  media.attachments.set(el, attachments);
  return el;
}

function selectElementAndAttach(media, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return media.attach(el);
}

function createDivAndAttach(media) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  return media.attach(document.createElement('div'));
}

/**
 * Detach the {@link Media} from any and all previously attached HTMLElements.
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedMediaEls = media.detach();
*//**
 * Detach the {@link Media} from a previously attached HTMLElement.
 * @param {HTMLElement} el - The HTMLElement to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteMediaEl = document.getElementById('remote-media');
 * media.detach(remoteMediaEl);
*//**
 * Detach the {@link Media} from a previously attached HTMLElement selected by
 * <code>document.querySelector</code>.
 * @param {string} selector - A query selector for the HTMLElement to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedMediaEl = media.detach('div#remote-media');
 */
Media.prototype.detach = function detach(el) {
  if (!el) {
    return detachFromAllElements(this);
  } else if (typeof el === 'string') {
    return selectElementAndDetach(this, el);
  }
  return detachFromElement(this, el);
};

function detachFromElement(media, el) {
  if (!media.attachments.has(el)) {
    return el;
  }
  var attachments = media.attachments.get(el);
  media.attachments.delete(el);
  attachments.forEach(function(trackEl, track) {
    media._detachTrack(el, attachments, track);
  });
  return el;
}

function selectElementAndDetach(media, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return detachFromElement(media, el);
}

function detachFromAllElements(media) {
  var els = [];
  media.attachments.forEach(function(attachments, el) {
    els.push(el);
    detachFromElement(media, el);
  });
  return els;
}

/**
 * A {@link Track} was added to this {@link Media} object.
 * @param {Track} track - The {@link Track} that was added
 * @event Media#trackAdded
 */

/**
 * The dimensions of a {@link VideoTrack} on this {@link Media} object changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Media#trackDimensionsChanged
 */

/**
 * A {@link Track} on this {@link Media} object was disabled.
 * @param {Track} track - The {@link Track} that was disabled
 * @event Media#trackDisabled
 */

/**
 * A {@link Track} on this {@link Media} object was enabled.
 * @param {Track} track - The {@link Track} that was enabled
 * @event Media#trackEnabled
 */

/**
 * A {@link Track} on this {@link Media} object ended.
 * @param {Track} track - The {@link Track} that ended
 * @event Media#trackEnded
 */

/**
 * A {@link Track} was removed from this {@link Media} object.
 * @param {Track} track - The {@link Track} that was removed
 * @event Media#trackRemoved
 */

/**
 * A {@link Track} on this {@link Media} object was started.
 * @param {Track} track - The {@link Track} that was started
 * @event Media#trackStarted
 */

module.exports = Media;

},{"./track":8,"./track/audiotrack":7,"./track/videotrack":12,"events":44,"util":48}],6:[function(require,module,exports){
'use strict';

var getUserMedia = require('../webrtc/getusermedia');
var inherits = require('util').inherits;
var LocalAudioTrack = require('./track/localaudiotrack');
var LocalVideoTrack = require('./track/localvideotrack');
var Media = require('./');

/**
 * Construct a {@link LocalMedia} object.
 * @class
 * @classdesc A {@link LocalMedia} object is a {@link Media} object representing
 *   {@link LocalAudioTrack}s and {@link LocalVideoTrack}s that your {@link Client} may
 *   share in a {@link Conversation}.
 * @extends Media
 * @property {Map<Track.ID, LocalAudioTrack>} audioTracks - The {@link LocalAudioTrack}s on
 *   this {@link Media} object
 * @property {Map<Track.ID, LocalTrack>} tracks - The {@link LocalAudioTrack}s and
 *   {@link LocalVideoTrack}s on this {@link Media} object
 * @property {Map<Track.ID, LocalVideoTrack>} videoTracks - The {@link LocalVideoTrack}s on
 *   this {@link Media} object
 */
function LocalMedia() {
  if (!(this instanceof LocalMedia)) {
    return new LocalMedia();
  }
  Media.call(this);
  return this;
}

/**
 * Get {@link LocalMedia}. By default, this requests a
 * {@link LocalAudioTrack} and a {@link LocalVideoTrack} representing a microphone and
 * camera.
 * <br><br>
 * This method calls <code>getUserMedia</code> internally. Pass in
 * <code>options</code> to override the default behavior.
 * @param {?LocalMedia.GetLocalMediaOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link LocalMedia.getLocalMedia}'s default behavior
 * @returns {Promise<LocalMedia>}
 */
LocalMedia.getLocalMedia = function getLocalMedia(options) {
  options = options || {};
  if (options.localMedia) {
    return Promise.resolve(options.localMedia);
  }
  var localMedia = new LocalMedia();
  if (options.localStream) {
    return Promise.resolve(localMedia.addStream(options.localStream));
  }
  return getUserMedia(options.localStreamConstraints)
    .then(function(mediaStream) {
      return localMedia.addStream(mediaStream);
    });
};

inherits(LocalMedia, Media);

/**
 * Adds a {@link LocalTrack} to the {@link LocalMedia} object, if not already added.
 * @method
 * @param {LocalTrack} track - The {@link LocalTrack} to add
 * @returns {this}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addTrack = Media.prototype._addTrack;

/**
 * Removes a {@link LocalTrack} from the {@link LocalMedia} object, if it was added.
 * @method
 * @param {LocalTrack} track - The {@link LocalTrack} to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop}
 * @returns {this}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeTrack = Media.prototype._removeTrack;

/**
 * Adds a {@link LocalAudioTrack} representing your browser's microphone to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ audio: true })</code>.
 * @returns {Promise<LocalAudioTrack>}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addMicrophone = function addMicrophone() {
  var self = this;
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || audioTrack;
  });
  if (microphone) {
    return Promise.resolve(microphone);
  }
  return getUserMedia({ audio: true, video: false })
    .then(function gotMicrophone(mediaStream) {
      var audioTracks = mediaStream.getAudioTracks();
      var mediaStreamTrack = audioTracks[0];
      var audioTrack = new LocalAudioTrack(mediaStream, mediaStreamTrack);
      self._addTrack(audioTrack);
      return audioTrack;
    });
};

/**
 * Removes the {@link LocalAudioTrack} representing your browser's microphone, if it
 * has been added.
 * @returns {?LocalAudioTrack}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeMicrophone = function removeMicrophone() {
  var microphone = null;
  this.audioTracks.forEach(function(audioTrack) {
    microphone = microphone || audioTrack;
  });
  if (microphone) {
    return this._removeTrack(microphone);
  }
  return null;
};

/**
 * Adds a {@link LocalVideoTrack} representing your browser's camera to the
 * {@link LocalMedia} object, if not already added.
 * <br><br>
 * Internally, this calls <code>getUserMedia({ video: true })</code>.
 * @returns {Promise<LocalVideoTrack>}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addCamera = function addCamera() {
  var self = this;
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || videoTrack;
  });
  if (camera) {
    return Promise.resolve(camera);
  }
  return getUserMedia({ audio: false, video: true })
    .then(function gotCamera(mediaStream) {
      var videoTracks = mediaStream.getVideoTracks();
      var mediaStreamTrack = videoTracks[0];
      var videoTrack = new LocalVideoTrack(mediaStream, mediaStreamTrack);
      self._addTrack(videoTrack);
      return videoTrack;
    });
};

/**
 * Removes the {@link LocalVideoTrack} representing your browser's camera, if it
 * has been added.
 * @returns {?LocalVideoTrack}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeCamera = function removeCamera() {
  var camera = null;
  this.videoTracks.forEach(function(videoTrack) {
    camera = camera || videoTrack;
  });
  if (camera) {
    return this._removeTrack(camera);
  }
  return null;
};

/**
 * Add a <code>MediaStream</code> to the {@link LocalMedia} object, constructing
 * {@link LocalTrack}s as necessary for each <code>MediaStreamTrack</code> contained
 * within.
 * @param {MediaStream} mediaStream - The <code>MediaStream</code> to add
 * @returns {this}
 * @fires Media#trackAdded
 */
LocalMedia.prototype.addStream = function addStream(mediaStream) {
  mediaStream.getAudioTracks().forEach(function(mediaStreamTrack) {
    var audioTrack = new LocalAudioTrack(mediaStream, mediaStreamTrack);
    this._addTrack(audioTrack);
  }, this);
  mediaStream.getVideoTracks().forEach(function(mediaStreamTrack) {
    var videoTrack = new LocalVideoTrack(mediaStream, mediaStreamTrack);
    this._addTrack(videoTrack);
  }, this);
  return this;
};

/**
 * Remove a <code>MediaStream</code> from the {@link LocalMedia} object. This
 * will remove any {@link LocalTrack}s corresponding to
 * <code>MediaStreamTrack</code>s contained within the <code>MediaStream</code>.
 * @param {MediaStream} mediaStream - The <code>MediaStream</code> to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalTrack#stop} on the corresponding {@link LocalTrack}s
 * @returns {this}
 * @fires Media#trackRemoved
 */
LocalMedia.prototype.removeStream = function removeStream(mediaStream, stop) {
  mediaStream.getTracks().forEach(function(mediaStreamTrack) {
    var track = this.tracks.get(mediaStreamTrack.id);
    if (track) {
      this.removeTrack(track, stop);
    }
  }, this);
  return this;
};

LocalMedia.prototype._removeTrack = function _removeTrack(track, stop) {
  if (typeof stop === 'boolean' ? stop : true) {
    track.stop();
  }
  try {
    track.mediaStream.removeTrack(track.mediaStreamTrack);
  } catch (error) {
    // Firefox doesn't support removeStream/removeTrack, so we can't yet truly
    // remove and renegotiate media.
  }
  Media.prototype._removeTrack.call(this, track);
  return track;
};

/**
 * Disable every {@link LocalAudioTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackDisabled
*//**
 * Disable or enable every {@link LocalAudioTrack} on this {@link LocalMedia} object.
 * @param {?boolean} enabled - Specify false to enable the {@link LocalAudioTrack}s
 * @returns {this}
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.mute = function mute(muted) {
  muted = typeof muted === 'boolean' ? muted : true;
  this.audioTracks.forEach(function(track) {
    track.enable(!muted);
  });
  return this;
};

/**
 * Disable every {@link LocalVideoTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackDisabled
*//**
 * Disable or enable every {@link LocalVideoTrack} on this {@link LocalMedia} object.
 * @param {?boolean} enabled - Specify false to enable the {@link LocalVideoTrack}s
 * @returns {this}
 * @fires Media#trackDisabled
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.pause = function pause(paused) {
  paused = typeof paused === 'boolean' ? paused : true;
  this.videoTracks.forEach(function(track) {
    track.enable(!paused);
  });
  return this;
};

/**
 * Stop all {@link LocalAudioTrack}s and {@link LocalVideoTrack}s on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackEnded
 */
LocalMedia.prototype.stop = function stop() {
  this.tracks.forEach(function(track) {
    track.stop();
  });
  return this;
};

/**
 * Enable every {@link LocalAudioTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.unmute = function unmute() {
  return this.mute(false);
};

/**
 * Enable every {@link LocalVideoTrack} on this {@link LocalMedia} object.
 * @returns {this}
 * @fires Media#trackEnabled
 */
LocalMedia.prototype.unpause = function unpause() {
  return this.pause(false);
};

/**
 * You may pass these options to {@link LocalMedia.getLocalMedia} to
 * override the default behavior.
 * @typedef {object} LocalMedia.GetLocalMediaOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code>
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = LocalMedia;

},{"../webrtc/getusermedia":39,"./":5,"./track/localaudiotrack":9,"./track/localvideotrack":11,"util":48}],7:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct an {@link AudioTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link Track} representing audio.
 * @extends Track
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {Set<HTMLElement>} attachments - The &lt;audio&gt; elements this
 *   {@link AudioTrack} is currently attached to (managed by
 *   {@link AudioTrack#attach})
 */
function AudioTrack(mediaStream, mediaStreamTrack) {
  Track.call(this, mediaStream, mediaStreamTrack);
}

inherits(AudioTrack, Track);

/**
 * Attach the {@link AudioTrack} to a newly created &lt;audio&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach();
 * document.getElementById('div#remote-audio-container').appendChild(remoteAudioEl);
*//**
 * Attach the {@link AudioTrack} to an existing &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.attach(remoteAudioEl);
*//**
 * Attach the {@link AudioTrack} to a &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = audioTrack.attach('audio#remote-audio');
 */
AudioTrack.prototype.attach = Track.prototype.attach;

/**
 * Detach the {@link AudioTrack} from any and all previously attached &lt;audio&gt; elements.
 * @method
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedAudioEls = audioTrack.detach();
*//**
 * Detach the {@link AudioTrack} from a previously attached &lt;audio&gt; element.
 * @method
 * @param {HTMLElement} audio - The &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteAudioEl = document.getElementById('remote-audio');
 * audioTrack.detach(remoteAudioEl);
*//**
 * Detach the {@link AudioTrack} from a previously attached &lt;audio&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;audio&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedAudioEl = media.detach('div#remote-audio');
 */
AudioTrack.prototype.detach = Track.prototype.detach;

module.exports = AudioTrack;

},{"./":8,"util":48}],8:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link Track} from a MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link Track} represents audio or video that can be sent to or
 * received from a {@link Conversation}. {@link Track}s abstract away the notion
 * of MediaStream and MediaStreamTrack.
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {Track.ID} id - This {@link Track}'s ID
 * @property {boolean} isEnded - Whether or not the {@link Track} has ended
 * @property {boolean} isStarted - Whether or not the {@link Track} has started
 * @property {boolean} isEnabled - Whether or not the {@link Track} is enabled
 *  (i.e., whether it is paused or muted)
 * @property {string} kind - The kind of the underlying
 *   {@link MediaStreamTrack}; e.g. "audio" or "video"
 * @property {MediaStream} mediaStream - The underlying MediaStream
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 * @fires Track#disabled
 * @fires Track#enabled
 * @fires Track#ended
 * @fires Track#started
 */
function Track(mediaStream, mediaStreamTrack) {
  EventEmitter.call(this);
  var isEnabled = true;
  var isEnded = false;
  var isStarted = false;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _isEnabled: {
      get: function() {
        return isEnabled;
      },
      set: function(_isEnabled) {
        isEnabled = _isEnabled;
      }
    },
    _isEnded: {
      get: function() {
        return isEnded;
      },
      set: function(_isEnded) {
        isEnded = _isEnded;
      }
    },
    _isStarted: {
      get: function() {
        return isStarted;
      },
      set: function(_isStarted) {
        isStarted = _isStarted;
      }
    },
    attachments: {
      value: new Set()
    },
    id: {
      enumerable: true,
      value: mediaStreamTrack.id
    },
    isEnabled: {
      get: function() {
        return isEnabled;
      }
    },
    isEnded: {
      get: function() {
        return isEnded;
      }
    },
    isStarted: {
      get: function() {
        return isStarted;
      }
    },
    kind: {
      enumerable: true,
      value: mediaStreamTrack.kind
    },
    mediaStream: {
      enumerable: true,
      value: mediaStream
    },
    mediaStreamTrack: {
      enumerable: true,
      value: mediaStreamTrack
    }
  });
  var self = this;
  mediaStreamTrack.onended = function onended() {
    /* eslint no-use-before-define:0 */
    self.emit(ENDED, self);
  };
  emitStartedEvent(this);
}

var DISABLED = Track.DISABLED = 'disabled';
var ENABLED = Track.ENABLED = 'enabled';
var ENDED = Track.ENDED = 'ended';
var STARTED = Track.STARTED = 'started';

function emitStartedEvent(track) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var elem = document.createElement(track.kind);
  elem.muted = true;
  elem.oncanplay = function oncanplay() {
    track.detach(elem);
    track._isStarted = true;
    if (track.kind === 'video') {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
    }
    track.emit(STARTED, track);
    elem.oncanplay = null;
  };
  track.once(ENDED, function() {
    track.detach(elem);
    elem.oncanplay = null;
  });
  return track.attach(elem);
}

function attachAudio(audio, mediaStream) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      var vendorURL = window.URL || window.webkitURL;
      audio.src = vendorURL.createObjectURL(mediaStream);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      audio.mozSrcObject = mediaStream;
    }
    audio.play();
    return audio;
  }
  throw new Error('Cannot attach to <audio> element');
}

Track.attachAudio = attachAudio;

function attachVideo(video, mediaStream) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      var vendorURL = window.URL || window.webkitURL;
      video.src = vendorURL.createObjectURL(mediaStream);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      video.mozSrcObject = mediaStream;
    }
    video.muted = true;
    video.play();
    return video;
  }
  throw new Error('Cannot attach to <video> element');
}

Track.attachVideo = attachVideo;

inherits(Track, EventEmitter);

Track.prototype._enable = function _enable(enabled) {
  if (this._isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit(enabled ? ENABLED : DISABLED, this);
  }
  return this;
};

Track.prototype.attach = function attach() {
  var args = [].slice.call(arguments);
  args.unshift(this);
  return attachAudioOrVideoTrack.apply(this, args);
};

Track.prototype.detach = function detach() {
  var args = [].slice.call(arguments);
  args.unshift(this);
  return detachAudioOrVideoTrack.apply(this, args);
};

function attachAudioOrVideoTrack(track, el) {
  if (!el) {
    return createElementAndAttachAudioOrVideoTrack(track);
  } else if (typeof el === 'string') {
    return selectElementAndAttachAudioOrVideoTrack(track, el);
  }
  return attachAudioOrVideoTrackToElement(track, el);
}

function attachAudioOrVideoTrackToElement(track, el) {
  if (track.attachments.has(el)) {
    return el;
  }
  var attachMethod = track.kind === 'audio' ? attachAudio : attachVideo;
  attachMethod(el, track.mediaStream);
  track.attachments.add(el);
  return el;
}

function selectElementAndAttachAudioOrVideoTrack(track, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return attachAudioOrVideoTrackToElement(track, el);
}

function createElementAndAttachAudioOrVideoTrack(track) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.createElement(track.kind);
  return attachAudioOrVideoTrackToElement(track, el);
}

function detachAudioOrVideoTrack(track, el) {
  if (!el) {
    return detachAudioOrVideoTrackFromAllElements(track);
  } else if (typeof el === 'string') {
    return selectElementAndDetachAudioOrVideoTrack(track, el);
  }
  return detachAudioOrVideoTrackFromElement(track, el);
}

Track.detachAudioOrVideoTrack = detachAudioOrVideoTrack;

function detachAudioOrVideoTrackFromElement(track, el) {
  if (!track.attachments.has(el)) {
    return el;
  }
  el.removeAttribute('src');
  track.attachments.delete(el);
  return el;
}

function selectElementAndDetachAudioOrVideoTrack(track, selector) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var el = document.querySelector(selector);
  if (!el) {
    throw new Error('document.querySelector returned nothing');
  }
  return detachAudioOrVideoTrackFromElement(track, el);
}

function detachAudioOrVideoTrackFromAllElements(track) {
  var els = [];
  track.attachments.forEach(function(el) {
    els.push(el);
    detachAudioOrVideoTrackFromElement(track, el);
  });
  return els;
}

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @type string
 * @typedef Track.ID
 */

/**
 * The {@link Track} was disabled. For {@link AudioTrack}s this means
 * "muted", and for {@link VideoTrack}s this means "paused".
 * @param {Track} track - The {@link Track} that was disabled
 * @event Track#disabled
 */

/**
 * The {@link Track} was enabled. For {@link AudioTrack}s this means
 * "unmuted", and for {@link VideoTrack}s this means "unpaused".
 * @param {Track} track - The {@link Track} that was enabled
 * @event Track#enabled
 */

/**
 * The {@link Track} ended. This means that the {@link Track} will no longer
 * playback audio or video.
 * @param {Track} track - The {@link Track} that ended
 * @event Track#ended
 */

/**
 * The {@link Track} started. This means that the {@link Track} contains
 * enough audio or video to begin playback.
 * @param {Track} track - The {@link Track} that started
 * @event Track#started
 */

module.exports = Track;

},{"events":44,"util":48}],9:[function(require,module,exports){
'use strict';

var AudioTrack = require('./audiotrack');
var inherits = require('util').inherits;
var LocalTrack = require('./localtrack');

/**
 * Construct a {@link LocalAudioTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalAudioTrack} is an {@link AudioTrack} representing
 * audio that your {@link Client} sends to a {@link Conversation}.
 * @extends {AudioTrack}
 * @extends {LocalTrack}
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function LocalAudioTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof LocalAudioTrack)) {
    return new LocalAudioTrack(mediaStream, mediaStreamTrack);
  }
  AudioTrack.call(this, mediaStream, mediaStreamTrack);
}

inherits(LocalAudioTrack, AudioTrack);

/**
 * Disable the {@link LocalAudioTrack}. This is effectively "mute".
 * @method
 * @returns {this}
 * @fires Track#disabled
 */
LocalAudioTrack.prototype.disable = LocalTrack.prototype.disable;

/**
 * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
 * @method
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute" or
 * "mute".
 * @method
 * @param {boolean} [enabled] - Specify false to mute the {@link LocalAudioTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalAudioTrack.prototype.enable = LocalTrack.prototype.enable;

LocalAudioTrack.prototype.stop = LocalTrack.prototype.stop;

module.exports = LocalAudioTrack;

},{"./audiotrack":7,"./localtrack":10,"util":48}],10:[function(require,module,exports){
'use strict';

/**
 * @class
 * @classdesc A {@link LocalTrack} represents audio or video that your
 * {@link Client} is sending to a {@link Conversation}. As such, it can be
 * enabled and disabled with {@link LocalTrack#enable} and
 * {@link LocalTrack#disable} or stopped completely with
 * {@link LocalTrack#stop}.
 * @extends Track
 */
function LocalTrack() {
  // A LocalTrack should never be constructed directly; instead,
  // LocalAudioTrack and LocalVideoTrack borrow methods from LocalTrack's
  // prototype.
}

/**
 * Enable the {@link LocalTrack}.
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalTrack}.
 * @param {boolean} [enabled] - Specify false to disable the {@link LocalTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalTrack.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  this.mediaStreamTrack.enabled = enabled;
  return this._enable(enabled);
};

/**
 * Disable the {@link LocalTrack}.
 * @returns {this}
 * @fires Track#disabled
 */
LocalTrack.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Stop sending this {@link LocalTrack}.
 * @returns {this}
 * @fires Track#ended
 */
LocalTrack.prototype.stop = function stop() {
  this.mediaStreamTrack.stop();
  return this;
};

module.exports = LocalTrack;

},{}],11:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrack = require('./localtrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link LocalVideoTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalVideoTrack} is a {@link VideoTrack} representing
 * audio that your {@link Client} sends to a {@link Conversation}.
 * @extends {VideoTrack}
 * @extends {LocalTrack}
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function LocalVideoTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof LocalVideoTrack)) {
    return new LocalVideoTrack(mediaStream, mediaStreamTrack);
  }
  VideoTrack.call(this, mediaStream, mediaStreamTrack);
}

inherits(LocalVideoTrack, VideoTrack);

/**
 * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
 * @method
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause" or
 * "pause".
 * @method
 * @param {boolean} [enabled] - Specify false to pause the {@link LocalVideoTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalVideoTrack.prototype.enable = LocalTrack.prototype.enable;

/**
 * Disable the {@link LocalVideoTrack}. This is effectively "pause".
 * @method
 * @returns {this}
 * @fires Track#disabled
 */
LocalVideoTrack.prototype.disable = LocalTrack.prototype.disable;

LocalVideoTrack.prototype.stop = LocalTrack.prototype.stop;

module.exports = LocalVideoTrack;

},{"./localtrack":10,"./videotrack":12,"util":48}],12:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct a {@link VideoTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link VideoTrack} is a {@link Track} representing video.
 * @extends Track
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {Set<HTMLElement>} attachments - The &lt;video&gt; elements this
 *   {@link VideoTrack} is currently attached to (managed by
 *   {@link VideoTrack#attach})
 * @property {VideoTrack#Dimensions} dimensions - The {@link VideoTrack}'s {@link VideoTrack#Dimensions}
 * @fires VideoTrack#dimensionsChanged
 */
function VideoTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof VideoTrack)) {
    return new VideoTrack(mediaStream, mediaStreamTrack);
  }
  Track.call(this, mediaStream, mediaStreamTrack);
  Object.defineProperties(this, {
    dimensions: {
      enumerable: true,
      value: {
        width: null,
        height: null
      }
    }
  });
  mediaStream.onaddtrack = function onaddtrack() {
    this.attachments.forEach(function(video) {
      Track.detachAudioOrVideoTrack(this, video);
      Track.attachVideo(video, mediaStream);
    }, this);
  }.bind(this);
  emitDimensionsChangedEvents(this);
  return this;
}

var DIMENSIONS_CHANGED = VideoTrack.DIMENSIONS_CHANGED = 'dimensionsChanged';

function emitDimensionsChangedEvents(track) {
  if (typeof document === 'undefined') {
    throw new Error('document is undefined');
  }
  var elem = document.createElement(track.kind);
  elem.muted = true;
  elem.onloadedmetadata = function onloadedmetadata() {
    if (dimensionsChanged(track, elem)) {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
    }
  };
  elem.onresize = function onresize() {
    if (dimensionsChanged(track, elem)) {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
      if (track.isStarted) {
        track.emit(DIMENSIONS_CHANGED, track);
      }
    }
  };
  track.once(Track.ENDED, function() {
    track.detach(elem);
    elem.onloadedmetadata = null;
  });
  return track.attach(elem);
}

function dimensionsChanged(track, elem) {
  return track.dimensions.width !== elem.videoWidth
    || track.dimensions.height !== elem.videoHeight;
}

inherits(VideoTrack, Track);

/**
 * Attach the {@link VideoTrack} to a newly created &lt;video&gt; element.
 * @method
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach();
 * document.getElementById('div#remote-video-container').appendChild(remoteVideoEl);
*//**
 * Attach the {@link VideoTrack} to an existing &lt;video&gt; element.
 * @method
 * @param {HTMLElement} video - The &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = document.getElementById('remote-video');
 * videoTrack.attach(remoteVideoEl);
*//**
 * Attach the {@link VideoTrack} to a &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to attach to
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = videoTrack.attach('video#remote-video');
 */
VideoTrack.prototype.attach = Track.prototype.attach;

/**
 * Detach the {@link VideoTrack} from any and all previously attached &lt;video&gt; elements.
 * @method
 * @returns {Array<HTMLElement>}
 * @example
 * var detachedVideoEls = videoTrack.detach();
*//**
 * Detach the {@link VideoTrack} from a previously attached &lt;video&gt; element.
 * @method
 * @param {HTMLElement} video - The &lt;video&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var remoteVideoEl = document.getElementById('remote-video');
 * videoTrack.detach(remoteVideoEl);
*//**
 * Detach the {@link VideoTrack} from a previously attached &lt;video&gt; element selected by
 * <code>document.querySelector</code>.
 * @method
 * @param {string} selector - A query selector for the &lt;video&gt; element to detach from
 * @returns {HTMLElement}
 * @example
 * var detachedVideoEl = media.detach('div#remote-video');
 */
VideoTrack.prototype.detach = Track.prototype.detach;

/**
 * A {@link VideoTrack}'s width and height.
 * @typedef VideoTrack#Dimensions
 * @type {Object}
 * @property {?number} width - The {@link VideoTrack}'s width or null if the
 *   {@link VideoTrack} has not yet started
 * @property {?number} height - The {@link VideoTrack}'s height or null if the
 *   {@link VideoTrack} has not yet started
 */

/**
 * The {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event VideoTrack#dimensionsChanged
 */

module.exports = VideoTrack;

},{"./":8,"util":48}],13:[function(require,module,exports){
'use strict';

var CancelablePromise = require('./util/cancelablepromise');
var constants = require('./util/constants');
var Conversation = require('./conversation');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./signaling/invitetransaction/inviteclienttransaction');
var LocalMedia = require('./media/localmedia');
var TimeoutPromise = require('./util/timeoutpromise');
var util = require('./util');

/**
 * Construct an {@link OutgoingInvite}.
 * @class
 * @classdesc An {@link OutgoingInvite} is a Promise that eventually resolves
 *   to a {@link Conversation} if one or more {@link Participant}s accept the
 *   corresponding {@link IncomingInvite}. An {@link OutgoingInvite} may be
 *   canceled up until a {@link Participant} has accepted it.
 *   <br><br>
 *   {@link OutgoingInvite}s are returned by {@link Client#inviteToConversation}.
 * @extends Promise<Conversation>
 * @param {UserAgent} userAgent - the {@link UserAgent} to perform the invite
 * @param {Array<string>} participants - the {@link Participant} identities to
 *   invite
 * @param {?object} [options]
 * @property {string} status - The status of this {@link OutgoingInvite}, either
 *   "accepted", "rejected", "canceled", "failed", or "pending"
 * @property {Array<string>} to - The {@link Participant} identities
 *   invited by this {@link OutgoingInvite}
 * @fires OutgoingInvite#accepted
 * @fires OutgoingInvite#canceled
 * @fires OutgoingInvite#failed
 * @fires OutgoingInvite#rejected
 */
function OutgoingInvite(userAgent, participants, options) {
  if (!(this instanceof OutgoingInvite)) {
    return new OutgoingInvite(userAgent, participants, options);
  }
  EventEmitter.call(this);

  options = util.withDefaults({ }, options);

  var deferred = util.defer();
  var timeoutPromise = new TimeoutPromise(deferred.promise);
  var cancelablePromise = new CancelablePromise(timeoutPromise);

  var shouldStopLocalMediaOnFailure = false;

  var conversation = new Conversation(options);
  var cookie = util.makeUUID();
  var ict;
  var localMedia = null;
  var self = this;
  var status = 'pending';

  // TimeoutPromise and CancelablePromise reject with their own errors;
  // instead, reject with TwilioErrors describing the state of the
  // OutgoingInvite.
  //
  // Also, stop any LocalMedia acquired (otherwise, the user will never get a
  // handle to it and cannot stop it themselves).
  var promise = cancelablePromise.catch(function cancelablePromiseRejected(reason) {
    if (shouldStopLocalMediaOnFailure && localMedia) {
      localMedia.stop();
    }
    if (timeoutPromise.isTimedOut) {
      reason = E.CONVERSATION_INVITE_FAILED;
    } else if (cancelablePromise.isCanceled) {
      reason = E.CONVERSATION_INVITE_CANCELED;
    }
    throw reason;
  });

  Object.defineProperties(this, {
    _cancelablePromise: {
      value: cancelablePromise
    },
    _conversation: {
      value: conversation
    },
    _cookie: {
      value: cookie
    },
    _localMedia: {
      get: function() {
        return localMedia;
      },
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    _onReceiveInvite: {
      value: setupConversation
    },
    _options: {
      value: options
    },
    _promise: {
      value: promise
    },
    _status: {
      get: function() {
        return status;
      },
      set: function(_status) {
        status = _status;
      }
    },
    _timeoutPromise: {
      value: timeoutPromise
    },
    status: {
      enumerable: true,
      get: function() {
        return status;
      }
    },
    to: {
      enumerable: true,
      value: participants
    }
  });

  getLocalMedia()
    .then(setLocalMedia)
    .then(inviteParticipants)
    .then(setupConversation, inviteParticipantsFailed);

  function getLocalMedia() {
    if (!options.localMedia && !options.localStream) {
      shouldStopLocalMediaOnFailure = true;
    }
    return LocalMedia.getLocalMedia(options);
  }

  function setLocalMedia(_localMedia) {
    localMedia = _localMedia;
    conversation._localMedia = localMedia;
    conversation._shouldStopLocalMediaOnDisconnect = shouldStopLocalMediaOnFailure;
    options.localMedia = localMedia;
    timeoutPromise.start(constants.DEFAULT_CALL_TIMEOUT);
  }

  function inviteParticipants() {
    if (self.status !== 'pending' && self.status !== 'accepted') {
      return null;
    }

    options.cookie = cookie;
    ict = userAgent.invite(participants, options);
    return ict;
  }

  function setupConversation(dialog) {
    if (!dialog || self.status !== 'pending' && self.status !== 'accepted') {
      return;
    }

    conversation._onDialog(dialog);

    if (self.status !== 'accepted') {
      self._status = 'accepted';
      self.emit('accepted', self);
    }

    deferred.resolve(conversation);
  }

  function inviteParticipantsFailed(reason) {
    // If inviteParticipants failed with the InviteClientTransaction, but this
    // OutgoingInvite was to more than one Participant, then do not reject
    // immediately; instead, continue waiting for an InviteServerTransaction.
    //
    // If no InviteServerTransaction is received, the TimeoutPromise will
    // time out. Truly, something else may have happened: the other
    // Participant(s) may have rejected, a server error may have occurred,
    // etc.; however, the best we can do for now is raise "failed".
    if (reason instanceof InviteClientTransaction) {
      if (participants.length > 1) {
        return;
      }

      var error;
      switch (reason.state) {
        case 'canceled':
          error = E.CONVERSATION_INVITE_CANCELED;
          break;
        case 'rejected':
          if (self.status === 'pending') {
            self._status = 'rejected';
            self.emit('rejected', self);
          }
          error = E.CONVERSATION_INVITE_REJECTED;
          break;
        case 'failed':
        default:
          if (self.status === 'pending') {
            self._status = 'failed';
            self.emit('failed', self);
          }
          error = E.CONVERSATION_INVITE_FAILED;
      }

      deferred.reject(error);
      return;
    }

    // If inviteParticipants failed with an Error, if may have been a
    // getUserMedia error; reject accordingly.
    if (reason instanceof Error && ['PermissionDeniedError', 'PERMISSION_DENIED'].indexOf(reason.name) > -1) {
      if (self.status === 'pending') {
        self._status = 'failed';
        self.emit('failed', self);
      }
      deferred.reject(E.MEDIA_ACCESS_DENIED);
      return;
    }

    deferred.reject(reason);
  }

  // If the TimeoutPromise times out, then no Participants have connected to
  // the Conversation within the time allotted for the OutgoingInvite, so
  // consider the OutgoingInvite failed.
  timeoutPromise.once('timedOut', function() {
    self._status = 'failed';
    self.emit('failed', self);
    if (ict) {
      ict.cancel(true);
    }
  });

  // If the CancelablePromise is canceled, then no Participants have connected
  // to the Conversation, so consider the OutgoingInvite canceled.
  cancelablePromise.once('canceled', function() {
    self._status = 'canceled';
    self.emit('canceled', self);
    if (ict) {
      ict.cancel();
    }
  });
}

inherits(OutgoingInvite, EventEmitter);

OutgoingInvite.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  if (this.status !== 'pending' && this.status !== 'accepted') {
    inviteServerTransaction.reject();
    return this;
  }

  inviteServerTransaction.accept(this._options)
    .then(this._onReceiveInvite)
    .catch(function() {
      // Do nothing. We will receive a participantFailed Conversation event.
    });

  return this;
};

/**
 * Attempt to cancel the {@link OutgoingInvite}.
 * @returns {this}
 */
OutgoingInvite.prototype.cancel = function cancel() {
  this._cancelablePromise.cancel();
  return this;
};

OutgoingInvite.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

OutgoingInvite.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link OutgoingInvite} was accepted, and the {@link Client} is now
 * participating in the {@link Conversation}.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#accepted
 */

/**
 * The {@link OutgoingInvite} was rejected.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#rejected
 */

/**
 * The {@link OutgoingInvite} was canceled.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#canceled
 */

/**
 * The {@link OutgoingInvite} failed.
 * @param {OutgoingInvite} invite - The {@link OutgoingInvite}
 * @event OutgoingInvite#failed
 */

module.exports = OutgoingInvite;

},{"./conversation":3,"./media/localmedia":6,"./signaling/invitetransaction/inviteclienttransaction":19,"./util":31,"./util/cancelablepromise":29,"./util/constants":30,"./util/timeoutpromise":35,"events":44,"util":48}],14:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('./media');

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Conversation}.
 * @param {Participant.SID} sid - The {@link Participant}'s SID
 * @param {string} identity - The identity of the {@link Participant}
 * @param {PeerConnection} peerConnection - The PeerConnection between your {@link Client} and this {@link Participant} within the context of a {@link Conversation}
 * @param {?Media} [media] - The {@link Media} this {@link Participant} is sharing, if any
 * @property {string} identity - The identity of the {@link Participant}
 * @property {Media} media - The {@link Media} this {@link Participant} is sharing, if any
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackEnded
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(sid, identity, peerConnection, media) {
  if (!(this instanceof Participant)) {
    return new Participant(sid, identity, peerConnection, media);
  }

  EventEmitter.call(this);

  media = media || new Media();

  /* eslint no-use-before-define:0 */
  media.on(Media.TRACK_ADDED, this.emit.bind(this, TRACK_ADDED));
  media.on(Media.TRACK_DIMENSIONS_CHANGED, this.emit.bind(this, TRACK_DIMENSIONS_CHANGED));
  media.on(Media.TRACK_DISABLED, this.emit.bind(this, TRACK_DISABLED));
  media.on(Media.TRACK_ENABLED, this.emit.bind(this, TRACK_ENABLED));
  media.on(Media.TRACK_ENDED, this.emit.bind(this, TRACK_ENDED));
  media.on(Media.TRACK_REMOVED, this.emit.bind(this, TRACK_REMOVED));
  media.on(Media.TRACK_STARTED, this.emit.bind(this, TRACK_STARTED));

  /* istanbul ignore next */
  Object.defineProperties(this, {
    identity: {
      enumerable: true,
      value: identity
    },
    media: {
      enumerable: true,
      value: media
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });

  return this;
}

var TRACK_ADDED = Participant.TRACK_ADDED = Media.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = Participant.TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = Participant.TRACK_DISABLED = Media.TRACK_DISABLED;
var TRACK_ENABLED = Participant.TRACK_ENABLED = Media.TRACK_ENABLED;
var TRACK_ENDED = Participant.TRACK_ENDED = Media.TRACK_ENDED;
var TRACK_REMOVED = Participant.TRACK_REMOVED = Media.TRACK_REMOVED;
var TRACK_STARTED = Participant.TRACK_STARTED = Media.TRACK_STARTED;

inherits(Participant, EventEmitter);

/**
 * Update the {@link Participant} upon receipt of a {@link ConversationEvent}.
 * @private
 * @param {ConversationEvent} event
 * @returns {Participant}
 */
Participant.prototype._onConversationEvent = function _onConversationEvent(event) {
  if (event.participant_sid !== this.sid) {
    return this;
  }

  event.tracks.forEach(function(_track) {
    var trackId = _track.id;
    var track = this.media.tracks.get(trackId);
    if (!track) {
      return;
    }

    switch (event.event.toLowerCase()) {
      case 'track_disabled':
        track._enable(false);
        break;
      case 'track_enabled':
        track._enable(true);
        break;
      case 'track_removed':
        this.media._removeTrack(track);
    }
  }, this);

  return this;
};

Object.freeze(Participant.prototype);

/**
 * A {@link Participant.SID} is a 34-character string starting with "PA"
 * that uniquely identifies a {@link Participant}.
 * @type string
 * @typedef Participant.SID
 */

/**
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was disabled
 * @event Participant#trackDisabled
 */

/**
 * A {@link Track} was enabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was enabled
 * @event Participant#trackEnabled
 */

/**
 * One of the {@link Participant}'s {@link Track}s ended.
 * @param {Track} track - The {@link Track} that ended
 * @event Participant#trackEnded
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 */

/**
 * One of the {@link Participant}'s {@link Track}s started.
 * @param {Track} track - The {@link Track} that started
 * @event Participant#trackStarted
 */

module.exports = Participant;

},{"./media":5,"events":44,"util":48}],15:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link QueueingEventEmitter}
 * @class
 * @classdesc A {@link QueueingEventEmitter} can queue events until a listener
 *   has been added.
 * @extends EventEmitter
 */
function QueueingEventEmitter() {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _queuedEvents: {
      value: new Map()
    }
  });
}

inherits(QueueingEventEmitter, EventEmitter);

/**
 * Emit any queued events.
 * @returns {boolean} true if every event had listeners, false otherwise
*//**
 * Emit any queued events matching the event name.
 * @param {string} event
 * @returns {boolean} true if every event had listeners, false otherwise
 */
QueueingEventEmitter.prototype.dequeue = function dequeue(event) {
  var result = true;
  if (!event) {
    this._queuedEvents.forEach(function(_, queuedEvent) {
      result = this.dequeue(queuedEvent) && result;
    }, this);
    return result;
  }
  var queue = this._queuedEvents.get(event) || [];
  this._queuedEvents.delete(event);
  var self = this;
  return queue.reduce(function(result, args) {
    return self.emit.apply(self, [event].concat(args)) && result;
  }, result);
};

/**
 * If the event has listeners, emit the event; otherwise, queue the event.
 * @param {string} event
 * @param {...*} args
 * @returns {boolean} true if the event had listeners, false if the event was queued
 */
QueueingEventEmitter.prototype.queue = function queue() {
  var args = [].slice.call(arguments);
  if (this.emit.apply(this, args)) {
    return true;
  }
  var event = args[0];
  if (!this._queuedEvents.has(event)) {
    this._queuedEvents.set(event, []);
  }
  this._queuedEvents.get(event).push(args.slice(1));
  return false;
};

module.exports = QueueingEventEmitter;

},{"events":44,"util":48}],16:[function(require,module,exports){
'use strict';

var util = require('../util');
var validation = require('../util/validation');

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef ConversationInfo
 * @type {object}
 */

var PROTOCOL_VERSION = 'v1';

/**
 * JSON conformant to version 1 of the application/conversation-info+json
 * content-type.
 * @typedef Notification
 * @type {object}
 * @property {string} protocol_version
 * @property {Array<ConversationEvent>} event_list
 */

/**
 * A partial {@link Notification} received from the server
 * @typedef PartialNotification
 * @type {Notification}
 */

/**
 * A full {@link Notification} received from the server
 * @typedef FullNotification
 * @type {PartialNotification}
 * @property {ConversationState} conversation_state
 */

/**
 * @typedef ConversationState
 * @type {Object}
 * @property {number} instance_version
 * @property {string} sid - a {@link Conversation} SID
 * @property {Array<ParticipantInfo>} participants
 */

/**
 * @typedef ParticipantInfo
 * @type {Object}
 * @property {string} sid - a {@link Participant} SID
 * @property {string} address - a {@link Participant} address
 * @property {Array<TrackInfo>} tracks
 */

/**
 * @typedef TrackInfo
 * @type {Object}
 * @property {?string} id - a {@link Track} ID
 * @property {string} kind - one of "audio" or "video"
 */

/**
 * @typedef ConversationEvent
 * @type {ParticipantInfo}
 * @property {string} event - one of "participantConnected" or
 *   "participantDisconnected"
 * @property {number} instance_version
 */

/**
 * Check whether a {@link Notification} is a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {boolean}
 */
function isPartialNotification(notification) {
  return !isFullNotification(notification);
}

/**
 * Check whether a {@link Notification} is a {@link FullNotification}.
 * @param {string|Object} notification
 * @returns {boolean}
 */
function isFullNotification(notification) {
  notification = validation.validateOr(validation.parseStringOrJSON.bind(null, notification), false);
  return notification && 'conversation_state' in notification;
}

/**
 * Parse a {@link FullNotification} or a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {FullNotification|PartialNotification}
 * @throws {Error}
 */
function parseNotification(stringOrJSON) {
  var notification = validation.parseStringOrJSON(stringOrJSON);
  return isFullNotification(notification)
    ? parseFullNotification(notification)
    : parsePartialNotification(notification);
}

/**
 * Parse a {@link PartialNotification}.
 * @param {string|Object} notification
 * @returns {PartialNotification}
 * @throws {Error}
 */
function parsePartialNotification(stringOrJSON) {
  return validatePartialNotification(validation.parseStringOrJSON(stringOrJSON));
}

/**
 * Validate a {@link PartialNotification}.
 * @param {*} partialNotification
 * @returns {PartialNotification}
 * @throws {Error}
 */
function validatePartialNotification(partialNotification) {
  validation.validateObject('Partial Notification', partialNotification);
  /* eslint camelcase:0, dot-notation:0 */
  return {
    protocol_version: validateProtocolVersion(partialNotification['protocol_version']),
    event_list: validateConversationEvents(partialNotification['event_list'])
  };
}

/**
 * Validate a supported protocol version.
 * @param {*} protocolVersion
 * @returns {string}
 * @throws {Error}
 */
function validateProtocolVersion(protocolVersion) {
  validation.validateString('Protocol version', protocolVersion);
  if (protocolVersion.toLowerCase() !== PROTOCOL_VERSION) {
    throw new Error('Unsupported protocol version: ' + protocolVersion);
  }
  return protocolVersion;
}

/**
 * Validate {@link ConversationEvent}s. Invalid {@link ConversationEvent}s will
 * be filtered.
 * @param {*} eventList
 * @returns {Array<ConversationEvent>}
 */
function validateConversationEvents(eventList) {
  return validation.validateOr(validation.validateArray.bind(null, 'Event list', eventList), [])
    .map(validateConversationEventOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate {@link ConversationEvent}.
 * @param {*} conversationEvent
 * @returns {ConversationEvent}
 * @throws {Error}
 */
function validateConversationEvent(conversationEvent) {
  validation.validateObject('Conversation Event', conversationEvent);
  /* eslint dot-notation:0 */
  var event = validateConversationEventType(conversationEvent['event']);
  conversationEvent = validateParticipantInfo(conversationEvent);
  conversationEvent.event = event;
  return conversationEvent;
}

/**
 * Validate {@link ConversationEvent} or return null.
 * @param {*} conversationEvent
 * @returns {?ConversationEvent}
 */
function validateConversationEventOrNull(conversationEvent) {
  return validation.validateOr(validateConversationEvent.bind(null, conversationEvent), null);
}

/**
 * Validate {@link ConversationEvent} type. Invalid {@link ConversationEvent}
 * type returns null.
 * @param {*} conversationEventType
 * @returns {string}
 * @throws {Error}
 */
function validateConversationEventType(conversationEventType) {
  validation.validateString('Conversation Event type', conversationEventType);
  switch (conversationEventType.toLowerCase()) {
    case 'participant_connected':
    case 'participant_disconnected':
    case 'participant_failed':
    case 'track_added':
    case 'track_disabled':
    case 'track_enabled':
    case 'track_removed':
      return conversationEventType;
    default:
      throw new Error('Unknown Conversation Event type: ' + conversationEventType);
  }
}

/**
 * Validate instance version.
 * @param {*} instanceVesion
 * @returns {number}
 * @throws {Error}
 */
function validateInstanceVersion(instanceVersion) {
  return validation.validateInteger('Instance version', instanceVersion);
}

/**
 * Parse a {@link FullNotification}.
 * @param {string|Object} notification
 * @returns {FullNotification}
 * @throws {Error}
 */
function parseFullNotification(stringOrJSON) {
  return validateFullNotification(validation.parseStringOrJSON(stringOrJSON));
}

/**
 * Validate a {@link FullNotification}.
 * @param {*} fullNotification
 * @returns {FullNotification}
 * @throws {Error}
 */
function validateFullNotification(fullNotification) {
  validation.validateObject('Full Notification', fullNotification);
  /* eslint dot-notation:0 */
  var conversationState = fullNotification['conversation_state'];
  fullNotification = validatePartialNotification(fullNotification);
  fullNotification.conversation_state = validateConversationState(conversationState);
  return fullNotification;
}

/**
 * Validate {@link ConversationState}.
 * @param {*} conversationState
 * @returns {ConversationState}
 * @throws {Error}
 */
function validateConversationState(conversationState) {
  validation.validateObject('Conversation State', conversationState);
  /* eslint camelcase:0, dot-notation:0 */
  return {
    instance_version: validateInstanceVersion(conversationState['instance_version']),
    sid: validateConversationSid(conversationState['sid']),
    participants: validateParticipantInfos(conversationState['participants'])
  };
}

/**
 * Validate a {@link Conversation} SID.
 * @param {*} conversationSid
 * @returns {string}
 * @throws {Error}
 */
function validateConversationSid(conversationSid) {
  return validation.validateString('Conversation SID', conversationSid);
}

/**
 * Validate {@link ParticipantInfo}s. Invalid {@link ParticipantInfo}s will be
 * filtered.
 * @param {*} participantInfos
 * @returns {Array<ParticipantInfo>}
 */
function validateParticipantInfos(participantInfos) {
  return validation.validateOr(validation.validateArray.bind(null, 'Participants', participantInfos), [])
    .map(validateParticipantInfoOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate {@link ParticipantInfo}.
 * @param {*} participantInfo
 * @returns {ParticipantInfo}
 * @throws {Error}
 */
function validateParticipantInfo(participantInfo) {
  validation.validateObject('Participant Info', participantInfo);
  /* eslint camelcase:0, dot-notation:0 */
  return {
    participant_sid: validateParticipantSid(participantInfo['participant_sid']),
    address: validateParticipantAddress(participantInfo['address']),
    tracks: validateTrackInfos(participantInfo['tracks'])
  };
}

/**
 * Validate {@link ParticipantInfo} or return null.
 * @param {*} participantInfo
 * @returns {?ParticipantInfo}
 */
function validateParticipantInfoOrNull(participantInfo) {
  return validation.validateOr(validateParticipantInfo.bind(null, participantInfo), null);
}

/**
 * Validate a {@link Participant} SID.
 * @param {*} participantSid
 * @returns {string}
 * @throws Error
 */
function validateParticipantSid(participantSid) {
  return validation.validateString('Participant SID', participantSid);
}

/**
 * Validate a {@link Participant} address.
 * @param {*} participantAddress
 * @returns {string}
 * @throws Error
 */
function validateParticipantAddress(participantAddress) {
  return validation.validateString('Participant address', participantAddress);
}

/**
 * Validate {@link TrackInfo}s. Invalid {@link TrackInfo}s will be filtered.
 * @param {*} trackInfos
 * @returns {Array<TrackInfo>}
 */
function validateTrackInfos(trackInfos) {
  return validation.validateOr(validation.validateArray.bind(null, 'Tracks', trackInfos), [])
    .map(validateTrackInfoOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate {@link Trackinfo}.
 * @param {*} trackInfo
 * @returns {TrackInfo}
 * @throws {Error}
 */
function validateTrackInfo(trackInfo) {
  validation.validateObject('Track Info', trackInfo);
  /* eslint dot-notation:0 */
  return {
    id: validateTrackId(trackInfo['id']),
    kind: validateTrackKind(trackInfo['kind'])
  };
}

/**
 * Validate {@link TrackInfo} or return null.
 * @parma {*} trackInfo
 * @returns {?TrackInfo}
 */
function validateTrackInfoOrNull(trackInfo) {
  return validation.validateOr(validateTrackInfo.bind(null, trackInfo), null);
}

/**
 * Validate a {@link Track} ID.
 * @param {*} id
 * @returns {string}
 * @throws {Error}
 */
function validateTrackId(id) {
  return validation.validateString('Track ID', id);
}

/**
 * Validate a {@link Track} kind.
 * @param {*} kind
 * @returns {string}
 * @throws {Error}
 */
function validateTrackKind(kind) {
  validation.validateString('Track kind', kind);
  switch (kind.toLowerCase()) {
    case 'audio':
    case 'video':
      return kind;
    default:
      throw new Error('Unknown Track kind: ' + kind);
  }
}

/**
 * Make a fake "participant_connected" Conversation Event.
 * @param {Dialog} dialog
 * @param {sid} participantSid
 * @returns {PartialNotification}
 */
function simulateParticipantConnectedEvent(dialog, participantSid) {
  /* eslint camelcase:0 */
  return {
    event_list: [
      {
        event: 'participant_connected',
        participant_sid: participantSid,
        address: dialog.remote,
        tracks: []
      }
    ]
  };
}

/**
 * Make fake "participant_disconnected" Conversation Events.
 * @param {Map<string, Participant>} participants
 * @param {Dialog} dialog
 * @returns {PartialNotification}
 */
function simulateParticipantDisconnectedEvents(participants, dialog) {
  var eventList = [];

  participants.forEach(function(participant) {
    if (participant.address !== util.getUser(dialog.remote)) {
      return;
    }

    var tracks = [];

    participant.media.tracks.forEach(function(track) {
      tracks.push({
        id: track.id,
        kind: track.kind
      });
    });

    /* eslint camelcase:0 */
    var event = {
      event: 'participant_disconnected',
      participant_sid: participant.sid,
      address: participant.address,
      tracks: tracks
    };

    eventList.push(event);
  });

  /* eslint camelcase:0 */
  return {
    event_list: eventList
  };
}

/**
 * Generate {@link ConversationInfo} for a {@link Track} change.
 * @private
 * @param {string} event - the event name
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 * @param {Track} track - the {@link Track}
 * @returns ConversationInfo
 */
function track(event, participantSid, _track) {
  /* eslint camelcase:0 */
  return {
    protocol_version: PROTOCOL_VERSION,
    type: 'partial',
    event_list: [
      {
        event: event,
        time_stamp: (new Date()).toUTCString(),
        participant_sid: participantSid,
        tracks: [
          {
            kind: _track.kind,
            id: _track.id
          }
        ]
      }
    ]
  };
}

/**
 * Generate {@link ConversationInfo} for disabling a {@link Track}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link Track}
 * @returns ConversationInfo
 */
var trackDisabled = track.bind(null, 'track_disabled');

/**
 * Generate {@link ConversationInfo} for enabling a {@link Track}.
 * @param {string} address - the address of the {@link Participant} who owns
 *   the {@link Track}
 * @param {string} participantSid - the SID of the {@link Participant} who owns
 *   the {@link Track}
 * @returns ConversationInfo
 */
var trackEnabled = track.bind(null, 'track_enabled');

module.exports.isFullNotification = isFullNotification;
module.exports.isPartialNotification = isPartialNotification;
module.exports.parseFullNotification = parseFullNotification;
module.exports.parseNotification = parseNotification;
module.exports.parsePartialNotification = parsePartialNotification;
module.exports.simulateParticipantConnectedEvent = simulateParticipantConnectedEvent;
module.exports.simulateParticipantDisconnectedEvents = simulateParticipantDisconnectedEvents;
module.exports.trackDisabled = trackDisabled;
module.exports.trackEnabled = trackEnabled;

},{"../util":31,"../util/validation":37}],17:[function(require,module,exports){
'use strict';

var QueueingEventEmitter = require('../queueingeventemitter');
var getStatistics = require('../webrtc/getstatistics');
var inherits = require('util').inherits;
var Media = require('../media');
var conversationInfo = require('./conversation-info');
var util = require('../util');

/**
 * Construct a {@link Dialog}.
 * @class
 * @classdesc A {@link Dialog} represents an in-progress call.
 * @param {UserAgent} userAgent - the {@link UserAgent} that owns this {@link Dialog}
 * @param {string} remote - the remote participant in the {@link Dialog}
 * @param {string} conversationSid - the {@link Dialog}'s conversation SID
 * @param {string} callSid - the {@link Dialog}'s call SID
 * @param {LocalMedia} localMedia - the {@link LocalMedia}
 * @param {Media} remoteMedia - the remote {@link Media}
 * @param {PeerConnection} peerConnection - the PeerConnection
 * @param {string} participantSid - the {@link UserAgent}'s {@link Participant} SID
 * @property {string} callSid - the {@link Dialog}'s call SID
 * @property {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID
 * @property {boolean} ended - whether the {@link Dialog} has ended
 * @property {LocalMedia} localMedia - the {@link Dialog}'s {@link LocalMedia}
 * @property {PeerConnection} peerConnection - the PeerConnection
 * @property {string} remote - the remote participant in the {@link Dialog}
 * @property {Media} remoteMedia - the {@link Dialog}'s remote {@link Media}
 * @property {UserAgent} userAgent - the {@link UserAgent} that owns this
 *   {@link Dialog}
 * @fires Dialog#ended
 * @fires Dialog#notification
 * @fires Dialog#statistics
 */
function Dialog(userAgent, remote, conversationSid, callSid, localMedia, remoteMedia, peerConnection, participantSid) {
  var self = this;
  QueueingEventEmitter.call(this);

  var ended = false;

  var sampleInterval = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _ended: {
      set: function(_ended) {
        ended = _ended;
      }
    },
    _sampleInterval: {
      get: function() {
        return sampleInterval;
      },
      set: function(_sampleInterval) {
        sampleInterval = _sampleInterval;
      }
    },
    callSid: {
      enumerable: true,
      value: callSid
    },
    conversationSid: {
      enumerable: true,
      value: conversationSid
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    ended: {
      enumerable: true,
      get: function() {
        return ended;
      }
    },
    localMedia: {
      enumerable: true,
      value: localMedia
    },
    peerConnection: {
      enumerable: true,
      value: peerConnection
    },
    remote: {
      enumerable: true,
      value: remote
    },
    remoteMedia: {
      enumerable: true,
      value: remoteMedia
    },
    userAgent: {
      enumerable: true,
      value: userAgent
    }
  });

  function handleTrack(track) {
    if (self.ended) {
      /* eslint no-use-before-define:0 */
      localMedia.removeListener(Media.TRACK_ADDED, trackAdded);
      localMedia.removeListener(Media.TRACK_REMOVED, trackRemoved);
      return;
    }

    try {
      peerConnection.removeStream(track.mediaStream);
      peerConnection.addStream(track.mediaStream);
    } catch (error) {
      // Firefox doesn't support removeStream, so just add it.
      peerConnection.addStream(track.mediaStream);
    }

    self._reinvite();
  }

  var trackAdded = handleTrack;
  var trackRemoved = handleTrack;
  localMedia.on(Media.TRACK_ADDED, trackAdded);
  localMedia.on(Media.TRACK_REMOVED, trackRemoved);

  localMedia.on(Media.TRACK_DISABLED, function trackDisabled(track) {
    if (self.ended) {
      localMedia.removeListener(Media.TRACK_DISABLED, trackDisabled);
      return;
    }
    self.publish(conversationInfo.trackDisabled(self.participantSid, track));
  });
  localMedia.on(Media.TRACK_ENABLED, function trackEnabled(track) {
    if (self.ended) {
      return;
    }
    self.publish(conversationInfo.trackEnabled(self.participantSid, track));
  });

  try {
    startPublishingStatistics(this, 1000);
  } catch (e) {
    // TODO(mroberts): Log this.
    throw e;
  }

  return this;
}

inherits(Dialog, QueueingEventEmitter);

/**
 * Hangup the {@link Dialog}.
 * @returns {this}
 */
Dialog.prototype.end = function end() {
  if (this.ended) {
    return this;
  }
  this._ended = true;
  this.emit('ended', this);
  return this;
};

Dialog.prototype._reinvite = function _reinvite() {
  var self = this;
  var deferred = util.defer();
  setTimeout(function() {
    deferred.resolve(self);
    self.emit('reinvite', self);
  });
  return deferred.promise;
};

Dialog.prototype.refer = function refer(participant) {
  return this._refer(participant).then(
    this._onReferSuccess.bind(this),
    this._onReferFailure.bind(this));
};

Dialog.prototype._refer = function _refer() {
  var self = this;
  var deferred = util.defer();
  setTimeout(function() {
    deferred.resolve(self);
  });
  return deferred.promise;
};

Dialog.prototype._onReferSuccess = function _onReferSuccess() {
  return this;
};

Dialog.prototype._onReferFailure = function _onReferFailure(error) {
  throw error;
};

Dialog.prototype.publish = function publish(payload) {
  return this._publish(payload).then(
    this._onPublishSuccess.bind(this),
    this._onPublishFailure.bind(this));
};

Dialog.prototype._publish = function _publish() {
  var self = this;
  var deferred = util.defer();
  setTimeout(function() {
    deferred.resolve(self);
  });
  return deferred.promise;
};

Dialog.prototype._onPublishSuccess = function _onPublishSuccess() {
  return this;
};

Dialog.prototype._onPublishFailure = function _onPublishFailure(error) {
  throw error;
};

Dialog.prototype.getStats = function getStats() {
  var self = this;
  var deferred = util.defer();
  getStatistics(this.peerConnection, function(error, sample) {
    if (error) {
      return deferred.reject(error);
    }
    var stats = {
      callsid: self.callSid,
      samples: [sample]
    };
    deferred.resolve(stats);
  });
  return deferred.promise;
};

function startPublishingStatistics(dialog, sampleIntervalDuration) {
  var peerConnection = dialog.peerConnection;
  dialog._sampleInterval = setInterval(function() {
    getStatistics(peerConnection, function(error, stats) {
      // TODO(mroberts): Figure out how we want to handle this error.
      if (error) { return; }

      dialog.emit('stats', stats);
    });
  }, sampleIntervalDuration);

  dialog.once('ended', function() {
    if (dialog._sampleInterval) {
      clearInterval(dialog._sampleInterval);
      dialog._sampleInterval = null;
    }
  });
}

module.exports = Dialog;

},{"../media":5,"../queueingeventemitter":15,"../util":31,"../webrtc/getstatistics":38,"./conversation-info":16,"util":48}],18:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../../util');

// State Constants
var C = {
  STATE_PENDING: 'pending',
  STATE_ACCEPTED: 'accepted',
  STATE_REJECTED: 'rejected',
  STATE_CANCELED: 'canceled',
  STATE_FAILED: 'failed',
  FINAL_STATES: ['accepted', 'rejected', 'canceled', 'failed']
};

/**
 * Construct an {@link InviteTransaction}.
 * @class
 * @classdesc An {@link InviteTransaction} is a Promise for a {@link Dialog}.
 * @augments {Promise<Dialog>}
 * @param {UserAgent} userAgent - the {@link UserAgent} that owns this
 *   {@link InviteTransaction}
 * @property {?Dialog} dialog - the resulting {@link Dialog} when and if this
 *   {@link InviteTransaction} succeeds
 * @property {boolean} accepted - whether the {@link InviteTransaction}
 *   was accepted
 * @property {boolean} canceled - whether the {@link InviteTransaction}
 *   was canceled
 * @property {boolean} failed - whether the {@link InviteTransaction}
 *   failed
 * @property {boolean} rejected - whether the {@link InviteTransaction}
 *   was rejected
 * @property {(string|UserAgent)} userAgent - the {@link UserAgent} that owns
 *   this {@link InviteTransaction}
 * @fires InviteTransaction#accepted
 * @fires InviteTransaction#canceled
 * @fires InviteTransaction#failed
 * @fires InviteTransaction#rejected
 */
function InviteTransaction(userAgent) {
  var self = this;
  EventEmitter.call(this);

  var deferred = util.defer();
  var dialog = null;
  var state = C.STATE_PENDING;

  // All of the logic for finalizing the InviteTransaction and emitting the
  // events lives in the Promise. Accepting, canceling, and rejecting merely
  // reject or resolve the promise, thereby triggering the following logic.
  //
  // This is also how subclasses extend InviteTransaction: for example, if the
  // signaling channel receives a cancel or reject, it updates its state and
  // rejects the Promise.
  var promise = deferred.promise.then(function(_dialog) {
    dialog = _dialog;
    self.emit('accepted', dialog);

    return dialog;
  }, function(reason) {
    var event = state === C.STATE_PENDING ? 'failed' : state;
    self.emit(event, reason);
    throw reason;
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deferred: {
      value: deferred
    },
    _promise: {
      value: promise
    },
    _state: {
      get: function() {
        return state;
      },
      set: function(_state) {
       state = _state;
     }
    },
    dialog: {
      enumerable: true,
      get: function() {
        return dialog;
      }
    },
    isAccepted: {
      enumerable: true,
      get: function() {
        return state === C.STATE_ACCEPTED;
      }
    },
    isCanceled: {
      enumerable: true,
      get: function() {
        return state === C.STATE_CANCELED;
      }
    },
    isFailed: {
      enumerable: true,
      get: function() {
        return state === C.STATE_FAILED;
      }
    },
    isPending: {
      enumerable: true,
      get: function() {
        return state === C.STATE_PENDING;
      }
    },
    isRejected: {
      enumerable: true,
      get: function() {
        return state === C.STATE_REJECTED;
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return state;
      }
    },
    userAgent: {
      enumerable: true,
      value: userAgent
    }
  });
  return this;
}

InviteTransaction.PENDING   = C.STATE_PENDING;
InviteTransaction.ACCEPTED  = C.STATE_ACCEPTED;
InviteTransaction.REJECTED  = C.STATE_REJECTED;
InviteTransaction.CANCELED  = C.STATE_CANCELED;
InviteTransaction.FAILED    = C.STATE_FAILED;

inherits(InviteTransaction, EventEmitter);

InviteTransaction.prototype._setState = function _setState(state) {
  // A new state is required
  if (!state || !state.length) {
    throw new Error('Parameter "state" is required');
  }

  // There are only a limited number of valid states
  if (C.FINAL_STATES.indexOf(state) === -1) {
    throw new Error('InviteTransaction states must be one of: [' + C.FINAL_STATES.join(', ') + ']');
  }

  // State is permanent, once set
  if (this.state === C.STATE_PENDING) {
    this._state = state;
    return true;
  }

  return false;
};

InviteTransaction.prototype._setAccepted = function _setAccepted() {
  return this._setState(C.STATE_ACCEPTED);
};
InviteTransaction.prototype._setCanceled = function _setCanceled() {
  return this._setState(C.STATE_CANCELED);
};
InviteTransaction.prototype._setFailed = function _setFailed() {
  return this._setState(C.STATE_FAILED);
};
InviteTransaction.prototype._setRejected = function _setRejected() {
  return this._setState(C.STATE_REJECTED);
};

InviteTransaction.prototype.then = function then(onResolve, onReject) {
  return this._promise.then(onResolve, onReject);
};

Object.freeze(InviteTransaction.prototype);

module.exports = InviteTransaction;

},{"../../util":31,"events":44,"util":48}],19:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');
var util = require('../../util');

/**
 * Construct an {@link InviteClientTransaction}.
 * @class
 * @classdesc An {@link InviteClientTransaction} is an
 *   {@link InviteTransaction} addressed from a {@link UserAgent}.
 * @param {UserAgent} userAgent - the sender of the
 *   {@link InviteClientTransaction}
 * @param {string} to - the recipient of the {@link InviteClientTransaction}
 * @param {object} [options]
 * @property {?LocalMedia} media - the {@link LocalMedia} to use
 * @property {Array<string>} to - the recipient(s) of the
 *   {@link InviteClientTransaction}
 * @augments InviteTransaction
 */
function InviteClientTransaction(userAgent, to, options) {
  options = util.withDefaults({ }, options);

  InviteTransaction.call(this, userAgent, to, options);

  var media = options.localMedia;
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _media: {
      set: function(_media) {
        media = _media;
      }
    },
    media: {
      enumerable: true,
      get: function() {
        return media;
      }
    },
    to: {
      enumerable: true,
      value: to
    }
  });
}

inherits(InviteClientTransaction, InviteTransaction);

/**
 * Cancel the {@link InviteClientTransaction}.
 * @param {?boolean} [failed=false] - whether the
 *   {@link InviteClientTransaction} is being canceled due to a failure (and
 *   hance the state should be updated to "failed")
 * @fires InviteTransaction#canceled
 * @returns {this}
 */
InviteClientTransaction.prototype.cancel = function cancel(failed) {
  var setStatus = failed ? this._setFailed : this._setCanceled;
  if (!setStatus.call(this)) {
    throw new Error('InviteClientTransaction already in state: ' + this._state);
  }
  this._deferred.reject(this);
  return this;
};

module.exports = InviteClientTransaction;

},{"../../util":31,"./":18,"util":48}],20:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var InviteTransaction = require('./');

/**
 * Construct an {@link InviteServerTransaction}.
 * @class
 * @classdesc An {@link InviteServerTransaction} is an
 *   {@link InviteTransaction} addressed to a {@link UserAgent}.
 * @param {UserAgent} userAgent - the recipient of the
 *   {@link InviteServerTransaction}
 * @param {string} from - the sender of the {@link InviteServerTransaction}
 * @param {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID, if accepted
 * @param {string} callSid - the {@link Dialog}'s call SID, if accepted
 * @param {string} participantSid - the {@link Participant} SID
 * @param {string} cookie - the cookie, for joining the {@link InviteServerTransaction}
 *   to the corresponding {@link InviteClientTransaction}
 * @property {string} from - the sender of the {@link InviteServerTransaction}
 * @property {string} callSid - the {@link Dialog}'s call SID, if accepted
 * @property {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID, if accepted
 * @param {string} cookie - the cookie, for joining the {@link InviteServerTransaction}
 *   to the corresponding {@link InviteClientTransaction}
 * @param {string} from - the sender of the {@link InviteServerTransaction}
 * @param {string} key - a key for joining the {@link InviteServerTransaction} to
 *   corresponding {@link InviteServerTransaction}s
 * @param {string} participantSid - the {@link Participant} SID
 * @augments InviteTransaction
 */
function InviteServerTransaction(userAgent, from, conversationSid, callSid, participantSid, cookie) {
  InviteTransaction.call(this, userAgent);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    callSid: {
      enumerable: true,
      value: callSid
    },
    conversationSid: {
      enumerable: true,
      value: conversationSid
    },
    cookie: {
      enumerable: true,
      value: cookie
    },
    from: {
      enumerable: true,
      value: from
    },
    key: {
      enumerable: true,
      value: conversationSid + ' ' + participantSid
    },
    participantSid: {
      value: participantSid
    }
  });
  return this;
}

inherits(InviteServerTransaction, InviteTransaction);

/**
 * Accept the {@link InviteServerTransaction}
 * @param {object} [options]
 * @fires InviteTransaction#accepted
 * @returns {Promise}
 */
InviteServerTransaction.prototype.accept = function accept() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self._setAccepted()) {
      self._deferred.resolve(self.dialog);
      resolve();
    } else {
      reject(new Error('InviteServerTransaction already in state: ' + self._state));
    }
  });
};

/**
 * Reject the {@link InviteServerTransaction}.
 * @fires InviteTransaction#rejected
 * @returns {this}
 */
InviteServerTransaction.prototype.reject = function reject() {
  if (!this._setRejected()) {
    throw new Error('InviteServerTransaction already in state: ' + this._state);
  }
  this._deferred.reject(this);
  return this;
};

module.exports = InviteServerTransaction;

},{"./":18,"util":48}],21:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var InviteClientTransaction = require('./inviteclienttransaction');
var C = require('../../util/constants');
var SIPJSDialog = require('../sipjsdialog');
var headers = require('../../util/constants').headers;
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = require('../../media/localmedia');

/**
 * Construct a {@link SIPJSInviteClientTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteClientTransaction} is an
 *   {@link InviteClientTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the sender of the
 *   {@link SIPJSInviteClientTransaction}
 * @param {Array<string>} to - the recipient(s) of the
 *   {@link SIPJSInviteClientTransaction}
 * @property {?object} session - the SIP.js Session object
 * @augments InviteClientTransaction
 */
function SIPJSInviteClientTransaction(userAgent, to, options) {
  if (!(this instanceof SIPJSInviteClientTransaction)) {
    return new SIPJSInviteClientTransaction(userAgent, to, options);
  }
  var self = this;

  InviteClientTransaction.call(this, userAgent);

  options = util.withDefaults(options, {
    stunServers: userAgent.stunServers,
    turnServers: userAgent.turnServers
  });

  var isMultiInvite = to.length > 1;
  var isRejected = false;
  var session = null;

  // Get LocalMedia, if necessary, then ask SIP.js to place an INVITE. If the
  // outgoing Session is accepted, resolve the promise with a SIPJSDialog.
  userAgent.connect().then(function() {
    return LocalMedia.getLocalMedia(options);
  }).then(function(localMedia) {
    self._media = localMedia;

    if (self.isCanceled) {
      return self._deferred.reject(self);
    }

    session = startSession(userAgent, to, options, localMedia);

    var inviteTime = Date.now();
    var _180Time = null;
    session.on('progress', function(response) {
      if (response.statusCode === 180) {
        _180Time = Date.now();
      }
    });

    session.once('accepted', function(response) {
      var callSid = response.getHeader('X-Twilio-CallSid');
      var peerConnection = session.mediaHandler.peerConnection;
      var remoteMedia = new Media();
      session.mediaHandler.on('addStream', function addStream(event) {
        remoteMedia._addRemoteStream(event.stream);
      });
      var inviteTo180 = _180Time ? _180Time - inviteTime : null;
      var conversationSid = util.parseConversationSIDFromContactHeader(
        response.getHeader('Contact'));
      var participantInfo = response.getHeader(headers.X_TWILIO_PARTICIPANTSID);
      participantInfo = participantInfo ? participantInfo.split(';') : null;
      var participantSid = participantInfo ? participantInfo[0] : null;
      var dialog = new SIPJSDialog(userAgent, to[0], conversationSid, callSid, localMedia, remoteMedia, peerConnection, participantSid, session, inviteTo180);
      self._deferred.resolve(dialog);
    });

    session.once('rejected', function(res) {
      if (isMultiInvite) {
        isRejected = true;
        return;
      }

      if (res && res.status_code === 600 && self._setRejected()) {
        self._deferred.reject(self);
      } else if (self._setFailed()) {
        self._deferred.reject(self);
      }
    });

    session.once('failed', function() {
      if (isRejected) { return; }

      if (self._setFailed()) {
        self._deferred.reject(self);
      }
    });
  }).then(null, function() {
    if (self._setFailed()) {
      self._deferred.reject(self);
    }
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _cookie: {
      value: options.cookie
    },
    session: {
      enumerable: true,
      get: function() {
        return session;
      }
    }
  });

  return this;
}

inherits(SIPJSInviteClientTransaction, InviteClientTransaction);

function startSession(userAgent, to, options, localMedia) {
  var token = userAgent.accessManager.token;

  var participants = to.slice();
  var target = participants.shift();

  var extraHeaders = [
    util.selectTokenHeader(token)    + ': ' + token,
    C.headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_CLIENTVERSION + ': ' + C.CLIENT_VERSION
  ];

  if (participants.length) {
    var participantsHeader = participants.join(',') + ';cookie=' + options.cookie;
    extraHeaders.push(C.headers.X_TWILIO_PARTICIPANTS + ': ' + participantsHeader);
  }

  extraHeaders.push('Session-Expires: 120');

  var mediaStreams = [];
  localMedia.mediaStreams.forEach(function(mediaStream) {
    mediaStreams.push(mediaStream);
  });

  return userAgent._ua.invite(target, {
    extraHeaders: extraHeaders,
    inviteWithoutSdp: options.inviteWithoutSdp,
    media: { stream: mediaStreams[0] },
    RTCConstraints: C.DEFAULT_OFFER_OPTIONS,
    stunServers: options.stunServers,
    turnServers: options.turnServers
  });
}

SIPJSInviteClientTransaction.prototype.cancel = function cancel(failed) {
  var setStatus = failed ? this._setFailed : this._setCanceled;
  if (!setStatus.call(this)) {
    throw new Error('SIPJSInviteClientTransaction already in state: ' + this._state);
  }

  this._deferred.reject(this);

  if (this.session) {
    this.session.terminate();
  }

  return this;
};

Object.freeze(SIPJSInviteClientTransaction.prototype);

module.exports = SIPJSInviteClientTransaction;

},{"../../media":5,"../../media/localmedia":6,"../../util":31,"../../util/constants":30,"../sipjsdialog":24,"./inviteclienttransaction":19,"util":48}],22:[function(require,module,exports){
'use strict';

var E = require('../../util/constants').twilioErrors;
var headers = require('../../util/constants').headers;
var inherits = require('util').inherits;
var InviteServerTransaction = require('./inviteservertransaction');
var SIPJSDialog = require('../sipjsdialog');
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = require('../../media/localmedia');

/**
 * Construct a {@link SIPJSInviteServerTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteServerTransactions} is an
 *   {@link InviteServerTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the recipient of the
 *   {@link SIPJSInviteServerTransaction}
 * @param {string} from - the sender of the
 *   {@link SIPJSInviteServerTransaction}
 * @param {string} conversationSid - the {@link SIPJSDialog}'s {@link Conversation} SID, if accepted
 * @param {string} callSid - the {@link SIPJSDialog}'s call SID, if accepted
 * @param {object} session - the SIP.js Session object
 * @property {object} session the SIP.js Session object
 * @augments InviteServerTransaction
 */
function SIPJSInviteServerTransaction(userAgent, session) {
  if (!(this instanceof SIPJSInviteServerTransaction)) {
    return new SIPJSInviteServerTransaction(userAgent, session);
  }

  var request = session.request;
  var from = request.from.uri.toString();
  var conversationSid = util.parseConversationSIDFromContactHeader(request.getHeader('Contact'));
  var callSid = request.getHeader(headers.X_TWILIO_CALLSID);

  var participantInfo = request.getHeader(headers.X_TWILIO_PARTICIPANTSID);
  participantInfo = participantInfo ? participantInfo.split(';') : null;
  var participantSid = participantInfo ? participantInfo[0] : null;

  var cookieRegex = /^cookie=([^\s]+)/i;
  var cookie = participantInfo
    && participantInfo[1]
    && cookieRegex.test(participantInfo[1])
    && participantInfo[1].match(cookieRegex)[1];

  InviteServerTransaction.call(this, userAgent, from, conversationSid, callSid, participantSid, cookie);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    session: {
      enumerable: true,
      value: session
    }
  });

  var self = this;
  session.once('cancel', function() {
    if (self._setCanceled()) {
      var error = E.CONVERSATION_JOIN_FAILED.clone('Incoming Invite was canceled by the sender');
      self._deferred.reject(error);
    }
  });
  session.once('failed', function(response) {
    if (self._setFailed()) {
      var message = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw') || 'An unknown error occurred';
      var error = E.CONVERSATION_JOIN_FAILED.clone(message);
      self._deferred.reject(error);
    }
  });

  return this;
}

inherits(SIPJSInviteServerTransaction, InviteServerTransaction);

SIPJSInviteServerTransaction.prototype.accept = function accept(options) {
  options = util.withDefaults({ media: { } }, options);

  var getLocalMedia = LocalMedia.getLocalMedia(options);
  var localMedia = null;
  var self = this;
  var session = self.session;

  var supportedOptions = session.request.parseHeader('Supported') || [];
  if (supportedOptions.indexOf('timer') >= 0) {
    options.extraHeaders = ['Session-Expires: 120;refresher=uas', 'Require: timer'];
  }

  return getLocalMedia.then(function(_localMedia) {
    localMedia = _localMedia;

    var mediaStreams = [];
    localMedia.mediaStreams.forEach(function(mediaStream) {
      mediaStreams.push(mediaStream);
    });

    options.media.stream = mediaStreams[0];

    return util.promiseFromEvents(session.accept.bind(session, options), session, 'accepted', 'failed');
  }).then(function() {
    var peerConnection = session.mediaHandler.peerConnection;
    var remoteMedia = new Media();

    session.mediaHandler.on('addStream', function addStream(event) {
      if (event) { remoteMedia._addRemoteStream(event.stream); }
    });

    var remoteStreams = peerConnection.getRemoteStreams() || [];
    remoteStreams.forEach(remoteMedia._addRemoteStream, remoteMedia);

    function createDialog() {
      setTimeout(function setAccepted() {
        if (self._setAccepted()) {
          var dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localMedia, remoteMedia, peerConnection, self.participantSid, self.session);
          self._deferred.resolve(dialog);
        } else {
          throw new Error('SIPJSInviteServerTransaction already in state: ' + self._state);
        }
      });
    }

    // NOTE(mroberts): OK, here is the fun part: we need to check if there
    // was an offer; if so, we need to check if there is an answer. In the
    // INVITE without SDP case, we have to wait for the ACK. Unfortunately,
    // we don't have a great way of catching this event yet.
    if (!session.hasOffer) {
      createDialog();
    } else if (session.hasOffer && session.hasAnswer) {
      // FIXME(mroberts): Not sure about this.
      createDialog();
    } else if (session.hasOffer && !session.hasAnswer) {
      session.mediaHandler.once('addStream', createDialog);
    }

    return self._promise;
  });
};

SIPJSInviteServerTransaction.prototype.reject = function reject() {
  if (!this._setRejected()) {
    throw new Error('SIPJSInviteServerTransaction already in state: ' + this._state);
  }

  this._deferred.reject(this);

  if (this.session) {
    this.session.reject({ statusCode: 600 });
  }

  return this;
};

Object.freeze(SIPJSInviteServerTransaction.prototype);

module.exports = SIPJSInviteServerTransaction;

},{"../../media":5,"../../media/localmedia":6,"../../util":31,"../../util/constants":30,"../sipjsdialog":24,"./inviteservertransaction":20,"util":48}],23:[function(require,module,exports){
'use strict';

var validation = require('../util/validation');

/**
 * JSON conformant to the application/rtc-auth-info+json content-type.
 * @typedef RTCAuthInfo
 * @type {object}
 * @property {RTCAuthInfoConfig} config
 * @property {?Array<RTCAuthInfoWarning>} warnings
 */

/**
 * {@link RTCAuthInfo} includes configuration in the form of
 * {@link RTCAuthInfoConfig}
 * @typedef RTCAuthInfoConfig
 * @type {object}
 */

/**
 * {@link RTCAuthInfo} includes warnings in the event that something went
 * wrong when fetching the {@link RTCAuthInfoConfiguration}. These warnings
 * come in the form of {@link RTCAuthInfoWarning}s.
 * @typedef RTCAuthInfoWarning
 * @type {object}
 * @property {string} message
 * @property {number} code
 */

/**
 * Parse {@link RTCAuthInfo}.
 * @param {string|Object} notification
 * @returns {FullNotification|PartialNotification}
 * @throws {Error}
 */
function parseRTCAuthInfo(stringOrJSON) {
  var rtcAuthInfo = validation.parseStringOrJSON(stringOrJSON);

  /* eslint dot-notation:0 */
  var config = validateRTCAuthInfoConfig(rtcAuthInfo['config']);
  var warnings = validateRTCAuthInfoWarnings(rtcAuthInfo['warnings']);

  var validated = {
    config: config
  };

  if (warnings.length) {
    validated.warnings = warnings;
  }

  return validated;
}

/**
 * Validate {@link RTCAuthInfoConfig} or return null.
 * @param {*} config
 * @returns {?RTCAuthInfoConfig}
 * @throws {Error}
 */
function validateRTCAuthInfoConfig(config) {
  return validation.validateObject('Config', config);
}

/**
 * Validate {@link RTCAuthInfoWarning}s. Invalid {@link RTCAuthInfoWarning}s will be
 * filtered.
 * @param {*} warnings
 * @returns {?Array<RTCAuthInfoWarning>}
 */
function validateRTCAuthInfoWarnings(warnings) {
  return validation.validateOr(validation.validateArray.bind(null, 'Warnings', warnings), [])
    .map(validateRTCAuthInfoWarningOrNull)
    .filter(validation.isNotNull);
}

/**
 * Validate an {@link RTCAuthInfoWarning}.
 * @param {*} warning
 * @returns {RTCAuthInfoWarning}
 * @throws {Error}
 */
function validateRTCAuthInfoWarning(warning) {
  validation.validateObject('Warning', warning);
  /* eslint dot-notation:0 */
  validation.validateString('Warning message', warning['message']);
  var validated = {
    message: warning['message']
  };
  if ('code' in warning) {
    validation.validateInteger('Warning code', warning['code']);
    validated.code = warning['code'];
  }
  return validated;
}

function validateRTCAuthInfoWarningOrNull(warning) {
  return validation.validateOr(validateRTCAuthInfoWarning.bind(null, warning), null);
}

module.exports.parseRTCAuthInfo = parseRTCAuthInfo;

},{"../util/validation":37}],24:[function(require,module,exports){
'use strict';

var ConversationInfo = require('./conversation-info');
var Dialog = require('./dialog');
var inherits = require('util').inherits;
var C = require('../util/constants');
var E = C.twilioErrors;
var SIPJS = require('sip.js');
var util = require('../util');

/**
 * Construct a {@link SIPJSDialog}.
 * @class
 * @classdesc A {@link SIPJSDialog} is a {@link Dialog} powered by the SIP.js
 *   library.
 * @augments Dialog
 * @param {SIPJSUserAgent} userAgent - the {@link SIPJSUserAgent} that owns
 *   this {@link SIPJSDialog}
 * @param {string} remote - the remote participant in the {@link SIPJSDialog}
 * @param {string} conversationSid - the {@link Dialog}'s conversation SID
 * @param {string} callSid - the {@link Dialog}'s call SID
 * @param {LocalMedia} localMedia - the {@link LocalMedia}
 * @param {Media} remoteMedia - the remote {@link Media}
 * @param {PeerConnection} peerConnection - the PeerConnection
 * @param {string} participantSid - the {@link SIPJSUserAgent}'s {@link Participant} SID
 * @param {object} session - the SIP.js Session object
 * @param {?number} inviteTo180 - the time between INVITE and 180 in milliseconds
 * @property {?number} inviteTo180 - the time between INVITE and 180 in milliseconds
 * @property {Session} session - the SIP.js Session object
 * @fires Dialog#ended
 * @fires Dialog#notification
 * @fires Dialog#statistics
 */
function SIPJSDialog(userAgent, remote, conversationSid, callSid, localStream,
    remoteStream, peerConnection, participantSid, session, inviteTo180)
{
  if (!(this instanceof SIPJSDialog)) {
    return new SIPJSDialog(userAgent, remote, conversationSid, callSid,
      localStream, remoteStream, peerConnection, participantSid, session, inviteTo180);
  }
  var self = this;
  Dialog.call(this, userAgent, remote, conversationSid, callSid, localStream,
    remoteStream, peerConnection, participantSid);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    inviteTo180: {
      enumerable: true,
      value: inviteTo180
    },
    session: {
      enumerable: true,
      value: session
    }
  });

  peerConnection.oniceconnectionstatechange = function() {
    switch (peerConnection.iceConnectionState) {
      case 'failed':
        return self.emit('failed', E.ICE_CONNECT_FAILED);
      case 'disconnected':
        return self.emit('disconnected', E.ICE_DISCONNECTED);
    }
  };

  session.on('notify', function onNotify(request) {
    if (request.getHeader('Content-Type') !== 'application/conversation-info+json') {
      return;
    }
    var notification;
    try {
      notification = ConversationInfo.parseNotification(request.body);
    } catch (error) {
      // TODO(mroberts): Log this.
      return;
    }
    self.queue('notification', notification);
  });

  session.once('failed', function() {
    self._ended = true;
    self.emit('failed', self);
  });

  session.once('bye', function() {
    self._ended = true;
    self.emit('ended', self);
  });

  session.mediaHandler.on('getDescription', function() {
    self.remoteMedia._refreshTracks();
  });

  session.mediaHandler.on('notification', this.queue.bind(this, 'notification'));
  session.mediaHandler.dequeue('notification');

  return this;
}

inherits(SIPJSDialog, Dialog);

SIPJSDialog.prototype.end = function end() {
  if (this.ended) {
    return this;
  }
  this.session.bye();
  this._ended = true;
  this.emit('ended', this);
  return this;
};

SIPJSDialog.prototype._reinvite = function _reinvite() {
  // FIXME(mroberts): Until we have a proper API for overriding RTCOfferOptions.
  this.session.mediaHandler.RTCConstraints = C.DEFAULT_OFFER_OPTIONS;
  this.session.sendReinvite();
};

/**
 * @returns {Promise<SIPJSDialog>} when received 202 Notify for REFER.
 */
SIPJSDialog.prototype._refer = function _refer(target) {
  if (typeof target !== 'string') {
    throw new Error('Target is not a string');
  }

  var self = this;
  var deferred = util.defer();

  var extraHeaders = [
    'Contact: ' + this.session.contact,
    'Allow: ' + SIPJS.Utils.getAllowedMethods(this.session.ua),
    'Refer-To: ' + this.session.ua.normalizeTarget(target),
    'Allow-Events: refer',
    'Event: refer;id=' + Math.floor((Math.random() * 1000) + 1)
  ];

  self.session.sendRequest('REFER', {
    extraHeaders: extraHeaders,
    receiveResponse: function receiveResponse(response) {
      if (response.status_code === 202) {
        deferred.resolve(self);
      } else {
        deferred.reject(response);
      }
    }
  });

  return deferred.promise;
};

SIPJSDialog.prototype._publish = function _publish(payload) {
  var self = this;
  return new Promise(function(resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve(self);
          break;
        default:
          reject(response);
      }
    }
    self.session.sendRequest('PUBLISH', {
      body: JSON.stringify(payload),
      extraHeaders: [
        'Content-Type: application/conversation-info+json',
        'Event: conversation'
      ],
      receiveResponse: receiveResponse
    });
  });
};

Object.freeze(SIPJSDialog.prototype);

module.exports = SIPJSDialog;

},{"../util":31,"../util/constants":30,"./conversation-info":16,"./dialog":17,"sip.js":88,"util":48}],25:[function(require,module,exports){
'use strict';

var C = require('lib/util/constants');
var ConversationInfo = require('./conversation-info');
var QueueingEventEmitter = require('lib/queueingeventemitter');
var inherits = require('util').inherits;
var multipart = require('lib/util/multipart');
var SIP = require('sip.js');
var util = require('../util');

function SIPJSMediaHandler(session, options) {
  if (!(this instanceof SIPJSMediaHandler)) {
    return new SIPJSMediaHandler(session, options);
  }
  options = options || {};

  QueueingEventEmitter.call(this);

  var iceGatheringTimer = null;
  var localMedia = null;
  var peerConnection;
  var ready = true;

  // NOTE(mroberts): SIP.js currently relies on PeerConnection signalingState
  // to detect whether it has a local or remote offer. A more robust solution
  // may be to track this ourselves. See
  //
  //   * https://code.google.com/p/webrtc/issues/detail?id=4996
  //   * https://code.google.com/p/webrtc/issues/detail?id=5018
  //
  var signalingState = 'stable';

  Object.defineProperties(this, {
    _iceGathering: {
      value: util.defer()
    },
    _iceGatheringTimer: {
      get: function() {
        return iceGatheringTimer;
      },
      set: function(_iceGatheringTimer) {
        iceGatheringTimer = _iceGatheringTimer;
      }
    },
    _ready: {
      get: function() {
        return ready;
      },
      set: function(_ready) {
        ready = _ready;
      }
    },
    _signalingState: {
      get: function() {
        return signalingState;
      },
      set: function(_signalingState) {
        signalingState = _signalingState;
      }
    },
    localMedia: {
      enumerable: true,
      get: function() {
        return localMedia;
      },
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    peerConnection: {
      enumerable: true,
      get: function() {
        return peerConnection;
      }
    }
  });
  peerConnection = this._createPeerConnection(session, options);
}

inherits(SIPJSMediaHandler, QueueingEventEmitter);

SIPJSMediaHandler.defaultFactory = function defaultFactory(session, options) {
  return new SIPJSMediaHandler(session, options);
};

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

SIPJSMediaHandler.prototype._createPeerConnection = function _createPeerConnection(session, options) {
  var self = this;

  var config = session.ua.configuration || {};
  var stunServers = options.stunServers || config.stunServers || [];
  var turnServers = options.turnServers || config.turnServers || [];
  var servers = [];

  // A note from SIP.js:
  //
  //     Change 'url' to 'urls' whenever this issue is solved:
  //     https://code.google.com/p/webrtc/issues/detail?id=2096
  //
  [].concat(stunServers).forEach(function(server) {
    servers.push({ url: server });
  });

  turnServers.forEach(function(server) {
    server.urls.forEach(function(url) {
      servers.push({
        url: url,
        username: server.username,
        credential: server.password
      });
    });
  });

  function startIceGatheringTimer() {
    if (!self._iceGatheringTimer) {
      self._iceGatheringTimer = setTimeout(function() {
        self._iceGathering.resolve(self);
      }, config.iceCheckingTimeout);
    }
  }

  this._iceGathering.promise.then(function iceGatheringCompleted(peerConnection) {
    self.emit('iceGatheringComplete', peerConnection);
    if (self._iceGatheringTimer) {
      clearTimeout(self._iceGatheringTimer);
      self._iceGatheringTimer = null;
    }
  });

  var peerConnection = new SIP.WebRTC.RTCPeerConnection({
    iceServers: servers
  });

  peerConnection.onaddstream = function onaddstream(event) {
    self.emit('addStream', event);
  };

  peerConnection.onicecandidate = function onicecandidate(event) {
    self.emit('iceCandidate', event);
    if (event.candidate) {
      startIceGatheringTimer();
    } else {
      self._iceGathering.resolve(this);
    }
  };

  peerConnection.oniceconnectionstatechange = function oniceconnectionstatechange() {
    var stateEvent;
    switch (this.iceConnectionState) {
      case 'new':
        stateEvent = 'iceConnection';
        break;
      case 'checking':
        stateEvent = 'iceConnectionChecking';
        break;
      case 'connected':
        stateEvent = 'iceConnectionConnected';
        break;
      case 'completed':
        stateEvent = 'iceConnectionCompleted';
        break;
      case 'failed':
        stateEvent = 'iceConnectionFailed';
        break;
      case 'disconnected':
        stateEvent = 'iceConnectionDisconnected';
        break;
      case 'closed':
        stateEvent = 'iceConnectionClosed';
        break;
    }
    self.emit(stateEvent, this);
  };

  return peerConnection;
};

SIPJSMediaHandler.prototype.close = function close() {
  if (this.peerConnection.state !== 'closed') {
    this.peerConnection.close();
  }
};

SIPJSMediaHandler.prototype.getDescription = function getDescription(options) {
  var self = this;

  if (!this.localMedia && options.stream) {
    this.peerConnection.addStream(options.stream);
    this.localMedia = options.stream;
  }

  this._ready = false;

  return new Promise(function createOfferOrAnswer(resolve, reject) {
    if (self._signalingState === 'stable') {
      self.peerConnection.createOffer(resolve, reject, C.DEFAULT_OFFER_OPTIONS);
    } else {
      self.peerConnection.createAnswer(resolve, reject);
    }
  }).then(function createOfferOrAnswerSucceeded(description) {
    return new Promise(function(resolve, reject) {
      self.peerConnection.setLocalDescription(description, resolve, reject);
    });
  }).then(function setLocalDescriptionSucceeded() {
    self._signalingState = self._signalingState === 'stable'
      ? 'have-local-offer'
      : 'stable';

    // NOTE(mroberts): Wait for ICE candidates to have been gathered. In the
    // future, we will support Trickle ICE.
    return self._iceGathering.promise;
  }).then(function iceCandidatesGathered() {
    var sdp = self.peerConnection.localDescription.sdp;

    if (typeof mozRTCPeerConnection !== 'undefined') {
      sdp = copyMediaLevelMsidIntoSourceLevelAttribute(sdp);
    }

    sdp = SIP.Hacks.Chrome.needsExplicitlyInactiveSDP(sdp);
    sdp = SIP.Hacks.AllBrowsers.unmaskDtls(sdp);
    sdp = SIP.Hacks.Firefox.hasIncompatibleCLineWithSomeSIPEndpoints(sdp);
    sdp = SIP.Hacks.Firefox.hasMissingCLineInSDP(sdp);

    self.emit('getDescription', {
      type: self.peerConnection.localDescription.type,
      sdp: sdp
    });

    self._ready = true;

    return {
      body: sdp,
      extraHeaders: [
        'Content-Type: application/sdp'
      ]
    };
  }).catch(function getDescriptionFailed(error) {
    self._ready = true;
    throw new SIP.Exceptions.GetDescriptionError(error);
  });
};

SIPJSMediaHandler.prototype.getLocalStreams = function getLocalStreams() {
  return this.peerConnection.getLocalStreams();
};

SIPJSMediaHandler.prototype.isReady = function isReady() {
  return this._ready;
};

SIPJSMediaHandler.prototype.getRemoteStreams = function getRemoteStreams() {
  return this.peerConnection.getRemoteStreams();
};

SIPJSMediaHandler.prototype.hasDescription = function hasDescription(message) {
  var conversationInfo = getConversationInfo(message);
  var hasSDP = !!getSDP(message);
  if (conversationInfo && !hasSDP) {
    // NOTE(mroberts): setDescription is not going to be called, so go ahead
    // and emit the Conversation Info.
    this.queue('notification', conversationInfo);
  }
  return hasSDP;
};

SIPJSMediaHandler.prototype.mute = function mute() {
  // Do nothing.
};

SIPJSMediaHandler.prototype.render = function render() {
  // Do nothing.
};

SIPJSMediaHandler.prototype.setDescription = function setDescription(message) {
  var conversationInfo = getConversationInfo(message);
  if (conversationInfo) {
    this.queue('notification', conversationInfo);
  }

  var sdp = getSDP(message);

  sdp = SIP.Hacks.Firefox.cannotHandleExtraWhitespace(sdp);
  sdp = SIP.Hacks.AllBrowsers.maskDtls(sdp);

  var description = {
    type: this._signalingState === 'stable' ? 'offer' : 'answer',
    sdp: sdp
  };
  this.emit('setDescription', description);

  var self = this;
  return new Promise(function setRemoteDescription(resolve, reject) {
    self.peerConnection.setRemoteDescription(
      new SIP.WebRTC.RTCSessionDescription(description), resolve, reject);
  }).then(function setRemoteDescriptionSucceeded() {
    self._signalingState = self._signalingState === 'stable'
      ? 'have-remote-offer'
      : 'stable';
  });
};

SIPJSMediaHandler.prototype.unmute = function unmute() {
  // Do nothing.
};

function getConversationInfo(message) {
  var contentType = message.getHeader('Content-Type');
  var notification;
  if (!contentType) {
    return null;
  } else if (contentType === 'application/conversation-info+json') {
    notification = message.body;
  } else if (/^multipart\//.test(contentType)) {
    notification = multipart.getConversationInfo(multipart.parse(contentType, message.body));
  }
  if (notification) {
    try {
      return ConversationInfo.parseNotification(notification);
    } catch (error) {
      // Do nothing
    }
  }
  return null;
}

function getSDP(message) {
  var contentType = message.getHeader('Content-Type');
  if (!contentType) {
    return null;
  } else if (contentType === 'application/sdp') {
    return message.body;
  } else if (/^multipart\//.test(contentType)) {
    return multipart.getSDP(multipart.parse(contentType, message.body));
  }
  return null;
}

/**
 * Get the MSID out of a media level.
 * @param {string} mediaLevel
 * @returns {?Array<String>}
 */
function getMsidFromMediaLevel(mediaLevel) {
  var match = mediaLevel.match(/a=msid: *([^ ]+) +([^ ]+) *\r\n/);
  if (match) {
    return [match[1], match[2]];
  }
  return null;
}

/**
 * Firefox specifies media-level MSIDs, but Chrome expects source-level MSIDs
 * in order to populate MediaStream.id and MediaStreamTrack.id; therefore, we
 * need to copy the media-level MSIDs into source-level attributes.
 * @param {string} sdp
 * @returns {string}
 */
function copyMediaLevelMsidIntoSourceLevelAttribute(sdp) {
  var parts = sdp.split('\r\nm=');
  var sourceLevel = parts[0];
  var mediaLevels = parts.slice(1).map(function(mediaLevel) {
    mediaLevel = 'm=' + mediaLevel;

    // Get the MSID out of the media-level.
    var msid = getMsidFromMediaLevel(mediaLevel);
    if (!msid) {
      return mediaLevel.replace(/\r\n$/, '');
    }

    if (!mediaLevel.match(/\r\n$/)) {
      mediaLevel += '\r\n';
    }

    // Capture the SSRCs in order, filtering out any duplicates.
    var matches = mediaLevel.match(/a=ssrc: *[^ ]*.*\r\n/g) || [];

    mediaLevel = mediaLevel.replace(/\r\n$/, '');

    var uniqueSsrcs = {};
    /* eslint camelcase:0 */
    matches.forEach(function(a_ssrc) {
      var match = a_ssrc.match(/a=ssrc: *([^ ]*).*\r\n/);
      if (match) {
        var ssrc = match[1];
        // Add source-level MSID attributes.
        if (!uniqueSsrcs[ssrc]) {
          uniqueSsrcs[ssrc] = ssrc;
          mediaLevel += '\r\na=ssrc:' + ssrc + ' msid:' + msid.join(' ');
        }
      }
    });

    return mediaLevel;
  });
  return sourceLevel + '\r\n' + mediaLevels.join('\r\n') + '\r\n';
}

module.exports = SIPJSMediaHandler;

},{"../util":31,"./conversation-info":16,"lib/queueingeventemitter":49,"lib/util/constants":50,"lib/util/multipart":51,"sip.js":88,"util":48}],26:[function(require,module,exports){
'use strict';

var constants = require('../util/constants');
var inherits = require('util').inherits;
var RTCAuthInfo = require('./rtc-auth-info');
var SIPJS = require('sip.js');
var SIPJSInviteClientTransaction = require('./invitetransaction/sipjsinviteclienttransaction.js');
var SIPJSInviteServerTransaction = require('./invitetransaction/sipjsinviteservertransaction');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var UserAgent = require('./useragent');
var util = require('../util');

/**
 * Constructs a {@link SIPJSUserAgent}.
 * @class
 * @classdesc {@link SIPJSUserAgent} wraps SIP.js's own UA object in a
 *   {@link UserAgent} interface.
 * @param {AccessManager} accessManager
 * @param {object} [options]
 * @augments {UserAgent}
 */
function SIPJSUserAgent(accessManager, options) {
  if (!(this instanceof SIPJSUserAgent)) {
    return new SIPJSUserAgent(accessManager, options);
  }

  /* eslint new-cap:0 */

  var accountSid = accessManager._tokenPayload.sub;
  var uri = util.makeSIPURI(accountSid, accessManager.identity);

  options = util.withDefaults(options, {
    inviteClientTransactionFactory: SIPJSInviteClientTransaction,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    registrarServer: constants.REGISTRAR_SERVER(accountSid),
    wsServer: constants.WS_SERVER(accountSid),
    uaFactory: SIPJS.UA
  });

  // Setup the SIP.js UA.
  var enableDebug = options.logLevel === 'debug';
  var extraSupported = options.useConversationEvents ? ['conversation-events'] : [];
  var useWssHack = /^wss:\/\//.test(options.wsServer);
  var UA = options.uaFactory;
  var ua = setupUA.call(this, new UA({
    autostart: false,
    log: {
      builtinEnabled: enableDebug
    },
    extraSupported: extraSupported,
    hackAllowUnregisteredOptionTags: true,
    keepAliveInterval: 30,
    mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
    register: false,
    registrarServer: options.registrarServer,
    traceSip: enableDebug,
    uri: uri,
    wsServers: options.wsServer,
    hackWssInTransport: useWssHack
  }));

  var stunServers = [];
  var turnServers = [];

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _ua: {
      value: ua
    },
    _stunServers: {
      set: function(_stunServers) {
        stunServers = _stunServers;
        util.overwriteArray(ua.configuration.stunServers, stunServers);
      }
    },
    _turnServers: {
      set: function(_turnServers) {
        turnServers = _turnServers;
        util.overwriteArray(ua.configuration.turnServers, turnServers);
      }
    },
    stunServers: {
      enumerable: true,
      get: function() {
        return stunServers;
      }
    },
    turnServers: {
      enumerable: true,
      get: function() {
        return turnServers;
      }
    }
  });

  UserAgent.call(this, accessManager, options);

  return this;
}

inherits(SIPJSUserAgent, UserAgent);

SIPJSUserAgent.prototype._register = function _register(token) {
  var self = this;

  function register() {
    var registerHeaders = util.makeRegisterHeaders(token);
    self._ua.register({
      extraHeaders: registerHeaders,
      closeWithHeaders: true
    });
  }

  return util.promiseFromEvents(register, this._ua, 'registered', 'registrationFailed').then(function(response) {
    var rtcAuthInfo;
    try {
      rtcAuthInfo = RTCAuthInfo.parseRTCAuthInfo(response.body);
    } catch (error) {
      // Do nothing.
    }
    if (rtcAuthInfo) {
      var networkTraversalService = rtcAuthInfo.config.networkTraversalService;
      if (networkTraversalService) {
        var iceServers = util.separateIceServers(networkTraversalService.ice_servers);
        self._stunServers = iceServers.stunServers;
        self._turnServers = iceServers.turnServers;
      }
    }
    return self;
  });
};

SIPJSUserAgent.prototype._unregister = function _unregister() {
  var self = this;
  var token = this.accessManager.token;

  function unregister() {
    var unregisterHeaders = util.makeRegisterHeaders(token);
    self._ua.unregister({ extraHeaders: unregisterHeaders });
  }

  return util.promiseFromEvents(unregister, this._ua, 'unregistered').then(function() {
    return self;
  });
};

SIPJSUserAgent.prototype._connect = function _connect() {
  var self = this;

  function startUA() {
    self._ua.start();
  }

  return util.promiseFromEvents(startUA, this._ua, 'connected', 'disconnected').then(function() {
    return self;
  });
};

SIPJSUserAgent.prototype._disconnect = function _disconnect() {
  this._ua.stop();
  this._ua.transport.disconnect();

  var deferred = util.defer();
  setTimeout(deferred.resolve.bind(null, this));
  return deferred.promise;
};

function setupUA(ua) {
  /* eslint no-invalid-this:0 */
  var self = this;
  ua.on('invite', function(session) {
    var inviteServerTransaction = new SIPJSInviteServerTransaction(self, session);
    self._handleInviteServerTransaction(inviteServerTransaction);
  });
  ua.on('keepAliveTimeout', function() {
    self.emit('keepAliveTimeout');
  });
  return ua;
}

Object.freeze(SIPJSUserAgent.prototype);

module.exports = SIPJSUserAgent;

},{"../util":31,"../util/constants":30,"./invitetransaction/sipjsinviteclienttransaction.js":21,"./invitetransaction/sipjsinviteservertransaction":22,"./rtc-auth-info":23,"./sipjsmediahandler":25,"./useragent":27,"sip.js":88,"util":48}],27:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var InviteClientTransaction = require('./invitetransaction/inviteclienttransaction');
var util = require('../util');

/**
 * Construct a {@link UserAgent}.
 * @class
 * @classdesc {@link UserAgent} is the interface through which the SDK
 *   interoperates with one or more signaling libraries.
 * @param {AccessManager} accessManager - an AccessManager
 * @param {object} [options]
 * @property {AccessManager} accessManager - the AccessManager
 * @property {Number} callTimeout - a custom time to wait before hanging up
 *   an outgoing call
 * @property {Set<Dialog>} dialogs - the set of {@link Dialog}s (accepted
 *   {@link InviteTransaction}s active on this {@link UserAgent}
 * @property {Set<InviteClientTransaction>} inviteClientTransactions - the set
 *   of {@link InviteClientTransaction}s active on this {@link UserAgent}
 * @property {Set<InviteServerTransaction>} inviteServerTransactions - the set
 *   of {@link InviteServerTransaction}s active on this {@link UserAgent}
 * @property {boolean} registered - whether or not this {@link UserAgent} is
 *   registered
 * @property {Array<object>} stunServers - the STUN servers to use
 * @property {string} token - the Access Token that the {@link UserAgent}
 *   registered with
 * @property {Array<object>} turnServers - the TURN servers to use
 * @fires UserAgent#invite
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @fires UserAgent#unregistered
 */
function UserAgent(accessManager, options) {
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    inviteClientTransactionFactory: InviteClientTransaction
  });

  var isRegistered = false;
  var isConnected = false;
  var callTimeout = options && options.callTimeout;
  var token = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _inviteClientTransactionFactory: {
      value: options.inviteClientTransactionFactory
    },
    _isConnected: {
      set: function(_isConnected) {
        isConnected = _isConnected;
      }
    },
    _isRegistered: {
      set: function(_isRegistered) {
        isRegistered = _isRegistered;
      }
    },
    _token: {
      get: function() {
        return token;
      },
      set: function(_token) {
        token = _token;
      }
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    callTimeout: {
      value: callTimeout
    },
    dialogs: {
      enumerable: true,
      value: new Set()
    },
    inviteClientTransactions: {
      enumerable: true,
      value: new Set()
    },
    inviteServerTransactions: {
      enumerable: true,
      value: new Set()
    },
    isConnected: {
      enumerable: true,
      get: function() {
        return isConnected;
      }
    },
    isRegistered: {
      enumerable: true,
      get: function() {
        return isRegistered;
      }
    },
    token: {
      enumerable: true,
      get: function() {
        return token;
      }
    }
  });

  if (!this.stunServers) {
    var stunServers = [];
    /* istanbul ignore next */
    Object.defineProperties(this, {
      _stunServers: {
        set: function(_stunServers) {
          stunServers = _stunServers;
        }
      },
      stunServers: {
        enumerable: true,
        get: function() {
          return stunServers;
        }
      }
    });
  }

  if (!this.turnServers) {
    var turnServers = [];
    /* istanbul ignore next */
    Object.defineProperties(this, {
      _turnServers: {
        set: function(_turnServers) {
          turnServers = _turnServers;
        }
      },
      turnServers: {
        enumerable: true,
        get: function() {
          return turnServers;
        }
      }
    });
  }

  return this;
}

inherits(UserAgent, EventEmitter);

/**
 * Connects this {@link UserAgent}.
 * @fires UserAgent#connected
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.connect = function connect() {
  if (this.isConnected) {
    var deferred = util.defer();
    setTimeout(deferred.resolve.bind(null, this));
    return deferred.promise;
  }

  return this._connect().then(
    this._onConnectSuccess.bind(this),
    this._onConnectFailure.bind(this));
};

UserAgent.prototype._connect = function _connect() {
  var deferred = util.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

UserAgent.prototype._onConnectSuccess = function _onConnectSuccess() {
  this.emit('connected', this);
  this._isConnected = true;
  return this;
};

UserAgent.prototype._onConnectFailure = function _onConnectFailure(error) {
  throw error;
};

/**
 * Disconnects this {@link UserAgent}.
 * @fires UserAgent#disconnected
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.disconnect = function disconnect() {
  if (!this.isConnected) {
    var deferred = util.defer();
    setTimeout(deferred.resolve.bind(null, this));
    return deferred.promise;
  }

  return this._disconnect().then(
    this._onDisconnectSuccess.bind(this),
    this._onDisconnectFailure.bind(this));
};

UserAgent.prototype._disconnect = function _disconnect() {
  var deferred = util.defer();
  setTimeout(deferred.resolve);
  return deferred.promise;
};

UserAgent.prototype._onDisconnectSuccess = function _onDisconnectSuccess() {
  this.emit('disconnected', this);
  this._isConnected = false;
  return this;
};

UserAgent.prototype._onDisconnectFailure = function _onDisconnectFailure(error) {
  throw error;
};

/**
 * Registers this {@link UserAgent}.
 * @fires UserAgent#registered
 * @fires UserAgent#registrationFailed
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.register = function register() {
  if (this.isRegistered && this.accessManager.token === this.token) {
    return Promise.resolve(this);
  }
  return this.connect()
    .then(this._register.bind(this, this.accessManager.token))
    .then(this._onRegisterSuccess.bind(this, this.accessManager.token),
          this._onRegisterFailure.bind(this));
};

UserAgent.prototype._register = function _register() {
  var deferred = util.defer();
  setTimeout(deferred.resolve.bind(null, this));
  return deferred.promise;
};

UserAgent.prototype._onRegisterSuccess = function _onRegisterSuccess(token) {
  this._isRegistered = true;
  this._token = token;
  this.emit('registered', this);
  return this;
};

UserAgent.prototype._onRegisterFailure = function _onRegisterFailure(error) {
  this.emit('registrationFailed', this);
  throw error;
};

/**
 * Unregisters this {@link UserAgent}.
 * @fires UserAgent#unregistered
 * @returns {Promise<UserAgent>}
 */
UserAgent.prototype.unregister = function unregister() {
  if (!this.isRegistered) {
    return Promise.resolve(this);
  }
  return this.connect()
    .then(this._unregister.bind(this))
    .then(this._onUnregisterSuccess.bind(this),
          this._onUnregisterFailure.bind(this));
};

UserAgent.prototype._unregister = function _unregister() {
  var deferred = util.defer();
  setTimeout(deferred.resolve.bind(null, this));
  return deferred.promise;
};

UserAgent.prototype._onUnregisterSuccess = function _onUnregisterSuccess() {
  this._isRegistered = false;
  this.emit('unregistered', this);
  return this;
};

UserAgent.prototype._onUnregisterFailure = function _onUnregisterFailure(error) {
  throw error;
};

/**
 * @param {Array<string>|string} identity
 * @param {?object} [options]
 * @returns {InviteClientTransaction}
 */
UserAgent.prototype.invite = function invite(identity, options) {
  var self = this;

  options = util.extend({
    callTimeout: this.callTimeout,
    stunServers: this.stunServers,
    turnServers: this.turnServers
  }, options);

  var addresses = identity.map ? identity : [identity];
  addresses = addresses.map(function(identity) {
    return 'sip:' + util.makeSIPURI(this.accessManager._tokenPayload.sub, identity);
  }, this);

  var ict = new this._inviteClientTransactionFactory(this, addresses, options);
  this.inviteClientTransactions.add(ict);

  ict.then(
    self._onInviteSuccess.bind(self, ict),
    self._onInviteFailure.bind(self, ict));

  return ict;
};

UserAgent.prototype._onInviteSuccess = function _onInviteSuccess(ict, dialog) {
  this.inviteClientTransactions.delete(ict);
  return this._dialogCreated(dialog);
};

UserAgent.prototype._onInviteFailure = function _onInviteFailure(ict, error) {
  this.inviteClientTransactions.delete(ict);
  throw error;
};

// Subclasses extend UserAgent by passing their own InviteServerTransactions.
UserAgent.prototype._handleInviteServerTransaction = function _handleInviteServerTransaction(ist) {
  this.inviteServerTransactions.add(ist);
  ist.then(
    this._onAcceptSuccess.bind(this, ist),
    this._onAcceptFailure.bind(this, ist));
  setTimeout(this.emit.bind(this, 'invite', ist));
};

UserAgent.prototype._onAcceptSuccess = function _onAcceptSuccess(ist, dialog) {
  this.inviteServerTransactions.delete(ist);
  return this._dialogCreated(dialog);
};

UserAgent.prototype._dialogCreated = function _dialogCreated(dialog) {
  var self = this;
  this.dialogs.add(dialog);

  dialog.once('disconnected', function() {
    self.emit('dialogDisconnected', dialog);
  });

  dialog.once('failed', function() {
    self.dialogs.delete(dialog);
    self.emit('dialogFailed', dialog);
  });

  dialog.once('ended', function() {
    self.dialogs.delete(dialog);
    self.emit('dialogEnded', dialog);
  });

  this.emit('dialogCreated', dialog);
  return dialog;
};

UserAgent.prototype._onAcceptFailure = function _onAcceptFailure(ist, error) {
  this.inviteServerTransactions.delete(ist);
  throw error;
};

module.exports = UserAgent;

},{"../util":31,"./invitetransaction/inviteclienttransaction":19,"events":44,"util":48}],28:[function(require,module,exports){
(function (process){
'use strict';

var C = require('./util/constants');
var Log = require('./util/log');
var request = require('./util/request');
var util = require('./util');
var version = require('lib/../../package.json').version;

var browserSpecs = { name: 'Unknown', version: '0.0' };

/* istanbul ignore next: Browser-specific logic */
if (typeof navigator !== 'undefined' && navigator.userAgent) {
  browserSpecs = util.parseUserAgent(navigator.userAgent);
} else if (typeof process !== 'undefined') {
  browserSpecs = { name: 'Node', version: process.version.node };
}

function StatsReporter(eventGateway, dialog, options) {
  if (!(this instanceof StatsReporter)) {
    return new StatsReporter(eventGateway, dialog, options);
  }

  function defaultPost(requestParams) {
    return request.post(requestParams);
  }

  options = util.extend({
    logLevel: C.DEFAULT_LOG_LEVEL,
    post: defaultPost
  }, options);

  var log = new Log('StatsReporter', options.logLevel);
  var self = this;
  var shouldPublish = false;
  var accessManager = dialog.userAgent.accessManager;
  var queuedSamples = [];

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _log: {
      value: log
    },
    _samples: {
      value: queuedSamples
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    dialog: {
      enumerable: true,
      value: dialog
    },
    eventGateway: {
      enumerable: true,
      value: eventGateway
    }
  });

  function publish() {
    if (shouldPublish && queuedSamples.length) {
      var samples = queuedSamples.splice(0, queuedSamples.length);
      publishSamples(options.post, self, samples);
    }
  }

  dialog.on('stats', function(sample) {
    queuedSamples.push(sample);
    if (queuedSamples.length >= 10) { publish(); }
  });

  dialog.once('ended', publish);

  publishInitialStats(options.post, this).then(function() {
    shouldPublish = true;
    if (queuedSamples.length >= 10 || dialog.ended) {
      publish();
    }
  });
}

function publishSamples(post, reporter, samples) {
  var url = 'https://' + reporter.eventGateway + '/v1/Calls/' + reporter.dialog.callSid + '/Statistics';
  var stats = {
    callsid: reporter.dialog.callSid,
    samples: samples
  };

  var log = reporter._log;
  return publishStats(post, url, reporter.accessManager.token, stats).then(
      log.debug.bind(log, 'Post to gateway succeeded'),
      log.debug.bind(log, 'Post to gateway failed'));
}

function publishInitialStats(post, reporter) {
  var url = 'https://' + reporter.eventGateway + '/v1/Calls';
  /* eslint camelcase:0 */
  var stats = {
    callsid: reporter.dialog.callSid,
    sip: {
      invite_to_180: reporter.dialog.inviteTo180
    },
    platform: {
      name: browserSpecs.name,
      version: browserSpecs.version,
      media_engine: 'WebRTC',
      sdk: version
    }
  };

  var log = reporter._log;
  return publishStats(post, url, reporter.accessManager.token, stats).then(
    log.debug.bind(log, 'Initial post to gateway succeeded'),
    log.debug.bind(log, 'Initial post to gateway failed'));
}

function publishStats(post, url, token, stats) {
  var requestParams = {
    url: url,
    body: stats,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': token
    }
  };

  return post(requestParams);
}

module.exports = StatsReporter;

}).call(this,require('_process'))
},{"./util":31,"./util/constants":30,"./util/log":32,"./util/request":34,"_process":46,"lib/../../package.json":89}],29:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./');

/**
 * Construct a new {@link CancelablePromise}.
 * @class
 * @classdesc A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
 * @param {Promise} original - a Promise
 * @property {boolean} isCanceled - whether or not the
 *   {@link CancelablePromise} was canceled
 * @fires CancelablePromise#canceled
 */
function CancelablePromise(original) {
  if (!(this instanceof CancelablePromise)) {
    return new CancelablePromise(original);
  }
  EventEmitter.call(this);

  var cancellation = new Error('Canceled');
  var deferred = util.defer();
  var isCancellable = true;
  var isCanceled = false;

  original.then(function originalResolved() {
    isCancellable = false;
    deferred.resolve.apply(deferred.promise, arguments);
  }, function originalRejected() {
    isCancellable = false;
    deferred.reject.apply(deferred.promise, arguments);
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _cancel: {
      value: deferred.reject.bind(deferred, cancellation)
    },
    _isCancelable: {
      get: function() {
        return isCancellable;
      }
    },
    _isCanceled: {
      get: function() {
        return isCanceled;
      },
      set: function(_isCanceled) {
        isCanceled = _isCanceled;
      }
    },
    _promise: {
      value: deferred.promise
    },
    isCanceled: {
      enumerable: true,
      get: function() {
        return isCanceled;
      }
    }
  });
}

inherits(CancelablePromise, EventEmitter);

/**
 * Attempt to cancel the {@link CancelablePromise}.
 * @throws Error
 * @returns {this}
 */
CancelablePromise.prototype.cancel = function cancel() {
  if (!this._isCancelable || this.isCanceled) {
    throw new Error('Cancellation failed');
  }
  this._isCanceled = true;
  this.emit('canceled', this);
  this._cancel();
  return this;
};

CancelablePromise.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

CancelablePromise.prototype.then = function _then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link CancelablePromise} was canceled.
 * @param {CancelablePromise} promise - The {@link CancelablePromise}
 * @event CancelablePromise#canceled
 */

module.exports = CancelablePromise;

},{"./":31,"events":44,"util":48}],30:[function(require,module,exports){
'use strict';

module.exports.CLIENT_VERSION = 2;
module.exports.DEFAULT_LOG_LEVEL = 'warn';
module.exports.EVENT_GATEWAY = 'eventgw.twilio.com';
module.exports.REGISTRAR_SERVER = function(accountSid) { return accountSid + '.endpoint.twilio.com'; };
module.exports.WS_SERVER = function(accountSid) { return 'wss://' + accountSid + '.endpoint.twilio.com'; };
module.exports.DEFAULT_CALL_TIMEOUT = 50000;
module.exports.MAX_ADDRESS_LENGTH = 256;

var DEFAULT_OFFER_OPTIONS = {};
if (typeof navigator !== 'undefined' && navigator.mozGetUserMedia) {
  DEFAULT_OFFER_OPTIONS = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  };
} else {
  DEFAULT_OFFER_OPTIONS.mandatory = {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true
  };
}
module.exports.DEFAULT_OFFER_OPTIONS = DEFAULT_OFFER_OPTIONS;

// Headers
/* eslint key-spacing:0 */
module.exports.headers = {
  X_TWILIO_ACCESSTOKEN:   'X-Twilio-AccessToken',
  X_TWILIO_ACCOUNTSID:    'X-Twilio-Accountsid',
  X_TWILIO_CALLSID:       'X-Twilio-Callsid',
  X_TWILIO_CLIENT:        'X-Twilio-Client',
  X_TWILIO_CLIENTVERSION: 'X-Twilio-Clientversion',
  X_TWILIO_PARTICIPANTS:  'X-Twilio-Participants',
  X_TWILIO_PARTICIPANTSID:'X-Twilio-ParticipantSid',
  X_TWILIO_TOKEN:         'X-Twilio-Token'
};

// Errors
// NOTE: This array is being reduced to a hash of TwilioErrors indexed by name
var TwilioError = require('./twilioerror');
module.exports.twilioErrors = Array.prototype.reduce.call([
  // Generic Network
  { name: 'GATEWAY_CONNECTION_FAILED', message: 'Could not connect to Twilio\'s servers' },
  { name: 'GATEWAY_DISCONNECTED', message: 'Connection to Twilio\'s servers was lost' },

  // Local Validation
  { name: 'INVALID_ARGUMENT', message: 'One or more arguments passed were invalid' },
  { name: 'INVALID_TOKEN', message: 'The token is invalid or malformed' },

  // Registration
  { name: 'LISTEN_FAILED', message: 'Failed to listen with the supplied token' },
  { name: 'TOKEN_EXPIRED', message: 'Client\'s active token has expired' },

  // Session Setup
  { name: 'CONVERSATION_CREATE_FAILED', message: 'Failed to create Conversation' },
  { name: 'CONVERSATION_INVITE_FAILED', message: 'Failed to add Participant to Conversation' },
  { name: 'CONVERSATION_INVITE_TIMEOUT', message: 'Invite to Participant timed out' },
  { name: 'CONVERSATION_INVITE_REJECTED', message: 'Invite was rejected by Participant' },
  { name: 'CONVERSATION_INVITE_CANCELED', message: 'Invite to Participant was canceled' },
  { name: 'CONVERSATION_JOIN_FAILED', message: 'Failed to join Conversation' },
  { name: 'CONVERSATION_JOIN_CANCELED', message: 'Incoming Invite was canceled by the sender' },
  { name: 'SDP_NEGOTIATION_FAILED', message: 'Failed to negotiate media with Participant(s)' },

  // ICE
  { name: 'ICE_CONNECT_FAILED', message: 'Could not find match for all candidates' },
  { name: 'ICE_DISCONNECTED', message: 'Liveliness check has failed; may be recoverable' },

  // Media
  { name: 'MEDIA_ACCESS_DENIED', message: 'Could not get access to microphone or camera' }
], function(errors, data) {
  errors[data.name] = new TwilioError(data);
  return errors;
}, { });

},{"./twilioerror":36}],31:[function(require,module,exports){
(function (process,Buffer){
'use strict';

var C = require('./constants');
var headers = C.headers;
var map = require('./map');

function getSDKVersion() {
  // NOTE(mroberts): Set by `Makefile'.
  /* eslint no-process-env:0 */
  return process.env.SDK_VERSION || 'unknown';
}

function makeSystemInfo() {
  var version = getSDKVersion();
  var nav = typeof navigator === 'undefined' ? {} : navigator;
  return {
    p: 'browser',
    v: version,
    browser: {
      userAgent: nav.userAgent || 'unknown',
      platform: nav.platform || 'unknown'
    },
    plugin: 'rtc'
  };
}

/**
 * Decode a base64url-encoded string.
 * @private
 * @param {string} encoded
 * @returns {string}
 */
function decodeBase64URL(encoded) {
  var remainder = encoded.length % 4;
  if (remainder > 0) {
    var padlen = 4 - remainder;
    encoded += new Array(padlen + 1).join('=');
  }
  encoded = encoded.replace(/-/g, '+')
                   .replace(/_/g, '/');
  return decodeBase64(encoded);
}

/**
 * Decode a base64-encoded string.
 * @private
 * @param {string} encoded
 * @returns {string}
 */
function decodeBase64(encoded) {
  return typeof atob === 'function'
    ? atob(encoded)
    : new Buffer(encoded, 'base64').toString();
}

// TODO(mrobers): Remove this function as soon as we move to FPA.
function selectTokenHeader(token) {
  var parts = token.split('.');
  var header;
  try {
    header = JSON.parse(decodeBase64URL(parts[0]));
  } catch (error) {
    return headers.X_TWILIO_ACCESSTOKEN;
  }
  return typeof header.cty === 'string' && header.cty.match(/^twilio-fpa/)
    ? headers.X_TWILIO_ACCESSTOKEN
    : headers.X_TWILIO_TOKEN;
}

/**
 * Construct an array of REGISTER headers.
 * @param {string} token - an Access Token
 * @returns {Array}
 */
function makeRegisterHeaders(token) {
  var systemInfo = makeSystemInfo();
  var cmg = [
    selectTokenHeader(token)       + ': ' + token,
    headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify(systemInfo),
    headers.X_TWILIO_CLIENTVERSION + ': ' + C.CLIENT_VERSION
  ];
  return cmg;
}

/**
 * Construct the SIP URI for a client of a particular account.
 * @param {string} accountSid - the Account SID
 * @param {string} clientName - the client name
 * @returns {string}
 */
function makeSIPURI(accountSid, clientName) {
  /* eslint new-cap:0 */
  return encodeURIComponent(clientName) + '@' + C.REGISTRAR_SERVER(accountSid);
}

/**
 * Get the decoded user portion of a SIP URI.
 * @param {string} uri - the SIP URI
 * @returns {?string}
 */
function getUser(uri) {
  var SIPJS = require('sip.js');
  var result = SIPJS.Grammar.parse(uri, 'Contact');
  if (result !== -1 && result[0]) {
    return result[0].parsed.uri.user;
  }
  return null;
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function withDefaults(destination, sources) {
  destination = destination || {};
  sources = Array.prototype.slice.call(arguments, 1);
  sources.forEach(function(source) {
    _withDefaults(destination, source);
  });

  return destination;
}
function _withDefaults(destination, source) {
  for (var key in source) {
    if (!(key in destination)) {
      destination[key] = source[key];
    }
  }

  return destination;
}

function extend(destination, sources) {
  destination = destination || {};
  sources = Array.prototype.slice.call(arguments, 1);
  sources.forEach(function(source) {
    _extend(destination, source);
  });

  return destination;
}
function _extend(destination, source) {
  for (var key in source) {
    destination[key] = source[key];
  }

  return destination;
}

function separateIceServers(iceServers) {
  var stunServers = [];
  var turnServers = [];
  if (iceServers) {
    iceServers.forEach(function(iceServer) {
      if (!iceServer.url) {
        return;
      }
      var schema = iceServer['url'].split(':')[0];
      if (schema === 'stun' || schema === 'stuns') {
        stunServers.push(iceServer);
      } else if (schema === 'turn' || schema === 'turns') {
        turnServers.push(iceServer);
      }
    });
  }
  stunServers = stunServers.map(function(stunServer) {
    return stunServer['url'].split('?')[0];
  });
  turnServers = turnServers.map(function(turnServer) {
    /* eslint dot-notation:0 */
    var url = turnServer['url'].split('?')[0];
    var username = turnServer['username'];
    var password = turnServer['credential'];
    return {
      urls: [url],
      username: username,
      password: password
    };
  });
  return { stunServers: stunServers, turnServers: turnServers };
}

function getStunServers(iceServers) {
  return separateIceServers(iceServers).stunServers;
}

function getTurnServers(iceServers) {
  return separateIceServers(iceServers).turnServers;
}

function promiseFromEvents(operation, eventEmitter, successEvent, failureEvent) {
  return new Promise(function(resolve, reject) {
    function onSuccess() {
      var args = [].slice.call(arguments);
      if (failureEvent) {
        eventEmitter.removeListener(failureEvent, onFailure);
      }
      resolve.apply(null, args);
    }
    function onFailure() {
      var args = [].slice.call(arguments);
      eventEmitter.removeListener(successEvent, onSuccess);
      reject.apply(null, args);
    }
    eventEmitter.once(successEvent, onSuccess);
    if (failureEvent) {
      eventEmitter.once(failureEvent, onFailure);
    }
    operation();
  });
}

function parseConversationSIDFromContactHeader(contactHeader) {
  var match = contactHeader.match(/<sip:(.*)@(.*)$/);
  return match ? match[1] : null;
}

/**
 * Traverse down multiple nodes on an object and return null if
 * any link in the path is unavailable.
 * @param {Object} obj - Object to traverse
 * @param {String} path - Path to traverse. Period-separated.
 * @returns {Any|null}
 */
function getOrNull(obj, path) {
  return path.split('.').reduce(function(output, step) {
    if (!output) { return null; }
    return output[step];
  }, obj);
}

/**
 * Parse the passed userAgent string down into a simple object.
 * Example browser object: { name: 'Chrome', version: '42.0' }
 * @returns {Object} Object containing a name and version.
 */
function parseUserAgent(ua) {
  var M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)\.(\d+)/i) || [];
  var specs = {
    name: M[1],
    version: typeof M[2] !== 'undefined' && typeof M[3] !== 'undefined' && M[2] + '.' + M[3]
  };

  var parts;

  if (/trident/i.test(specs.name)) {
    parts = /\brv[ :]+(\d+)\.(\d+)/g.exec(ua) || [];
    return { name: 'IE', version: parts[1] ? (parts[1] + '.' + parts[2]) : 'Unknown' };
  }

  if (specs.name === 'Chrome') {
    parts = ua.match(/\b(OPR|Edge)\/(\d+)\.(\d+)/);
    if (parts !== null) { return { name: 'Opera', version: parts[2] + '.' + parts[3] }; }
  }

  if (specs.name === 'MSIE') {
    specs.name = 'IE';
  }

  return {
    name: specs.name || 'Unknown',
    version: specs.version || 'Unknown'
  };
}

/**
 * Overwrite an existing Array with a new one. This is useful when the existing
 * Array is an immutable property of another object.
 * @param {Array} oldArray - the existing Array to overwrite
 * @param {Array} newArray - the new Array to overwrite with
 */
function overwriteArray(oldArray, newArray) {
  oldArray.splice(0, oldArray.length);
  newArray.forEach(function(item) {
    oldArray.push(item);
  });
}

function validateAddresses(accountSid, addresses) {
  var invalidAddresses = (addresses.forEach ? addresses : [addresses])
    .map(makeSIPURI.bind(accountSid))
    .filter(function(address) { return address.length > C.MAX_ADDRESS_LENGTH; });

  if (invalidAddresses.length) {
    throw new Error('Addresses must not exceed ' + C.MAX_ADDRESS_LENGTH + ' characters: ' + invalidAddresses);
  }
}

function defer() {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

module.exports.makeRegisterHeaders = makeRegisterHeaders;
module.exports.makeSIPURI = makeSIPURI;
module.exports.getUser = getUser;
module.exports.makeUUID = makeUUID;
module.exports.withDefaults = withDefaults;
module.exports.extend = extend;
module.exports.separateIceServers = separateIceServers;
module.exports.getStunServers = getStunServers;
module.exports.getTurnServers = getTurnServers;
module.exports.promiseFromEvents = promiseFromEvents;
module.exports.parseConversationSIDFromContactHeader = parseConversationSIDFromContactHeader;
module.exports.getOrNull = getOrNull;
module.exports.parseUserAgent = parseUserAgent;
module.exports.overwriteArray = overwriteArray;
module.exports.map = map;
module.exports.validateAddresses = validateAddresses;
module.exports.selectTokenHeader = selectTokenHeader;
module.exports.defer = defer;

}).call(this,require('_process'),require("buffer").Buffer)
},{"./constants":30,"./map":33,"_process":46,"buffer":40,"sip.js":88}],32:[function(require,module,exports){
/* eslint no-console:0 */
'use strict';

// Dependencies
var E = require('./constants').twilioErrors;

/**
 * Construct a new {@link Log} object.
 * @class
 * @classdesc Selectively outputs messages to console.log
 *   based on a specified minimum log level.
 * @param {String} name - Name of this instance of {@link Log}
 * @param {Number} logLevel - Level of logging. See Log.* constants.
 */
function Log(name, logLevel) {
  if (!(this instanceof Log)) {
    return new Log(name, logLevel);
  }

  logLevel = logLevel ? Log.getLevelByName(logLevel) : Log.INFO;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    logLevel: { value: logLevel },
    name: { value: name }
  });
}

// Singleton Constants
/* eslint key-spacing:0 */
/* istanbul ignore next */
Object.defineProperties(Log, {
  DEBUG: { value: 0 },
  INFO:  { value: 1 },
  WARN:  { value: 2 },
  ERROR: { value: 3 },
  OFF:   { value: 4 },
  _levels: {
    value: [
      { name: 'DEBUG', logFn: console.log },
      { name: 'INFO',  logFn: console.info },
      { name: 'WARN',  logFn: console.warn },
      { name: 'ERROR', logFn: console.error }
    ]
  }
});

/**
 * Get the log level (number) by its name (string)
 * @param {String} name - Name of the log level
 * @returns {Number} Requested log level
 * @throws {TwilioError} INVALID_LOG_LEVEL (32056)
 * @public
 */
Log.getLevelByName = function getLevelByName(name) {
  if (!isNaN(name)) {
    return parseInt(name, 10);
  }

  name = name.toUpperCase();

  if (['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG'].indexOf(name) === -1) {
    var message = 'Log level must be one of: ["off", "error", "warn", "info", "debug"]';
    throw E.INVALID_ARGUMENT.clone(message);
  }

  return Log[name];
};

/**
 * Log a message using the console method appropriate for the specified logLevel
 * @param {Number} logLevel - Log level of the message being logged
 * @param {String} message - Message(s) to log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.log = function log(logLevel, message) {
  var logSpec = Log._levels[logLevel];
  if (!logSpec) { throw E.INVALID_ARGUMENT.clone('Invalid log level'); }

  if (this.logLevel <= logLevel) {
    var levelName = logSpec.name;
    var prefix = [this.name, levelName];

    logSpec.logFn.apply(console, prefix.concat(message));
  }

  return this;
};

/**
 * Log a debug message using console.log
 * @param {...String} messages - Message(s) to pass to console.log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.debug = function debug() {
  return this.log(Log.DEBUG, [].slice.call(arguments));
};

/**
 * Log an info message using console.info
 * @param {...String} messages - Message(s) to pass to console.info
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.info = function info() {
  return this.log(Log.INFO, [].slice.call(arguments));
};

/**
 * Log a warn message using console.warn
 * @param {...String} messages - Message(s) to pass to console.warn
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.warn = function warn() {
  return this.log(Log.WARN, [].slice.call(arguments));
};

/**
 * Log an error message using console.error
 * @param {...String} messages - Message(s) to pass to console.error
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.error = function error() {
  return this.log(Log.ERROR, [].slice.call(arguments));
};

/**
 * Log an error message using console.error and throw an exception
 * @param {TwilioError} origError - Error to throw
 * @param {String} customMessage - Custom message for the error
 * @public
 */
Log.prototype.throw = function throwFn(error, customMessage) {
  if (error.clone) {
    error = error.clone(customMessage);
  }

  this.log(Log.ERROR, error);
  throw error;
};

module.exports = Log;

},{"./constants":30}],33:[function(require,module,exports){
'use strict';

/**
 * Add a value to the Set at the given key. If a Set does not already exist
 * at the given key, create one.
 * @param {Map<*, Set<*>>} map
 * @param {*} key
 * @param {*} value
 * @returns {Map<*, Set<*>>}
 */
function addToMapOfSets(map, key, value) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key).add(value);
  return map;
}

/**
 * Delete a value from the Set at the given key. If deleting the value results
 * in an empty Set, delete the Set from the Map.
 * @param {Map<*, Set<*>>} map
 * @param {*} key
 * @param {*} value
 * @returns {Map<*, Set<*>>}
 */
function deleteFromMapOfSets(map, key, value) {
  if (!map.has(key)) {
    return map;
  }
  var set = map.get(key);
  set.delete(value);
  if (!set.size) {
    map.delete(set);
  }
  return map;
}

module.exports.addToMapOfSets = addToMapOfSets;
module.exports.deleteFromMapOfSets = deleteFromMapOfSets;

},{}],34:[function(require,module,exports){
'use strict';

var util = require('./');
var XHR = typeof XMLHttpRequest === 'undefined'
        ? require('xmlhttprequest').XMLHttpRequest
        /* istanbul ignore next: external dependency */
        : XMLHttpRequest;

function request(method, params, options) {
  options = util.extend({
    xmlHttpRequestFactory: XHR
  }, options);

  var deferred = util.defer();

  /* eslint new-cap:0 */
  var xhr = new options.xmlHttpRequestFactory();

  xhr.open(method, params.url, true);
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState !== 4) { return; }

    if (200 <= xhr.status && xhr.status < 300) {
      deferred.resolve(xhr.responseText);
    } else {
      deferred.reject(new Error(xhr.responseText));
    }
  };

  for (var headerName in params.headers) {
    xhr.setRequestHeader(headerName, params.headers[headerName]);
  }

  xhr.send(JSON.stringify(params.body));

  return deferred.promise;
}

/**
 * Use XMLHttpRequest to get a network resource.
 * @param {String} method - HTTP Method
 * @param {Object} params - Request parameters
 * @param {String} params.url - URL of the resource
 * @param {Array}  params.headers - An array of headers to pass [{ headerName : headerBody }]
 * @param {Object} params.body - A JSON body to send to the resource
 * @returns {Promise}
 **/
var Request = request;

/**
 * Sugar function for request('GET', params);
 * @param {Object} params - Request parameters
 * @returns {Promise}
 */
Request.get = function(params, options) {
  return new this('GET', params, options);
};

/**
 * Sugar function for request('POST', params);
 * @param {Object} params - Request parameters
 * @returns {Promise}
 */
Request.post = function(params, options) {
  return new this('POST', params, options);
};

module.exports = Request;

},{"./":31,"xmlhttprequest":91}],35:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./');

/**
 * Construct a new {@link TimeoutPromise}.
 * @class
 * @classdesc A Promise that can time out.
 * @extends Promise
 * @param {Promise} original - a Promise
 * @param {?number} [timeout] - the timeout, in milliseconds; providing this in
 *   the constructor invokes {@link TimeoutPromise#start} (otherwise, you must
 *   call {@link TimeoutPromise#start} yourself)
 * @property {?number} timeout - the timeout, in milliseconds
 * @property {boolean} isTimedOut - whether or not the
 *   {@link TimeoutPromise} timed out
 * @fires TimeoutPromise#timedOut
 */
function TimeoutPromise(original, initialTimeout) {
  if (!(this instanceof TimeoutPromise)) {
    return new TimeoutPromise(original, initialTimeout);
  }
  EventEmitter.call(this);

  var deferred = util.defer();
  var isTimedOut = false;
  var timedOut = new Error('Timed out');
  var timeout = null;
  var timer = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deferred: {
      value: deferred
    },
    _isTimedOut: {
      get: function() {
        return isTimedOut;
      },
      set: function(_isTimedOut) {
        isTimedOut = _isTimedOut;
      }
    },
    _timedOut: {
      value: timedOut
    },
    _timeout: {
      get: function() {
        return timeout;
      },
      set: function(_timeout) {
        timeout = _timeout;
      }
    },
    _timer: {
      get: function() {
        return timer;
      },
      set: function(_timer) {
        timer = _timer;
      }
    },
    _promise: {
      value: deferred.promise
    },
    isTimedOut: {
      enumerable: true,
      get: function() {
        return isTimedOut;
      }
    },
    timeout: {
      enumerable: true,
      get: function() {
        return timeout;
      }
    }
  });

  var self = this;
  original.then(function originalResolved() {
    clearTimeout(self._timer);
    deferred.resolve.apply(deferred.promise, arguments);
  }, function originalRejected() {
    clearTimeout(self._timer);
    deferred.reject.apply(deferred.promise, arguments);
  });

  if (initialTimeout) {
    this.start(initialTimeout);
  }
}

inherits(TimeoutPromise, EventEmitter);

TimeoutPromise.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

/**
 * Start the timer that will time out the {@link TimeoutPromise} if the
 * original Promise has neither resolved nor rejected. Subsequent calls have no
 * effect once the {@link TimeoutPromise} is started.
 * @param {number} timeout - the timeout, in milliseconds
 * @returns {this}
 */
TimeoutPromise.prototype.start = function start(timeout) {
  if (this._timer) {
    return this;
  }
  var self = this;
  this._timeout = timeout;
  this._timer = setTimeout(function timer() {
    if (self._timer) {
      self._isTimedOut = true;
      self.emit('timedOut', self);
      self._deferred.reject(self._timedOut);
    }
  }, this.timeout);
  return this;
};

TimeoutPromise.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link TimeoutPromise} timed out.
 * @param {TimeoutPromise} promise - The {@link TimeoutPromise}
 * @event TimeoutPromise#timedOut
 */

module.exports = TimeoutPromise;

},{"./":31,"events":44,"util":48}],36:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;

/**
 * Constructs a new {@link TwilioError}
 * @class
 * @classdesc An extension of Error that contains details about
 *   a specific Twilio error
 * @param {Object} errorData - The specifications to add to the error
 * @param {String} customMessage - A custom message to override the default
 */
function TwilioError(errorData, customMessage) {
  /* istanbul ignore next */
  Object.defineProperties(this, {
    _errorData: { value: errorData },
    name: { value: errorData.name },
    message: { value: customMessage || errorData.message }
  });
}

inherits(TwilioError, Error);

/**
 * Convert the {@link TwilioError} to a readable string
 * @returns {String} A string representation of the error.
 * @public
 */
TwilioError.prototype.toString = function toString() {
  return [this.name, this.message].join(' | ');
};

/**
 * Clone this {@link TwilioError}, optionally with a new message
 * @params {String} customMessage - A custom detail message to emit
 * @returns {TwilioError} A new instance of {@link TwilioError}
 * @public
 */
TwilioError.prototype.clone = function clone(customMessage) {
  return new TwilioError(this._errorData, customMessage);
};

module.exports = TwilioError;

},{"util":48}],37:[function(require,module,exports){
'use strict';

/**
 * Check if a value is strictly not equal to null.
 * @param {*} value
 * returns {boolean}
 */
function isNotNull(value) {
  return value !== null;
}

/**
 * Parse JSON.
 * @param {string}
 * @returns {Object}
 * @throws {Error}
 */
function parseJSON(string) {
  var json = JSON.parse(string);
  return validateObject('Full or Partial Notification', json);
}

/**
 * Parse a string or JSON.
 * @param {String|Object} stringOrJSON
 * @returns {Object}
 * @throws {Error}
 */
function parseStringOrJSON(stringOrJSON) {
  return typeof stringOrJSON === 'object'
    ? stringOrJSON
    : parseJSON(stringOrJSON);
}

/**
 * Validate an instance of a class.
 * @param {*} value
 * @param {*} _class
 * @param {string} name
 * @param {string} className
 * @returns {*}
 * @throws {Error}
 */
function validateInstanceOf(value, _class, name, className) {
  if (!(value instanceof _class)) {
    throw new Error(name + ' is not ' + className + ': ' + value);
  }
  return value;
}

/**
 * Validate an Array.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateArray(name, value) {
  return validateInstanceOf(value, Array, name, 'an array');
}

/**
 * Validate an integer.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateInteger(name, value) {
  if (!Number.isInteger(value)) {
    throw new Error(name + ' is not an integer: ' + value);
  }
  return value;
}

/**
 * Validate an object.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateObject(name, value) {
  return validateInstanceOf(value, Object, name, 'an object');
}

/**
 * Validate a string.
 * @param {string} name
 * @param {*} value
 * @returns {*}
 * @throws {Error}
 */
function validateString(name, value) {
  if (typeof value !== 'string') {
    throw new Error(name + ' is not a string: ' + value);
  }
  return value;
}

/**
 * Run a validation. If it fails, return the default value.
 * @param {function} validation
 * @param {*} def
 * @returns {*}
 */
function validateOr(validation, def) {
  try {
    return validation();
  } catch (error) {
    return def;
  }
}

module.exports.isNotNull = isNotNull;
module.exports.parseJSON = parseJSON;
module.exports.parseStringOrJSON = parseStringOrJSON;
module.exports.validateInstanceOf = validateInstanceOf;
module.exports.validateArray = validateArray;
module.exports.validateInteger = validateInteger;
module.exports.validateObject = validateObject;
module.exports.validateString = validateString;
module.exports.validateOr = validateOr;

},{}],38:[function(require,module,exports){
'use strict';

/**
 * Collect any WebRTC statistics for the given {@link PeerConnection} and pass
 * them to an error-first callback.
 * @param {PeerConnection} peerConnection - The {@link PeerConnection}
 * @param {function} callback - The callback
 */
function getStatistics(peerConnection, callback) {
  var error = new Error('WebRTC statistics are unsupported');
  if (peerConnection === null || typeof navigator === 'undefined' || typeof peerConnection.getStats !== 'function') {
    callback(error);
    return;
  } else if (navigator.webkitGetUserMedia) {
    peerConnection.getStats(chainCallback(withStats, callback), callback);
    return;
  } else if (navigator.mozGetUserMedia) {
    peerConnection.getStats(null, chainCallback(mozWithStats, callback), callback);
    return;
  }
  callback(error);
}

/**
 * Handle any WebRTC statistics for Google Chrome and pass them to an error-
 * first callback.
 * @param {RTCStatsResponse} response - WebRTC statistics for Google Chrome
 * @param {function} callback - The callback
 */
function withStats(response, callback) {
  var trackStats = [];
  var transportStats = null;

  var unknownStats = [];

  var results = response.result();
  var timestamp = null;

  results.forEach(function(report) {
    var processedReport = null;
    switch (report.type) {
      case 'googCandidatePair':
        processedReport = processCandidatePair(report);
        if (processedReport) {
          transportStats = transportStats || processedReport.known;
        }
        break;
      case 'ssrc':
        processedReport = processSSRC(report);
        trackStats.push(processedReport.known);
        break;
      default:
        unknownStats.push(report);
    }
    if (processedReport && processedReport.known && processedReport.known.timestamp) {
      timestamp = timestamp || processedReport.known.timestamp;
      delete processedReport.known.timestamp;
    }
  });
  var stats = {
    timestamp: timestamp,
    tracks: trackStats,
    transport: transportStats
  };
  callback(null, stats);
}

function processCandidatePair(report) {
  /* eslint dot-notation:0 */
  var transportStats = {};
  var unknownStats = {};
  var names = report.names();
  var timestamp = report.timestamp ? Math.floor(report.timestamp / 1000) : null;
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var value = report.stat(name);
    var address;
    switch (name) {
      // If the connection represented by this report is inactive, bail out.
      case 'googActiveConnection':
        if (value !== 'true') {
          return null;
        }
        break;

      case 'googChannelId':
        transportStats['connection'] = value;
        break;

      case 'googLocalAddress':
        if (value.split) {
          address = value.split(':');
          setProp(transportStats, 'local', 'address', address[0]);
          setProp(transportStats, 'local', 'port', Number(address[1]));
        }
        break;

      case 'googLocalCandidateType':
        setProp(transportStats, 'local', 'type', value);
        break;

      case 'googRemoteAddress':
        if (value.split) {
          address = value.split(':');
          setProp(transportStats, 'remote', 'address', address[0]);
          setProp(transportStats, 'remote', 'port', Number(address[1]));
        }
        break;

      case 'googRemoteCandidateType':
        setProp(transportStats, 'remote', 'type', value);
        break;

      case 'googRtt':
        transportStats['rtt'] = Number(value);
        break;

      // Ignore empty stat names (annoying, I know).
      case '':
        break;

      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  transportStats['timestamp'] = timestamp;
  return packageStats(transportStats, unknownStats);
}

function processSSRC(report) {
  /* eslint dot-notation:0 */
  var trackStats = {};
  var unknownStats = {};
  var names = report.names();

  var direction = null;
  var media = null;
  var timestamp = report.timestamp ? Math.floor(report.timestamp / 1000) : null;

  names.forEach(function(name) {
    var value = report.stat(name);
    switch (name) {

      case 'audioInputLevel':
        media = 'audio';
        setProp(trackStats, 'audio', 'inlvl', Number(value));
        break;

      case 'audioOutputLevel':
        media = 'audio';
        setProp(trackStats, 'audio', 'outlvl', Number(value));
        break;

      case 'bytesReceived':
        direction = 'receiving';
        setProp(trackStats, 'bytes', 'recv', Number(value));
        break;

      case 'bytesSent':
        direction = 'sending';
        setProp(trackStats, 'bytes', 'sent', Number(value));
        break;

      case 'googCodecName':
        // Filter out the empty case.
        var codecName = value;
        if (codecName !== '') {
          trackStats['codecName'] = value;
        }
        break;

      case 'googFrameHeightReceived':
        direction = 'receiving';
        media = 'video';
        setProp(trackStats, 'video', 'height_recv', Number(value));
        break;

      case 'googFrameHeightSent':
        direction = 'sending';
        media = 'video';
        setProp(trackStats, 'video', 'height_sent', Number(value));
        break;

      case 'googFrameWidthReceived':
        direction = 'receiving';
        media = 'video';
        setProp(trackStats, 'video', 'width_recv', Number(value));
        break;

      case 'googFrameWidthSent':
        direction = 'sending';
        media = 'video';
        setProp(trackStats, 'video', 'width_sent', Number(value));
        break;

      case 'googFrameRateDecoded':
        direction = 'receiving';
        media = 'video';
        setProp(trackStats, 'video', 'fps_recv', Number(value));
        break;

      case 'googFrameRateSent':
        direction = 'sending';
        media = 'video';
        setProp(trackStats, 'video', 'fps_sent', Number(value));
        break;

      case 'googJitterBufferMs':
        trackStats['googJitterBufferMs'] = Number(value);
        break;

      case 'googJitterReceived':
        // Filter out the -1 case.
        var jitterReceived = Number(value);
        if (jitterReceived !== -1) {
          trackStats['jitter'] = jitterReceived;
        }
        break;

      case 'googRtt':
        // Filter out the -1 case.
        var rtt = Number(value);
        if (rtt !== -1) {
          trackStats['rtt'] = rtt;
        }
        break;

      case 'packetsLost':
        direction = 'sending';
        // Filter out the -1 case.
        var packetsLost = Number(value);
        if (packetsLost !== -1) {
          setProp(trackStats, 'packets', 'lost', Number(value));
        }
        break;

      case 'packetsReceived':
        direction = 'receiving';
        setProp(trackStats, 'packets', 'recv', Number(value));
        break;

      case 'packetsSent':
        direction = 'sending';
        setProp(trackStats, 'packets', 'sent', Number(value));
        break;

      case 'ssrc':
        trackStats[name] = value;
        break;

      case 'transportId':
        trackStats['connection'] = value;
        break;

      // Unknown
      default:
        unknownStats[name] = value;
    }
  });
  if (direction) {
    trackStats['direction'] = direction;
  }
  if (media) {
    trackStats['media'] = media;
  }
  trackStats['timestamp'] = timestamp;
  return packageStats(trackStats, unknownStats);
}

/**
 * Handle any WebRTC statistics for Mozilla Firefox and pass them to an error-
 * first callback.
 * @param {RTCStatsReport} reports - WebRTC statistics for Mozilla Firefox
 * @param {function} callback - The callback
 */
function mozWithStats(reports, callback) {
  var knownStats = [];
  var unknownStats = [];
  var timestamp = null;

  var localCandidates = { };
  var remoteCandidates = { };
  var activePair;

  reports.forEach(function(report) {
    var processedReport = null;
    switch (report.type) {
      case 'inboundrtp':
        processedReport = processInbound(report);
        break;
      case 'outboundrtp':
        if (report.isRemote === false) {
          processedReport = processOutbound(report);
        }
        break;
      // Unknown
      case 'candidatepair':
        var activeId = activePair && activePair.componentId;
        // We can only send one candidate pair, and some browsers have separate pairs
        // for each track. We're favoring the video stream here for consistency.
        if (report.selected && !(activeId && activeId.indexOf('video') !== -1)) {
          activePair = report;
        }
        break;
      case 'localcandidate':
        localCandidates[report.id] = report;
        break;
      case 'remotecandidate':
        remoteCandidates[report.id] = report;
        break;
      default:
        unknownStats.push(report);
    }
    if (processedReport) {
      timestamp = timestamp || processedReport.known.timestamp;
      delete processedReport.known.timestamp;
      knownStats.push(processedReport);
    }
  });
  if (knownStats.length === 0 || (knownStats = filterKnownStats(knownStats)).length === 0) {
    return callback(null, { timestamp: timestamp, ssrcs: [] });
  }

  var localCandidate = localCandidates[activePair.localCandidateId];
  var remoteCandidate = remoteCandidates[activePair.remoteCandidateId];

  var transport = {
    local: {
      address: localCandidate.ipAddress,
      port: localCandidate.portNumber,
      type: localCandidate.candidateType === 'host' ? 'local' : localCandidate.candidateType
    },
    remote: {
      address: remoteCandidate.ipAddress,
      port: remoteCandidate.portNumber,
      type: remoteCandidate.candidateType === 'host' ? 'local' : remoteCandidate.candidateType
    }
  };

  var sample = {
    timestamp: timestamp,
    tracks: knownStats.map(convertToGatewayFormat),
    transport: transport
  };

  callback(null, sample);
}

function processOutbound(report) {
  /* eslint dot-notation:0 */
  var knownStats = { direction: 'sending' };
  var unknownStats = {};
  for (var name in report) {
    var value = report[name];
    switch (name) {
      // Convert to UNIX timestamp.
      case 'timestamp':
        knownStats[name] = Math.floor(value / 1000);
        break;
      case 'mediaType':
        knownStats['media'] = value;
        break;
      // Pass these stats through unmodified.
      case 'bytesSent':
      case 'packetsSent':
      case 'ssrc':
        knownStats[name] = value;
        break;
      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  return packageStats(knownStats, unknownStats);
}

function processInbound(report) {
  /* eslint dot-notation:0 */
  var knownStats = { direction: 'receiving' };
  var unknownStats = {};
  for (var name in report) {
    var value = report[name];
    switch (name) {
      // Rename "moz"-prefixed stats.
      case 'mozRtt':
        knownStats['rtt'] = value;
        break;
      // Convert to UNIX timestamp.
      case 'timestamp':
        knownStats[name] = Math.floor(value / 1000);
        break;
      // Convert to milliseconds.
      case 'jitter':
        knownStats[name] = value * 1000;
        break;
      case 'framerateMean':
        knownStats['fps'] = Math.round(value);
        break;
      case 'mediaType':
        knownStats['media'] = value;
        break;
      // Pass these stats through unmodified.
      case 'bytesReceived':
      case 'packetsLost':
      case 'packetsReceived':
      case 'ssrc':
        knownStats[name] = value;
        break;
      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  return packageStats(knownStats, unknownStats);
}

/**
 * Given two objects containing known and unknown WebRTC statistics, include
 * each in an object keyed by "known" or "unkown" if they are non-empty. If
 * both are empty, return null.
 * @param {?object} knownStats - Known WebRTC statistics
 * @param {?object} unknownStats - Unkown WebRTC statistics
 * @returns ?object
 */
function packageStats(knownStats, unknownStats) {
  var stats = null;
  if (!empty(knownStats)) {
    stats = stats || {};
    stats.known = knownStats;
  }
  if (!empty(unknownStats)) {
    stats = stats || {};
    stats.unknown = unknownStats;
  }
  return stats;
}

/**
 * Given a list of objects containing known and/or unknown WebRTC statistics,
 * return only the known statistics.
 * @param {Array} stats - A list of objects containing known and/or unknown
 *                        WebRTC statistics
 * @returns Array
 */
function filterKnownStats(stats) {
  var knownStats = [];
  for (var i = 0; i < stats.length; i++) {
    var stat = stats[i];
    if (stat.known) {
      knownStats.push(stat.known);
    }
  }
  return knownStats;
}

/**
 * Check if an object is "empty" in the sense that it contains no keys.
 * @param {?object} obj - The object to check
 * @returns boolean
 */
function empty(obj) {
  if (!obj) {
    return true;
  }
  /* eslint no-unused-vars:0 */
  for (var key in obj) {
    return false;
  }
  return true;
}

/**
 * Given a function that takes a callback as its final argument, fix that final
 * argument to the provided callback.
 * @param {function} function - The function
 * @param {function} callback - The callback
 * @returns function
 */
function chainCallback(func, callback) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    args.push(callback);
    return func.apply(null, args);
  };
}

function convertToGatewayFormat(stats) {
  var formatted = {
    ssrc: stats.ssrc,
    media: stats.media,
    direction: stats.direction,
    codecName: stats.codecName,
    packets: {
      lost: stats.packetsLost,
      recvtot: stats.packetsReceived,
      senttot: stats.packetsSent
    },
    bytes: {
      recvtot: stats.bytesReceived,
      senttot: stats.bytesSent
    },
    jitter: stats.jitter,
    rtt: stats.rtt
  };
  if ('audioInputLevel' in stats || 'audioOutputLevel' in stats) {
    formatted.audio = {
      inlvl: stats.audioInputLevel,
      outlvl: stats.audioOutputLevel
    };
  }
  if ('fps' in stats || 'width' in stats || 'height' in stats) {
    formatted.video = {
      fps: stats.fps,
      width: stats.width,
      height: stats.height
    };
  }
  return formatted;
}

function setProp() {
  var args = [].slice.call(arguments, 0);
  var obj = args[0];
  var keys = args.slice(1, args.length - 1);
  var value = args[args.length - 1];

  var focus = obj;
  keys.forEach(function(key, i) {
    var val = i === keys.length - 1 ? value : {};
    focus = focus[key] = focus[key] || val;
  });
  return obj;
}

module.exports = getStatistics;

},{}],39:[function(require,module,exports){
'use strict';

/**
 * This function is very similar to <code>navigator.getUserMedia</code> except
 * that it does not use callbacks and returns a Promise for a MediaStream
 * @function getUserMedia
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}] - the
 *   MediaStreamConstraints object specifying what kind of LocalMediaStream to
 *   request from the browser (by default both audio and video)
 * @returns Promise<MediaStream>
 */
function getUserMedia(constraints) {
  return new Promise(function getUserMediaPromise(resolve, reject) {
    _getUserMedia(constraints || { audio: true, video: true }, resolve, reject);
  });
}

function _getUserMedia(constraints, onSuccess, onFailure) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      navigator.webkitGetUserMedia(constraints, onSuccess, onFailure);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      navigator.mozGetUserMedia(constraints, onSuccess, onFailure);
    }
    return;
  }
  onFailure(new Error('getUserMedia is not supported'));
}

module.exports = getUserMedia;

},{}],40:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":41,"ieee754":42,"isarray":43}],41:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],42:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],43:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],44:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],45:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],46:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],47:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],48:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":47,"_process":46,"inherits":45}],49:[function(require,module,exports){
arguments[4][15][0].apply(exports,arguments)
},{"dup":15,"events":44,"util":48}],50:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"./twilioerror":52,"dup":30}],51:[function(require,module,exports){
'use strict';

/**
 * Get a parameter from a Content-Type.
 * @param {string} contentType - the Content-Type
 * @param {string} attribute - the attribute to get
 * @returns {?string}
 */
function getContentTypeParameter(contentType, _attribute) {
  var parameters = contentType.split(';').slice(1);
  for (var i = 0; i < parameters.length; i++) {
    var parameter = parameters[i];

    var indexOfEqual = parameter.indexOf('=');
    if (indexOfEqual === -1) {
      continue;
    }

    var attribute = parameter
      .slice(0, indexOfEqual)
      .replace(/^ */, '')
      .replace(/ *$/, '');
    if (attribute !== _attribute) {
      continue;
    }

    var value = parameter
      .slice(indexOfEqual + 1)
      .replace(/^ */, '')
      .replace(/ *$/, '');

    var escaped = value.match(/^"(.*)"$/);
    if (escaped) {
      return escaped[1].replace(/\\"/, '"');
    }
    return value;
  }
  return null;
}

/**
 * Parse a multipart message.
 * @param {string} contentType
 * @param {string} body
 * @returns {Array<Part>}
 */
function parse(contentType, body) {
  var boundary = getContentTypeParameter(contentType, 'boundary');
  if (!boundary) {
    return [];
  }

  var delimeter = '\r\n--' + boundary;
  var parts = ('\r\n' + body).split(delimeter);

  // Ignore the prologue and epilogue.
  parts = parts.slice(1, parts.length - 1);

  var parsed = [];
  parts.forEach(function(part) {
    var match = part.match(/\r\nContent-Type: (.*)\r\n/);
    if (!match) {
      return;
    }

    var contentType = match[1]
      .replace(/^ */, '')
      .replace(/ *$/, '');

    var startOfBody = part.indexOf('\r\n\r\n');
    if (startOfBody === -1) {
      return;
    }

    var body = part.slice(startOfBody + 4);
    parsed.push({
      contentType: contentType,
      body: body
    });
  });
  return parsed;
}

/**
 * Get the body of the first part matching the Content-Type.
 * @param {string} contentType
 * @param {Array<Part>} parts
 * @returns {?string}
 */
function getPart(contentType, parts) {
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.contentType === contentType) {
      return part.body;
    } else if (/^multipart\//.test(part.contentType)) {
      var sdp = getPart(contentType, parse(part.contentType, part.body));
      if (sdp) {
        return sdp;
      }
    }
  }
  return null;
}

/**
 * Get the first Conversation Info, if any, out of a "multipart" body.
 * @param {Array<Part>} parts
 * @returns {?string}
 */
var getConversationInfo = getPart.bind(null, 'application/conversation-info+json');

/**
 * Get the first SDP, if any, out of a "multipart" body.
 * @param {Array<Part>} parts
 * @returns {?string}
 */
var getSDP = getPart.bind(null, 'application/sdp');

/**
 * A single part in a multipart message.
 * @typedef {object} Part
 * @property {string} contentType - the Content-Type of the part
 * @property {string} body - the part's body
 */

module.exports.getConversationInfo = getConversationInfo;
module.exports.getSDP = getSDP;
module.exports.parse = parse;

},{}],52:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36,"util":48}],53:[function(require,module,exports){
module.exports={
  "name": "sip.js",
  "title": "SIP.js",
  "description": "A simple, intuitive, and powerful JavaScript signaling library",
  "version": "0.7.1",
  "main": "src/index.js",
  "browser": {
    "./src/environment.js": "./src/environment_browser.js"
  },
  "homepage": "http://sipjs.com",
  "author": {
    "name": "Will Mitchell",
    "email": "will@onsip.com"
  },
  "contributors": [
    {
      "url": "http://sipjs.com/authors/"
    }
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/onsip/SIP.js.git"
  },
  "keywords": [
    "sip",
    "websocket",
    "webrtc",
    "library",
    "javascript"
  ],
  "devDependencies": {
    "beefy": "^2.1.5",
    "browserify": "^4.1.8",
    "grunt": "~0.4.0",
    "grunt-browserify": "^2.1.0",
    "grunt-cli": "~0.1.6",
    "grunt-contrib-copy": "^0.5.0",
    "grunt-contrib-jasmine": "~0.8.0",
    "grunt-contrib-jshint": ">0.5.0",
    "grunt-contrib-uglify": "~0.2.0",
    "grunt-peg": "~1.3.1",
    "grunt-trimtrailingspaces": "^0.4.0"
  },
  "engines": {
    "node": ">=0.8"
  },
  "license": "MIT",
  "scripts": {
    "repl": "beefy test/repl.js --open",
    "postinstall": "cd src/Grammar && mkdir -p dist && pegjs --extra-options-file peg.json src/Grammar.pegjs dist/Grammar.js",
    "test": "grunt travis --verbose"
  },
  "dependencies": {
    "pegjs": "^0.8.0",
    "ws": "^0.6.4",
    "promiscuous": "^0.6.0"
  },
  "optionalDependencies": {
    "promiscuous": "^0.6.0"
  },
  "gitHead": "4e74f060191cdc8657737fdc7947af5eff871a4b",
  "readme": "# SIP.js\n\n[![Build Status](https://travis-ci.org/onsip/SIP.js.png?branch=master)](https://travis-ci.org/onsip/SIP.js)\n\nA JavaScript SIP stack for WebRTC, instant messaging, and more!\n\n\n## Website and Documentation\n\n* [SIPjs.com](http://sipjs.com)\n* [Mailing List](https://groups.google.com/forum/#!forum/sip_js)\n* [Issue Tracking](https://github.com/onsip/sip.js/issues)\n\n\n## Download\n\n* [sipjs.com/download](http://sipjs.com/download/)\n* Bower: `bower install sip.js`\n* npm: `npm install sip.js`\n\n## Authors\n\n### Will Mitchell\n\n* Lead Developer\n* <will@onsip.com>\n* /wakamoleguy on [GitHub](http://github.com/wakamoleguy), [Twitter](http://twitter.com/wakamoleguy)\n\n### James Criscuolo\n\n* <james@onsip.com>\n\n### Eric Green\n\n* <eric.green@onsip.com>\n\n### Joseph Frazier\n\n* <joseph@onsip.com>\n\n### JsSIP Authors\n\nSIP.js contains substantial portions of the JsSIP software. JsSIP's authors at time of fork are listed below. For up to date information about JsSIP, please visit [jssip.net](http://jssip.net)\n\n* José Luis Millán\n* Iñaki Baz Castillo\n* Saúl Ibarra Corretgé\n\n## License\n\nSIP.js is released under the [MIT license](http://sipjs.com/license).\n\nSIP.js contains substantial portions of the JsSIP software, under the following license:\n\n~~~\nCopyright (c) 2012-2013 José Luis Millán - Versatica <http://www.versatica.com>\n\nPermission is hereby granted, free of charge, to any person obtaining\na copy of this software and associated documentation files (the\n\"Software\"), to deal in the Software without restriction, including\nwithout limitation the rights to use, copy, modify, merge, publish,\ndistribute, sublicense, and/or sell copies of the Software, and to\npermit persons to whom the Software is furnished to do so, subject to\nthe following conditions:\n\nThe above copyright notice and this permission notice shall be\nincluded in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\nNONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\nLIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\nOF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\nWITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n~~~\n",
  "readmeFilename": "README.md",
  "bugs": {
    "url": "https://github.com/onsip/SIP.js/issues"
  },
  "_id": "sip.js@0.7.1",
  "_shasum": "7f1aac61d036ea13ca92ab6761b7687bec82d7bb",
  "_from": "git+https://github.com/twilio/SIP.js.git#4e74f060191cdc8657737fdc7947af5eff871a4b",
  "_resolved": "git+https://github.com/twilio/SIP.js.git#4e74f060191cdc8657737fdc7947af5eff871a4b"
}

},{}],54:[function(require,module,exports){
"use strict";
module.exports = function (SIP) {
var ClientContext;

ClientContext = function (ua, method, target, options) {
  var originalTarget = target;

  // Validate arguments
  if (target === undefined) {
    throw new TypeError('Not enough arguments');
  }

  this.ua = ua;
  this.logger = ua.getLogger('sip.clientcontext');
  this.method = method;
  target = ua.normalizeTarget(target);
  if (!target) {
    throw new TypeError('Invalid target: ' + originalTarget);
  }

  /* Options
   * - extraHeaders
   * - params
   * - contentType
   * - body
   */
  options = Object.create(options || Object.prototype);
  options.extraHeaders = (options.extraHeaders || []).slice();

  if (options.contentType) {
    this.contentType = options.contentType;
    options.extraHeaders.push('Content-Type: ' + this.contentType);
  }

  // Build the request
  this.request = new SIP.OutgoingRequest(this.method,
                                         target,
                                         this.ua,
                                         options.params,
                                         options.extraHeaders);
  if (options.body) {
    this.body = options.body;
    this.request.body = this.body;
  }

  /* Set other properties from the request */
  this.localIdentity = this.request.from;
  this.remoteIdentity = this.request.to;

  this.data = {};
};
ClientContext.prototype = Object.create(SIP.EventEmitter.prototype);

ClientContext.prototype.send = function () {
  (new SIP.RequestSender(this, this.ua)).send();
  return this;
};

ClientContext.prototype.cancel = function (options) {
  options = options || {};

  var cancel_reason = SIP.Utils.getCancelReason(options.status_code, options.reason_phrase);
  this.request.cancel(cancel_reason);

  this.emit('cancel');
};

ClientContext.prototype.receiveResponse = function (response) {
  var cause = SIP.Utils.getReasonPhrase(response.status_code);

  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      this.emit('progress', response, cause);
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      if(this.ua.applicants[this]) {
        delete this.ua.applicants[this];
      }
      this.emit('accepted', response, cause);
      break;

    default:
      if(this.ua.applicants[this]) {
        delete this.ua.applicants[this];
      }
      this.emit('rejected', response, cause);
      this.emit('failed', response, cause);
      break;
  }

};

ClientContext.prototype.onRequestTimeout = function () {
  this.emit('failed', null, SIP.C.causes.REQUEST_TIMEOUT);
};

ClientContext.prototype.onTransportError = function () {
  this.emit('failed', null, SIP.C.causes.CONNECTION_ERROR);
};

SIP.ClientContext = ClientContext;
};

},{}],55:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Constants
 */

/**
 * SIP Constants.
 * @augments SIP
 */

module.exports = function (name, version) {
return {
  USER_AGENT: name +'/'+ version,

  // SIP scheme
  SIP:  'sip',
  SIPS: 'sips',

  // End and Failure causes
  causes: {
    // Generic error causes
    CONNECTION_ERROR:         'Connection Error',
    REQUEST_TIMEOUT:          'Request Timeout',
    SIP_FAILURE_CODE:         'SIP Failure Code',
    INTERNAL_ERROR:           'Internal Error',

    // SIP error causes
    BUSY:                     'Busy',
    REJECTED:                 'Rejected',
    REDIRECTED:               'Redirected',
    UNAVAILABLE:              'Unavailable',
    NOT_FOUND:                'Not Found',
    ADDRESS_INCOMPLETE:       'Address Incomplete',
    INCOMPATIBLE_SDP:         'Incompatible SDP',
    AUTHENTICATION_ERROR:     'Authentication Error',
    DIALOG_ERROR:             'Dialog Error',

    // Session error causes
    WEBRTC_NOT_SUPPORTED:     'WebRTC Not Supported',
    WEBRTC_ERROR:             'WebRTC Error',
    CANCELED:                 'Canceled',
    NO_ANSWER:                'No Answer',
    EXPIRES:                  'Expires',
    NO_ACK:                   'No ACK',
    NO_PRACK:                 'No PRACK',
    USER_DENIED_MEDIA_ACCESS: 'User Denied Media Access',
    BAD_MEDIA_DESCRIPTION:    'Bad Media Description',
    RTP_TIMEOUT:              'RTP Timeout'
  },

  supported: {
    UNSUPPORTED:        'none',
    SUPPORTED:          'supported',
    REQUIRED:           'required'
  },

  SIP_ERROR_CAUSES: {
    REDIRECTED: [300,301,302,305,380],
    BUSY: [486,600],
    REJECTED: [403,603],
    NOT_FOUND: [404,604],
    UNAVAILABLE: [480,410,408,430],
    ADDRESS_INCOMPLETE: [484],
    INCOMPATIBLE_SDP: [488,606],
    AUTHENTICATION_ERROR:[401,407]
  },

  // SIP Methods
  ACK:        'ACK',
  BYE:        'BYE',
  CANCEL:     'CANCEL',
  INFO:       'INFO',
  INVITE:     'INVITE',
  MESSAGE:    'MESSAGE',
  NOTIFY:     'NOTIFY',
  OPTIONS:    'OPTIONS',
  REGISTER:   'REGISTER',
  UPDATE:     'UPDATE',
  SUBSCRIBE:  'SUBSCRIBE',
  REFER:      'REFER',
  PRACK:      'PRACK',

  /* SIP Response Reasons
   * DOC: http://www.iana.org/assignments/sip-parameters
   * Copied from https://github.com/versatica/OverSIP/blob/master/lib/oversip/sip/constants.rb#L7
   */
  REASON_PHRASE: {
    100: 'Trying',
    180: 'Ringing',
    181: 'Call Is Being Forwarded',
    182: 'Queued',
    183: 'Session Progress',
    199: 'Early Dialog Terminated',  // draft-ietf-sipcore-199
    200: 'OK',
    202: 'Accepted',  // RFC 3265
    204: 'No Notification',  //RFC 5839
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Moved Temporarily',
    305: 'Use Proxy',
    380: 'Alternative Service',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    410: 'Gone',
    412: 'Conditional Request Failed',  // RFC 3903
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Unsupported URI Scheme',
    417: 'Unknown Resource-Priority',  // RFC 4412
    420: 'Bad Extension',
    421: 'Extension Required',
    422: 'Session Interval Too Small',  // RFC 4028
    423: 'Interval Too Brief',
    428: 'Use Identity Header',  // RFC 4474
    429: 'Provide Referrer Identity',  // RFC 3892
    430: 'Flow Failed',  // RFC 5626
    433: 'Anonymity Disallowed',  // RFC 5079
    436: 'Bad Identity-Info',  // RFC 4474
    437: 'Unsupported Certificate',  // RFC 4744
    438: 'Invalid Identity Header',  // RFC 4744
    439: 'First Hop Lacks Outbound Support',  // RFC 5626
    440: 'Max-Breadth Exceeded',  // RFC 5393
    469: 'Bad Info Package',  // draft-ietf-sipcore-info-events
    470: 'Consent Needed',  // RFC 5360
    478: 'Unresolvable Destination',  // Custom code copied from Kamailio.
    480: 'Temporarily Unavailable',
    481: 'Call/Transaction Does Not Exist',
    482: 'Loop Detected',
    483: 'Too Many Hops',
    484: 'Address Incomplete',
    485: 'Ambiguous',
    486: 'Busy Here',
    487: 'Request Terminated',
    488: 'Not Acceptable Here',
    489: 'Bad Event',  // RFC 3265
    491: 'Request Pending',
    493: 'Undecipherable',
    494: 'Security Agreement Required',  // RFC 3329
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Server Time-out',
    505: 'Version Not Supported',
    513: 'Message Too Large',
    580: 'Precondition Failure',  // RFC 3312
    600: 'Busy Everywhere',
    603: 'Decline',
    604: 'Does Not Exist Anywhere',
    606: 'Not Acceptable'
  },

  /* SIP Option Tags
   * DOC: http://www.iana.org/assignments/sip-parameters/sip-parameters.xhtml#sip-parameters-4
   */
  OPTION_TAGS: {
    '100rel':                   true,  // RFC 3262
    199:                        true,  // RFC 6228
    answermode:                 true,  // RFC 5373
    'early-session':            true,  // RFC 3959
    eventlist:                  true,  // RFC 4662
    explicitsub:                true,  // RFC-ietf-sipcore-refer-explicit-subscription-03
    'from-change':              true,  // RFC 4916
    'geolocation-http':         true,  // RFC 6442
    'geolocation-sip':          true,  // RFC 6442
    gin:                        true,  // RFC 6140
    gruu:                       true,  // RFC 5627
    histinfo:                   true,  // RFC 7044
    ice:                        true,  // RFC 5768
    join:                       true,  // RFC 3911
    'multiple-refer':           true,  // RFC 5368
    norefersub:                 true,  // RFC 4488
    nosub:                      true,  // RFC-ietf-sipcore-refer-explicit-subscription-03
    outbound:                   true,  // RFC 5626
    path:                       true,  // RFC 3327
    policy:                     true,  // RFC 6794
    precondition:               true,  // RFC 3312
    pref:                       true,  // RFC 3840
    privacy:                    true,  // RFC 3323
    'recipient-list-invite':    true,  // RFC 5366
    'recipient-list-message':   true,  // RFC 5365
    'recipient-list-subscribe': true,  // RFC 5367
    replaces:                   true,  // RFC 3891
    'resource-priority':        true,  // RFC 4412
    'sdp-anat':                 true,  // RFC 4092
    'sec-agree':                true,  // RFC 3329
    tdialog:                    true,  // RFC 4538
    timer:                      true,  // RFC 4028
    uui:                        true   // RFC 7433
  }
};
};

},{}],56:[function(require,module,exports){
"use strict";

/**
 * @fileoverview In-Dialog Request Sender
 */

/**
 * @augments SIP.Dialog
 * @class Class creating an In-dialog request sender.
 * @param {SIP.Dialog} dialog
 * @param {Object} applicant
 * @param {SIP.OutgoingRequest} request
 */
/**
 * @fileoverview in-Dialog Request Sender
 */

module.exports = function (SIP) {
var RequestSender;

RequestSender = function(dialog, applicant, request) {

  this.dialog = dialog;
  this.applicant = applicant;
  this.request = request;

  // RFC3261 14.1 Modifying an Existing Session. UAC Behavior.
  this.reattempt = false;
  this.reattemptTimer = null;
};

RequestSender.prototype = {
  send: function() {
    var self = this,
      request_sender = new SIP.RequestSender(this, this.dialog.owner.ua);

      request_sender.send();

    // RFC3261 14.2 Modifying an Existing Session -UAC BEHAVIOR-
    if (this.request.method === SIP.C.INVITE && request_sender.clientTransaction.state !== SIP.Transactions.C.STATUS_TERMINATED) {
      this.dialog.uac_pending_reply = true;
      request_sender.clientTransaction.on('stateChanged', function stateChanged(){
        if (this.state === SIP.Transactions.C.STATUS_ACCEPTED ||
            this.state === SIP.Transactions.C.STATUS_COMPLETED ||
            this.state === SIP.Transactions.C.STATUS_TERMINATED) {

          this.removeListener('stateChanged', stateChanged);
          self.dialog.uac_pending_reply = false;

          if (self.dialog.uas_pending_reply === false) {
            self.dialog.owner.onReadyToReinvite();
          }
        }
      });
    }
  },

  onRequestTimeout: function() {
    this.applicant.onRequestTimeout();
  },

  onTransportError: function() {
    this.applicant.onTransportError();
  },

  receiveResponse: function(response) {
    var self = this;

    // RFC3261 12.2.1.2 408 or 481 is received for a request within a dialog.
    if (response.status_code === 408 || response.status_code === 481) {
      this.applicant.onDialogError(response);
    } else if (response.method === SIP.C.INVITE && response.status_code === 491) {
      if (this.reattempt) {
        this.applicant.receiveResponse(response);
      } else {
        this.request.cseq.value = this.dialog.local_seqnum += 1;
        this.reattemptTimer = SIP.Timers.setTimeout(
          function() {
            if (self.applicant.owner.status !== SIP.Session.C.STATUS_TERMINATED) {
              self.reattempt = true;
              self.request_sender.send();
            }
          },
          this.getReattemptTimeout()
        );
      }
    } else {
      this.applicant.receiveResponse(response);
    }
  }
};

return RequestSender;
};

},{}],57:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Dialog
 */

/**
 * @augments SIP
 * @class Class creating a SIP dialog.
 * @param {SIP.RTCSession} owner
 * @param {SIP.IncomingRequest|SIP.IncomingResponse} message
 * @param {Enum} type UAC / UAS
 * @param {Enum} state SIP.Dialog.C.STATUS_EARLY / SIP.Dialog.C.STATUS_CONFIRMED
 */
module.exports = function (SIP) {

var RequestSender = require('./Dialog/RequestSender')(SIP);

var Dialog,
  C = {
    // Dialog states
    STATUS_EARLY:       1,
    STATUS_CONFIRMED:   2
  };

// RFC 3261 12.1
Dialog = function(owner, message, type, state) {
  var contact;

  this.uac_pending_reply = false;
  this.uas_pending_reply = false;

  if(!message.hasHeader('contact')) {
    return {
      error: 'unable to create a Dialog without Contact header field'
    };
  }

  if(message instanceof SIP.IncomingResponse) {
    state = (message.status_code < 200) ? C.STATUS_EARLY : C.STATUS_CONFIRMED;
  } else {
    // Create confirmed dialog if state is not defined
    state = state || C.STATUS_CONFIRMED;
  }

  contact = message.parseHeader('contact');

  // RFC 3261 12.1.1
  if(type === 'UAS') {
    this.id = {
      call_id: message.call_id,
      local_tag: message.to_tag,
      remote_tag: message.from_tag,
      toString: function() {
        return this.call_id + this.local_tag + this.remote_tag;
      }
    };
    this.state = state;
    this.remote_seqnum = message.cseq;
    this.local_uri = message.parseHeader('to').uri;
    this.remote_uri = message.parseHeader('from').uri;
    this.remote_target = contact.uri;
    this.route_set = message.getHeaders('record-route');
    this.invite_seqnum = message.cseq;
    this.local_seqnum = message.cseq;
  }
  // RFC 3261 12.1.2
  else if(type === 'UAC') {
    this.id = {
      call_id: message.call_id,
      local_tag: message.from_tag,
      remote_tag: message.to_tag,
      toString: function() {
        return this.call_id + this.local_tag + this.remote_tag;
      }
    };
    this.state = state;
    this.invite_seqnum = message.cseq;
    this.local_seqnum = message.cseq;
    this.local_uri = message.parseHeader('from').uri;
    this.pracked = [];
    this.remote_uri = message.parseHeader('to').uri;
    this.remote_target = contact.uri;
    this.route_set = message.getHeaders('record-route').reverse();

    //RENDERBODY
    if (this.state === C.STATUS_EARLY && (!owner.hasOffer)) {
      this.mediaHandler = owner.mediaHandlerFactory(owner);
    }
  }

  this.logger = owner.ua.getLogger('sip.dialog', this.id.toString());
  this.owner = owner;
  owner.ua.dialogs[this.id.toString()] = this;
  this.logger.log('new ' + type + ' dialog created with status ' + (this.state === C.STATUS_EARLY ? 'EARLY': 'CONFIRMED'));
  owner.emit('dialog', this);
};

Dialog.prototype = {
  /**
   * @param {SIP.IncomingMessage} message
   * @param {Enum} UAC/UAS
   */
  update: function(message, type) {
    this.state = C.STATUS_CONFIRMED;

    this.logger.log('dialog '+ this.id.toString() +'  changed to CONFIRMED state');

    if(type === 'UAC') {
      // RFC 3261 13.2.2.4
      this.route_set = message.getHeaders('record-route').reverse();
    }
  },

  terminate: function() {
    this.logger.log('dialog ' + this.id.toString() + ' deleted');
    if (this.mediaHandler && this.state !== C.STATUS_CONFIRMED) {
      this.mediaHandler.peerConnection.close();
    }
    delete this.owner.ua.dialogs[this.id.toString()];
  },

  /**
  * @param {String} method request method
  * @param {Object} extraHeaders extra headers
  * @returns {SIP.OutgoingRequest}
  */

  // RFC 3261 12.2.1.1
  createRequest: function(method, extraHeaders, body) {
    var cseq, request;
    extraHeaders = (extraHeaders || []).slice();

    if(!this.local_seqnum) { this.local_seqnum = Math.floor(Math.random() * 10000); }

    cseq = (method === SIP.C.CANCEL || method === SIP.C.ACK) ? this.invite_seqnum : this.local_seqnum += 1;

    request = new SIP.OutgoingRequest(
      method,
      this.remote_target,
      this.owner.ua, {
        'cseq': cseq,
        'call_id': this.id.call_id,
        'from_uri': this.local_uri,
        'from_tag': this.id.local_tag,
        'to_uri': this.remote_uri,
        'to_tag': this.id.remote_tag,
        'route_set': this.route_set
      }, extraHeaders, body);

    request.dialog = this;

    return request;
  },

  /**
  * @param {SIP.IncomingRequest} request
  * @returns {Boolean}
  */

  // RFC 3261 12.2.2
  checkInDialogRequest: function(request) {
    var self = this;

    if(!this.remote_seqnum) {
      this.remote_seqnum = request.cseq;
    } else if(request.cseq < this.remote_seqnum) {
        //Do not try to reply to an ACK request.
        if (request.method !== SIP.C.ACK) {
          request.reply(500);
        }
        if (request.cseq === this.invite_seqnum) {
          return true;
        }
        return false;
    } else if(request.cseq > this.remote_seqnum) {
      this.remote_seqnum = request.cseq;
    }

    switch(request.method) {
      // RFC3261 14.2 Modifying an Existing Session -UAS BEHAVIOR-
      case SIP.C.INVITE:
        if (this.uac_pending_reply === true) {
          request.reply(491);
        } else if (this.uas_pending_reply === true) {
          var retryAfter = (Math.random() * 10 | 0) + 1;
          request.reply(500, null, ['Retry-After:' + retryAfter]);
          return false;
        } else {
          this.uas_pending_reply = true;
          request.server_transaction.on('stateChanged', function stateChanged(){
            if (this.state === SIP.Transactions.C.STATUS_ACCEPTED ||
                this.state === SIP.Transactions.C.STATUS_COMPLETED ||
                this.state === SIP.Transactions.C.STATUS_TERMINATED) {

              this.removeListener('stateChanged', stateChanged);
              self.uas_pending_reply = false;

              if (self.uac_pending_reply === false) {
                self.owner.onReadyToReinvite();
              }
            }
          });
        }

        // RFC3261 12.2.2 Replace the dialog`s remote target URI if the request is accepted
        if(request.hasHeader('contact')) {
          request.server_transaction.on('stateChanged', function(){
            if (this.state === SIP.Transactions.C.STATUS_ACCEPTED) {
              self.remote_target = request.parseHeader('contact').uri;
            }
          });
        }
        break;
      case SIP.C.NOTIFY:
        // RFC6665 3.2 Replace the dialog`s remote target URI if the request is accepted
        if(request.hasHeader('contact')) {
          request.server_transaction.on('stateChanged', function(){
            if (this.state === SIP.Transactions.C.STATUS_COMPLETED) {
              self.remote_target = request.parseHeader('contact').uri;
            }
          });
        }
        break;
    }

    return true;
  },

  sendRequest: function(applicant, method, options) {
    options = options || {};

    var
      extraHeaders = (options.extraHeaders || []).slice(),
      body = options.body || null,
      request = this.createRequest(method, extraHeaders, body),
      request_sender = new RequestSender(this, applicant, request);

    request_sender.send();

    return request;
  },

  /**
  * @param {SIP.IncomingRequest} request
  */
  receiveRequest: function(request) {
    //Check in-dialog request
    if(!this.checkInDialogRequest(request)) {
      return;
    }

    this.owner.receiveRequest(request);
  }
};

Dialog.C = C;
SIP.Dialog = Dialog;
};

},{"./Dialog/RequestSender":56}],58:[function(require,module,exports){
"use strict";

/**
 * @fileoverview SIP Digest Authentication
 */

/**
 * SIP Digest Authentication.
 * @augments SIP.
 * @function Digest Authentication
 * @param {SIP.UA} ua
 */
module.exports = function (Utils) {
var DigestAuthentication;

DigestAuthentication = function(ua) {
  this.logger = ua.getLogger('sipjs.digestauthentication');
  this.username = ua.configuration.authorizationUser;
  this.password = ua.configuration.password;
  this.cnonce = null;
  this.nc = 0;
  this.ncHex = '00000000';
  this.response = null;
};


/**
* Performs Digest authentication given a SIP request and the challenge
* received in a response to that request.
* Returns true if credentials were successfully generated, false otherwise.
*
* @param {SIP.OutgoingRequest} request
* @param {Object} challenge
*/
DigestAuthentication.prototype.authenticate = function(request, challenge) {
  // Inspect and validate the challenge.

  this.algorithm = challenge.algorithm;
  this.realm = challenge.realm;
  this.nonce = challenge.nonce;
  this.opaque = challenge.opaque;
  this.stale = challenge.stale;

  if (this.algorithm) {
    if (this.algorithm !== 'MD5') {
      this.logger.warn('challenge with Digest algorithm different than "MD5", authentication aborted');
      return false;
    }
  } else {
    this.algorithm = 'MD5';
  }

  if (! this.realm) {
    this.logger.warn('challenge without Digest realm, authentication aborted');
    return false;
  }

  if (! this.nonce) {
    this.logger.warn('challenge without Digest nonce, authentication aborted');
    return false;
  }

  // 'qop' can contain a list of values (Array). Let's choose just one.
  if (challenge.qop) {
    if (challenge.qop.indexOf('auth') > -1) {
      this.qop = 'auth';
    } else if (challenge.qop.indexOf('auth-int') > -1) {
      this.qop = 'auth-int';
    } else {
      // Otherwise 'qop' is present but does not contain 'auth' or 'auth-int', so abort here.
      this.logger.warn('challenge without Digest qop different than "auth" or "auth-int", authentication aborted');
      return false;
    }
  } else {
    this.qop = null;
  }

  // Fill other attributes.

  this.method = request.method;
  this.uri = request.ruri;
  this.cnonce = Utils.createRandomToken(12);
  this.nc += 1;
  this.updateNcHex();

  // nc-value = 8LHEX. Max value = 'FFFFFFFF'.
  if (this.nc === 4294967296) {
    this.nc = 1;
    this.ncHex = '00000001';
  }

  // Calculate the Digest "response" value.
  this.calculateResponse();

  return true;
};


/**
* Generate Digest 'response' value.
* @private
*/
DigestAuthentication.prototype.calculateResponse = function() {
  var ha1, ha2;

  // HA1 = MD5(A1) = MD5(username:realm:password)
  ha1 = Utils.calculateMD5(this.username + ":" + this.realm + ":" + this.password);

  if (this.qop === 'auth') {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = Utils.calculateMD5(this.method + ":" + this.uri);
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = Utils.calculateMD5(ha1 + ":" + this.nonce + ":" + this.ncHex + ":" + this.cnonce + ":auth:" + ha2);

  } else if (this.qop === 'auth-int') {
    // HA2 = MD5(A2) = MD5(method:digestURI:MD5(entityBody))
    ha2 = Utils.calculateMD5(this.method + ":" + this.uri + ":" + Utils.calculateMD5(this.body ? this.body : ""));
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = Utils.calculateMD5(ha1 + ":" + this.nonce + ":" + this.ncHex + ":" + this.cnonce + ":auth-int:" + ha2);

  } else if (this.qop === null) {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = Utils.calculateMD5(this.method + ":" + this.uri);
    // response = MD5(HA1:nonce:HA2)
    this.response = Utils.calculateMD5(ha1 + ":" + this.nonce + ":" + ha2);
  }
};


/**
* Return the Proxy-Authorization or WWW-Authorization header value.
*/
DigestAuthentication.prototype.toString = function() {
  var auth_params = [];

  if (! this.response) {
    throw new Error('response field does not exist, cannot generate Authorization header');
  }

  auth_params.push('algorithm=' + this.algorithm);
  auth_params.push('username="' + this.username + '"');
  auth_params.push('realm="' + this.realm + '"');
  auth_params.push('nonce="' + this.nonce + '"');
  auth_params.push('uri="' + this.uri + '"');
  auth_params.push('response="' + this.response + '"');
  if (this.opaque) {
    auth_params.push('opaque="' + this.opaque + '"');
  }
  if (this.qop) {
    auth_params.push('qop=' + this.qop);
    auth_params.push('cnonce="' + this.cnonce + '"');
    auth_params.push('nc=' + this.ncHex);
  }

  return 'Digest ' + auth_params.join(', ');
};


/**
* Generate the 'nc' value as required by Digest in this.ncHex by reading this.nc.
* @private
*/
DigestAuthentication.prototype.updateNcHex = function() {
  var hex = Number(this.nc).toString(16);
  this.ncHex = '00000000'.substr(0, 8-hex.length) + hex;
};

return DigestAuthentication;
};

},{}],59:[function(require,module,exports){
"use strict";
var NodeEventEmitter = require('events').EventEmitter;

module.exports = function (console) {

// Don't use `new SIP.EventEmitter()` for inheriting.
// Use Object.create(SIP.EventEmitter.prototoype);
function EventEmitter () {
  NodeEventEmitter.call(this);
}

EventEmitter.prototype = Object.create(NodeEventEmitter.prototype, {
  constructor: {
    value: EventEmitter,
    enumerable: false,
    writable: true,
    configurable: true
  }
});

EventEmitter.prototype.off = function off (eventName, listener) {
  var warning = '';
  warning += 'SIP.EventEmitter#off is deprecated and may be removed in future SIP.js versions.\n';
  warning += 'Please use removeListener or removeAllListeners instead.\n';
  warning += 'See here for more details:\n';
  warning += 'http://nodejs.org/api/events.html#events_emitter_removelistener_event_listener';
  console.warn(warning);

  if (arguments.length < 2) {
    return this.removeAllListeners.apply(this, arguments);
  } else {
    return this.removeListener(eventName, listener);
  }
};

return EventEmitter;

};

},{"events":44}],60:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Exceptions
 */

/**
 * SIP Exceptions.
 * @augments SIP
 */
module.exports = {
  ConfigurationError: (function(){
    var exception = function(parameter, value) {
      this.code = 1;
      this.name = 'CONFIGURATION_ERROR';
      this.parameter = parameter;
      this.value = value;
      this.message = (!this.value)? 'Missing parameter: '+ this.parameter : 'Invalid value '+ JSON.stringify(this.value) +' for parameter "'+ this.parameter +'"';
    };
    exception.prototype = new Error();
    return exception;
  }()),

  InvalidStateError: (function(){
    var exception = function(status) {
      this.code = 2;
      this.name = 'INVALID_STATE_ERROR';
      this.status = status;
      this.message = 'Invalid status: ' + status;
    };
    exception.prototype = new Error();
    return exception;
  }()),

  NotSupportedError: (function(){
    var exception = function(message) {
      this.code = 3;
      this.name = 'NOT_SUPPORTED_ERROR';
      this.message = message;
    };
    exception.prototype = new Error();
    return exception;
  }()),

  GetDescriptionError: (function(){
    var exception = function(message) {
      this.code = 4;
      this.name = 'GET_DESCRIPTION_ERROR';
      this.message = message;
    };
    exception.prototype = new Error();
    return exception;
  }())
};

},{}],61:[function(require,module,exports){
"use strict";
var Grammar = require('./Grammar/dist/Grammar');

module.exports = function (SIP) {

return {
  parse: function parseCustom (input, startRule) {
    var options = {startRule: startRule, SIP: SIP};
    try {
      Grammar.parse(input, options);
    } catch (e) {
      options.data = -1;
    }
    return options.data;
  }
};

};

},{"./Grammar/dist/Grammar":62}],62:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleIndices = { Contact: 118, Name_Addr_Header: 155, Record_Route: 175, Request_Response: 81, SIP_URI: 45, Subscription_State: 185, Supported: 190, Require: 181, Via: 193, absoluteURI: 84, Call_ID: 117, Content_Disposition: 129, Content_Length: 134, Content_Type: 135, CSeq: 145, displayName: 121, Event: 148, From: 150, host: 52, Max_Forwards: 153, Min_SE: 212, Proxy_Authenticate: 156, quoted_string: 40, Refer_To: 177, Replaces: 178, Session_Expires: 209, stun_URI: 216, To: 191, turn_URI: 223, uuid: 226, WWW_Authenticate: 208, challenge: 157 },
        peg$startRuleIndex   = 118,

        peg$consts = [
          "\r\n",
          { type: "literal", value: "\r\n", description: "\"\\r\\n\"" },
          /^[0-9]/,
          { type: "class", value: "[0-9]", description: "[0-9]" },
          /^[a-zA-Z]/,
          { type: "class", value: "[a-zA-Z]", description: "[a-zA-Z]" },
          /^[0-9a-fA-F]/,
          { type: "class", value: "[0-9a-fA-F]", description: "[0-9a-fA-F]" },
          /^[\0-\xFF]/,
          { type: "class", value: "[\\0-\\xFF]", description: "[\\0-\\xFF]" },
          /^["]/,
          { type: "class", value: "[\"]", description: "[\"]" },
          " ",
          { type: "literal", value: " ", description: "\" \"" },
          "\t",
          { type: "literal", value: "\t", description: "\"\\t\"" },
          /^[a-zA-Z0-9]/,
          { type: "class", value: "[a-zA-Z0-9]", description: "[a-zA-Z0-9]" },
          ";",
          { type: "literal", value: ";", description: "\";\"" },
          "/",
          { type: "literal", value: "/", description: "\"/\"" },
          "?",
          { type: "literal", value: "?", description: "\"?\"" },
          ":",
          { type: "literal", value: ":", description: "\":\"" },
          "@",
          { type: "literal", value: "@", description: "\"@\"" },
          "&",
          { type: "literal", value: "&", description: "\"&\"" },
          "=",
          { type: "literal", value: "=", description: "\"=\"" },
          "+",
          { type: "literal", value: "+", description: "\"+\"" },
          "$",
          { type: "literal", value: "$", description: "\"$\"" },
          ",",
          { type: "literal", value: ",", description: "\",\"" },
          "-",
          { type: "literal", value: "-", description: "\"-\"" },
          "_",
          { type: "literal", value: "_", description: "\"_\"" },
          ".",
          { type: "literal", value: ".", description: "\".\"" },
          "!",
          { type: "literal", value: "!", description: "\"!\"" },
          "~",
          { type: "literal", value: "~", description: "\"~\"" },
          "*",
          { type: "literal", value: "*", description: "\"*\"" },
          "'",
          { type: "literal", value: "'", description: "\"'\"" },
          "(",
          { type: "literal", value: "(", description: "\"(\"" },
          ")",
          { type: "literal", value: ")", description: "\")\"" },
          peg$FAILED,
          "%",
          { type: "literal", value: "%", description: "\"%\"" },
          null,
          [],
          function() {return " "; },
          function() {return ':'; },
          /^[!-~]/,
          { type: "class", value: "[!-~]", description: "[!-~]" },
          /^[\x80-\uFFFF]/,
          { type: "class", value: "[\\x80-\\uFFFF]", description: "[\\x80-\\uFFFF]" },
          /^[\x80-\xBF]/,
          { type: "class", value: "[\\x80-\\xBF]", description: "[\\x80-\\xBF]" },
          /^[a-f]/,
          { type: "class", value: "[a-f]", description: "[a-f]" },
          "`",
          { type: "literal", value: "`", description: "\"`\"" },
          "<",
          { type: "literal", value: "<", description: "\"<\"" },
          ">",
          { type: "literal", value: ">", description: "\">\"" },
          "\\",
          { type: "literal", value: "\\", description: "\"\\\\\"" },
          "[",
          { type: "literal", value: "[", description: "\"[\"" },
          "]",
          { type: "literal", value: "]", description: "\"]\"" },
          "{",
          { type: "literal", value: "{", description: "\"{\"" },
          "}",
          { type: "literal", value: "}", description: "\"}\"" },
          function() {return "*"; },
          function() {return "/"; },
          function() {return "="; },
          function() {return "("; },
          function() {return ")"; },
          function() {return ">"; },
          function() {return "<"; },
          function() {return ","; },
          function() {return ";"; },
          function() {return ":"; },
          function() {return "\""; },
          /^[!-']/,
          { type: "class", value: "[!-']", description: "[!-']" },
          /^[*-[]/,
          { type: "class", value: "[*-[]", description: "[*-[]" },
          /^[\]-~]/,
          { type: "class", value: "[\\]-~]", description: "[\\]-~]" },
          function(contents) {
                                  return contents; },
          /^[#-[]/,
          { type: "class", value: "[#-[]", description: "[#-[]" },
          /^[\0-\t]/,
          { type: "class", value: "[\\0-\\t]", description: "[\\0-\\t]" },
          /^[\x0B-\f]/,
          { type: "class", value: "[\\x0B-\\f]", description: "[\\x0B-\\f]" },
          /^[\x0E-]/,
          { type: "class", value: "[\\x0E-]", description: "[\\x0E-]" },
          function() {
                                  options.data.uri = new options.SIP.URI(options.data.scheme, options.data.user, options.data.host, options.data.port);
                                  delete options.data.scheme;
                                  delete options.data.user;
                                  delete options.data.host;
                                  delete options.data.host_type;
                                  delete options.data.port;
                                },
          function() {
                                  options.data.uri = new options.SIP.URI(options.data.scheme, options.data.user, options.data.host, options.data.port, options.data.uri_params, options.data.uri_headers);
                                  delete options.data.scheme;
                                  delete options.data.user;
                                  delete options.data.host;
                                  delete options.data.host_type;
                                  delete options.data.port;
                                  delete options.data.uri_params;

                                  if (options.startRule === 'SIP_URI') { options.data = options.data.uri;}
                                },
          "sips",
          { type: "literal", value: "sips", description: "\"sips\"" },
          "sip",
          { type: "literal", value: "sip", description: "\"sip\"" },
          function(uri_scheme) {
                              options.data.scheme = uri_scheme; },
          function() {
                              options.data.user = decodeURIComponent(text().slice(0, -1));},
          function() {
                              options.data.password = text(); },
          function() {
                              options.data.host = text();
                              return options.data.host; },
          function() {
                            options.data.host_type = 'domain';
                            return text(); },
          /^[a-zA-Z0-9_\-]/,
          { type: "class", value: "[a-zA-Z0-9_\\-]", description: "[a-zA-Z0-9_\\-]" },
          /^[a-zA-Z0-9\-]/,
          { type: "class", value: "[a-zA-Z0-9\\-]", description: "[a-zA-Z0-9\\-]" },
          function() {
                              options.data.host_type = 'IPv6';
                              return text(); },
          "::",
          { type: "literal", value: "::", description: "\"::\"" },
          function() {
                            options.data.host_type = 'IPv6';
                            return text(); },
          function() {
                              options.data.host_type = 'IPv4';
                              return text(); },
          "25",
          { type: "literal", value: "25", description: "\"25\"" },
          /^[0-5]/,
          { type: "class", value: "[0-5]", description: "[0-5]" },
          "2",
          { type: "literal", value: "2", description: "\"2\"" },
          /^[0-4]/,
          { type: "class", value: "[0-4]", description: "[0-4]" },
          "1",
          { type: "literal", value: "1", description: "\"1\"" },
          /^[1-9]/,
          { type: "class", value: "[1-9]", description: "[1-9]" },
          function(port) {
                              port = parseInt(port.join(''));
                              options.data.port = port;
                              return port; },
          "transport=",
          { type: "literal", value: "transport=", description: "\"transport=\"" },
          "udp",
          { type: "literal", value: "udp", description: "\"udp\"" },
          "tcp",
          { type: "literal", value: "tcp", description: "\"tcp\"" },
          "sctp",
          { type: "literal", value: "sctp", description: "\"sctp\"" },
          "tls",
          { type: "literal", value: "tls", description: "\"tls\"" },
          function(transport) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['transport'] = transport.toLowerCase(); },
          "user=",
          { type: "literal", value: "user=", description: "\"user=\"" },
          "phone",
          { type: "literal", value: "phone", description: "\"phone\"" },
          "ip",
          { type: "literal", value: "ip", description: "\"ip\"" },
          function(user) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['user'] = user.toLowerCase(); },
          "method=",
          { type: "literal", value: "method=", description: "\"method=\"" },
          function(method) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['method'] = method; },
          "ttl=",
          { type: "literal", value: "ttl=", description: "\"ttl=\"" },
          function(ttl) {
                                if(!options.data.params) options.data.params={};
                                options.data.params['ttl'] = ttl; },
          "maddr=",
          { type: "literal", value: "maddr=", description: "\"maddr=\"" },
          function(maddr) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['maddr'] = maddr; },
          "lr",
          { type: "literal", value: "lr", description: "\"lr\"" },
          function() {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['lr'] = undefined; },
          function(param, value) {
                                if(!options.data.uri_params) options.data.uri_params = {};
                                if (value === null){
                                  value = undefined;
                                }
                                else {
                                  value = value[1];
                                }
                                options.data.uri_params[param.toLowerCase()] = value && value.toLowerCase();},
          function(hname, hvalue) {
                                hname = hname.join('').toLowerCase();
                                hvalue = hvalue.join('');
                                if(!options.data.uri_headers) options.data.uri_headers = {};
                                if (!options.data.uri_headers[hname]) {
                                  options.data.uri_headers[hname] = [hvalue];
                                } else {
                                  options.data.uri_headers[hname].push(hvalue);
                                }},
          function() {
                                // lots of tests fail if this isn't guarded...
                                if (options.startRule === 'Refer_To') {
                                  options.data.uri = new options.SIP.URI(options.data.scheme, options.data.user, options.data.host, options.data.port, options.data.uri_params, options.data.uri_headers);
                                  delete options.data.scheme;
                                  delete options.data.user;
                                  delete options.data.host;
                                  delete options.data.host_type;
                                  delete options.data.port;
                                  delete options.data.uri_params;
                                }
                              },
          "//",
          { type: "literal", value: "//", description: "\"//\"" },
          function() {
                              options.data.scheme= text(); },
          { type: "literal", value: "SIP", description: "\"SIP\"" },
          function() {
                              options.data.sip_version = text(); },
          "INVITE",
          { type: "literal", value: "INVITE", description: "\"INVITE\"" },
          "ACK",
          { type: "literal", value: "ACK", description: "\"ACK\"" },
          "VXACH",
          { type: "literal", value: "VXACH", description: "\"VXACH\"" },
          "OPTIONS",
          { type: "literal", value: "OPTIONS", description: "\"OPTIONS\"" },
          "BYE",
          { type: "literal", value: "BYE", description: "\"BYE\"" },
          "CANCEL",
          { type: "literal", value: "CANCEL", description: "\"CANCEL\"" },
          "REGISTER",
          { type: "literal", value: "REGISTER", description: "\"REGISTER\"" },
          "SUBSCRIBE",
          { type: "literal", value: "SUBSCRIBE", description: "\"SUBSCRIBE\"" },
          "NOTIFY",
          { type: "literal", value: "NOTIFY", description: "\"NOTIFY\"" },
          "REFER",
          { type: "literal", value: "REFER", description: "\"REFER\"" },
          function() {

                              options.data.method = text();
                              return options.data.method; },
          function(status_code) {
                            options.data.status_code = parseInt(status_code.join('')); },
          function() {
                            options.data.reason_phrase = text(); },
          function() {
                        options.data = text(); },
          function() {
                                  var idx, length;
                                  length = options.data.multi_header.length;
                                  for (idx = 0; idx < length; idx++) {
                                    if (options.data.multi_header[idx].parsed === null) {
                                      options.data = null;
                                      break;
                                    }
                                  }
                                  if (options.data !== null) {
                                    options.data = options.data.multi_header;
                                  } else {
                                    options.data = -1;
                                  }},
          function() {
                                  var header;
                                  if(!options.data.multi_header) options.data.multi_header = [];
                                  try {
                                    header = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                                    delete options.data.uri;
                                    delete options.data.displayName;
                                    delete options.data.params;
                                  } catch(e) {
                                    header = null;
                                  }
                                  options.data.multi_header.push( { 'position': peg$currPos,
                                                            'offset': offset(),
                                                            'parsed': header
                                                          });},
          function(displayName) {
                                  displayName = text().trim();
                                  if (displayName[0] === '\"') {
                                    displayName = displayName.substring(1, displayName.length-1);
                                  }
                                  options.data.displayName = displayName; },
          "q",
          { type: "literal", value: "q", description: "\"q\"" },
          function(q) {
                                  if(!options.data.params) options.data.params = {};
                                  options.data.params['q'] = q; },
          "expires",
          { type: "literal", value: "expires", description: "\"expires\"" },
          function(expires) {
                                  if(!options.data.params) options.data.params = {};
                                  options.data.params['expires'] = expires; },
          function(delta_seconds) {
                                  return parseInt(delta_seconds.join('')); },
          "0",
          { type: "literal", value: "0", description: "\"0\"" },
          function() {
                                  return parseFloat(text()); },
          function(param, value) {
                                  if(!options.data.params) options.data.params = {};
                                  if (value === null){
                                    value = undefined;
                                  }
                                  else {
                                    value = value[1];
                                  }
                                  options.data.params[param.toLowerCase()] = value;},
          "render",
          { type: "literal", value: "render", description: "\"render\"" },
          "session",
          { type: "literal", value: "session", description: "\"session\"" },
          "icon",
          { type: "literal", value: "icon", description: "\"icon\"" },
          "alert",
          { type: "literal", value: "alert", description: "\"alert\"" },
          function() {
                                      if (options.startRule === 'Content_Disposition') {
                                        options.data.type = text().toLowerCase();
                                      }
                                    },
          "handling",
          { type: "literal", value: "handling", description: "\"handling\"" },
          "optional",
          { type: "literal", value: "optional", description: "\"optional\"" },
          "required",
          { type: "literal", value: "required", description: "\"required\"" },
          function(length) {
                                  options.data = parseInt(length.join('')); },
          function() {
                                  options.data = text(); },
          "text",
          { type: "literal", value: "text", description: "\"text\"" },
          "image",
          { type: "literal", value: "image", description: "\"image\"" },
          "audio",
          { type: "literal", value: "audio", description: "\"audio\"" },
          "video",
          { type: "literal", value: "video", description: "\"video\"" },
          "application",
          { type: "literal", value: "application", description: "\"application\"" },
          "message",
          { type: "literal", value: "message", description: "\"message\"" },
          "multipart",
          { type: "literal", value: "multipart", description: "\"multipart\"" },
          "x-",
          { type: "literal", value: "x-", description: "\"x-\"" },
          function(cseq_value) {
                            options.data.value=parseInt(cseq_value.join('')); },
          function(expires) {options.data = expires; },
          function(event_type) {
                                 options.data.event = event_type.toLowerCase(); },
          function() {
                          var tag = options.data.tag;
                            options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                            if (tag) {options.data.setParam('tag',tag)}
                          },
          "tag",
          { type: "literal", value: "tag", description: "\"tag\"" },
          function(tag) {options.data.tag = tag; },
          function(forwards) {
                            options.data = parseInt(forwards.join('')); },
          function(min_expires) {options.data = min_expires; },
          function() {
                                  options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                                },
          "digest",
          { type: "literal", value: "Digest", description: "\"Digest\"" },
          "realm",
          { type: "literal", value: "realm", description: "\"realm\"" },
          function(realm) { options.data.realm = realm; },
          "domain",
          { type: "literal", value: "domain", description: "\"domain\"" },
          "nonce",
          { type: "literal", value: "nonce", description: "\"nonce\"" },
          function(nonce) { options.data.nonce=nonce; },
          "opaque",
          { type: "literal", value: "opaque", description: "\"opaque\"" },
          function(opaque) { options.data.opaque=opaque; },
          "stale",
          { type: "literal", value: "stale", description: "\"stale\"" },
          "true",
          { type: "literal", value: "true", description: "\"true\"" },
          function() { options.data.stale=true; },
          "false",
          { type: "literal", value: "false", description: "\"false\"" },
          function() { options.data.stale=false; },
          "algorithm",
          { type: "literal", value: "algorithm", description: "\"algorithm\"" },
          "md5",
          { type: "literal", value: "MD5", description: "\"MD5\"" },
          "md5-sess",
          { type: "literal", value: "MD5-sess", description: "\"MD5-sess\"" },
          function(algorithm) {
                                options.data.algorithm=algorithm.toUpperCase(); },
          "qop",
          { type: "literal", value: "qop", description: "\"qop\"" },
          "auth-int",
          { type: "literal", value: "auth-int", description: "\"auth-int\"" },
          "auth",
          { type: "literal", value: "auth", description: "\"auth\"" },
          function(qop_value) {
                                  options.data.qop || (options.data.qop=[]);
                                  options.data.qop.push(qop_value.toLowerCase()); },
          function(rack_value) {
                            options.data.value=parseInt(rack_value.join('')); },
          function() {
                            var idx, length;
                            length = options.data.multi_header.length;
                            for (idx = 0; idx < length; idx++) {
                              if (options.data.multi_header[idx].parsed === null) {
                                options.data = null;
                                break;
                              }
                            }
                            if (options.data !== null) {
                              options.data = options.data.multi_header;
                            } else {
                              options.data = -1;
                            }},
          function() {
                            var header;
                            if(!options.data.multi_header) options.data.multi_header = [];
                            try {
                              header = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                              delete options.data.uri;
                              delete options.data.displayName;
                              delete options.data.params;
                            } catch(e) {
                              header = null;
                            }
                            options.data.multi_header.push( { 'position': peg$currPos,
                                                      'offset': offset(),
                                                      'parsed': header
                                                    });},
          function() {
                        options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                      },
          function() {
                                if (!(options.data.replaces_from_tag && options.data.replaces_to_tag)) {
                                  options.data = -1;
                                }
                              },
          function() {
                                options.data = {
                                  call_id: options.data
                                };
                              },
          "from-tag",
          { type: "literal", value: "from-tag", description: "\"from-tag\"" },
          function(from_tag) {
                                options.data.replaces_from_tag = from_tag;
                              },
          "to-tag",
          { type: "literal", value: "to-tag", description: "\"to-tag\"" },
          function(to_tag) {
                                options.data.replaces_to_tag = to_tag;
                              },
          "early-only",
          { type: "literal", value: "early-only", description: "\"early-only\"" },
          function() {
                                options.data.early_only = true;
                              },
          function(r) {return r;},
          function(first, rest) { return list(first, rest); },
          function(value) {
                          if (options.startRule === 'Require') {
                            options.data = value || [];
                          }
                        },
          function(rseq_value) {
                            options.data.value=parseInt(rseq_value.join('')); },
          "active",
          { type: "literal", value: "active", description: "\"active\"" },
          "pending",
          { type: "literal", value: "pending", description: "\"pending\"" },
          "terminated",
          { type: "literal", value: "terminated", description: "\"terminated\"" },
          function() {
                                  options.data.state = text(); },
          "reason",
          { type: "literal", value: "reason", description: "\"reason\"" },
          function(reason) {
                                  if (typeof reason !== 'undefined') options.data.reason = reason; },
          function(expires) {
                                  if (typeof expires !== 'undefined') options.data.expires = expires; },
          "retry_after",
          { type: "literal", value: "retry_after", description: "\"retry_after\"" },
          function(retry_after) {
                                  if (typeof retry_after !== 'undefined') options.data.retry_after = retry_after; },
          "deactivated",
          { type: "literal", value: "deactivated", description: "\"deactivated\"" },
          "probation",
          { type: "literal", value: "probation", description: "\"probation\"" },
          "rejected",
          { type: "literal", value: "rejected", description: "\"rejected\"" },
          "timeout",
          { type: "literal", value: "timeout", description: "\"timeout\"" },
          "giveup",
          { type: "literal", value: "giveup", description: "\"giveup\"" },
          "noresource",
          { type: "literal", value: "noresource", description: "\"noresource\"" },
          "invariant",
          { type: "literal", value: "invariant", description: "\"invariant\"" },
          function(value) {
                          if (options.startRule === 'Supported') {
                            options.data = value || [];
                          }
                        },
          function() {
                        var tag = options.data.tag;
                          options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                          if (tag) {options.data.setParam('tag',tag)}
                        },
          "ttl",
          { type: "literal", value: "ttl", description: "\"ttl\"" },
          function(via_ttl_value) {
                                options.data.ttl = via_ttl_value; },
          "maddr",
          { type: "literal", value: "maddr", description: "\"maddr\"" },
          function(via_maddr) {
                                options.data.maddr = via_maddr; },
          "received",
          { type: "literal", value: "received", description: "\"received\"" },
          function(via_received) {
                                options.data.received = via_received; },
          "branch",
          { type: "literal", value: "branch", description: "\"branch\"" },
          function(via_branch) {
                                options.data.branch = via_branch; },
          "rport",
          { type: "literal", value: "rport", description: "\"rport\"" },
          function() {
                                if(typeof response_port !== 'undefined')
                                  options.data.rport = response_port.join(''); },
          function(via_protocol) {
                                options.data.protocol = via_protocol; },
          { type: "literal", value: "UDP", description: "\"UDP\"" },
          { type: "literal", value: "TCP", description: "\"TCP\"" },
          { type: "literal", value: "TLS", description: "\"TLS\"" },
          { type: "literal", value: "SCTP", description: "\"SCTP\"" },
          function(via_transport) {
                                options.data.transport = via_transport; },
          function() {
                                options.data.host = text(); },
          function(via_sent_by_port) {
                                options.data.port = parseInt(via_sent_by_port.join('')); },
          function(ttl) {
                                return parseInt(ttl.join('')); },
          function(deltaSeconds) {
                                if (options.startRule === 'Session_Expires') {
                                  options.data.deltaSeconds = deltaSeconds;
                                }
                              },
          "refresher",
          { type: "literal", value: "refresher", description: "\"refresher\"" },
          "uas",
          { type: "literal", value: "uas", description: "\"uas\"" },
          "uac",
          { type: "literal", value: "uac", description: "\"uac\"" },
          function(endpoint) {
                                if (options.startRule === 'Session_Expires') {
                                  options.data.refresher = endpoint;
                                }
                              },
          function(deltaSeconds) {
                                if (options.startRule === 'Min_SE') {
                                  options.data = deltaSeconds;
                                }
                              },
          "stuns",
          { type: "literal", value: "stuns", description: "\"stuns\"" },
          "stun",
          { type: "literal", value: "stun", description: "\"stun\"" },
          function(scheme) {
                                options.data.scheme = scheme; },
          function(host) {
                                options.data.host = host; },
          "?transport=",
          { type: "literal", value: "?transport=", description: "\"?transport=\"" },
          "turns",
          { type: "literal", value: "turns", description: "\"turns\"" },
          "turn",
          { type: "literal", value: "turn", description: "\"turn\"" },
          function() {
                                options.data.transport = transport; },
          function() {
                            options.data = text(); }
        ],

        peg$bytecode = [
          peg$decode(". \"\"2 3!"),
          peg$decode("0\"\"\"1!3#"),
          peg$decode("0$\"\"1!3%"),
          peg$decode("0&\"\"1!3'"),
          peg$decode("7'*# \"7("),
          peg$decode("0(\"\"1!3)"),
          peg$decode("0*\"\"1!3+"),
          peg$decode(".,\"\"2,3-"),
          peg$decode("..\"\"2.3/"),
          peg$decode("00\"\"1!31"),
          peg$decode(".2\"\"2233*\x89 \".4\"\"2435*} \".6\"\"2637*q \".8\"\"2839*e \".:\"\"2:3;*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E"),
          peg$decode("7)*# \"7,"),
          peg$decode(".F\"\"2F3G*} \".H\"\"2H3I*q \".J\"\"2J3K*e \".L\"\"2L3M*Y \".N\"\"2N3O*M \".P\"\"2P3Q*A \".R\"\"2R3S*5 \".T\"\"2T3U*) \".V\"\"2V3W"),
          peg$decode("!!.Y\"\"2Y3Z+7$7#+-%7#+#%'#%$## X$\"# X\"# X+! (%"),
          peg$decode("!! \\7$,#&7$\"+-$7 +#%'\"%$\"# X\"# X*# \" [+@$ \\7$+&$,#&7$\"\"\" X+'%4\"6]\" %$\"# X\"# X"),
          peg$decode("7.*# \" ["),
          peg$decode("! \\7'*# \"7(,)&7'*# \"7(\"+A$.8\"\"2839+1%7/+'%4#6^# %$## X$\"# X\"# X"),
          peg$decode("!! \\72+&$,#&72\"\"\" X+o$ \\! \\7.,#&7.\"+-$72+#%'\"%$\"# X\"# X,@&! \\7.,#&7.\"+-$72+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+! (%"),
          peg$decode("0_\"\"1!3`*# \"73"),
          peg$decode("0a\"\"1!3b"),
          peg$decode("0c\"\"1!3d"),
          peg$decode("7!*) \"0e\"\"1!3f"),
          peg$decode("! \\7)*\x95 \".F\"\"2F3G*\x89 \".J\"\"2J3K*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O+\x9E$,\x9B&7)*\x95 \".F\"\"2F3G*\x89 \".J\"\"2J3K*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O\"\"\" X+! (%"),
          peg$decode("! \\7)*\x89 \".F\"\"2F3G*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O+\x92$,\x8F&7)*\x89 \".F\"\"2F3G*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O\"\"\" X+! (%"),
          peg$decode(".T\"\"2T3U*\xE3 \".V\"\"2V3W*\xD7 \".i\"\"2i3j*\xCB \".k\"\"2k3l*\xBF \".:\"\"2:3;*\xB3 \".D\"\"2D3E*\xA7 \".2\"\"2233*\x9B \".8\"\"2839*\x8F \".m\"\"2m3n*\x83 \"7&*} \".4\"\"2435*q \".o\"\"2o3p*e \".q\"\"2q3r*Y \".6\"\"2637*M \".>\"\"2>3?*A \".s\"\"2s3t*5 \".u\"\"2u3v*) \"7'*# \"7("),
          peg$decode("! \\7)*\u012B \".F\"\"2F3G*\u011F \".J\"\"2J3K*\u0113 \".L\"\"2L3M*\u0107 \".Y\"\"2Y3Z*\xFB \".P\"\"2P3Q*\xEF \".H\"\"2H3I*\xE3 \".@\"\"2@3A*\xD7 \".g\"\"2g3h*\xCB \".R\"\"2R3S*\xBF \".N\"\"2N3O*\xB3 \".T\"\"2T3U*\xA7 \".V\"\"2V3W*\x9B \".i\"\"2i3j*\x8F \".k\"\"2k3l*\x83 \".8\"\"2839*w \".m\"\"2m3n*k \"7&*e \".4\"\"2435*Y \".o\"\"2o3p*M \".q\"\"2q3r*A \".6\"\"2637*5 \".s\"\"2s3t*) \".u\"\"2u3v+\u0134$,\u0131&7)*\u012B \".F\"\"2F3G*\u011F \".J\"\"2J3K*\u0113 \".L\"\"2L3M*\u0107 \".Y\"\"2Y3Z*\xFB \".P\"\"2P3Q*\xEF \".H\"\"2H3I*\xE3 \".@\"\"2@3A*\xD7 \".g\"\"2g3h*\xCB \".R\"\"2R3S*\xBF \".N\"\"2N3O*\xB3 \".T\"\"2T3U*\xA7 \".V\"\"2V3W*\x9B \".i\"\"2i3j*\x8F \".k\"\"2k3l*\x83 \".8\"\"2839*w \".m\"\"2m3n*k \"7&*e \".4\"\"2435*Y \".o\"\"2o3p*M \".q\"\"2q3r*A \".6\"\"2637*5 \".s\"\"2s3t*) \".u\"\"2u3v\"\"\" X+! (%"),
          peg$decode("!7/+A$.P\"\"2P3Q+1%7/+'%4#6w# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.4\"\"2435+1%7/+'%4#6x# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.>\"\"2>3?+1%7/+'%4#6y# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.T\"\"2T3U+1%7/+'%4#6z# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.V\"\"2V3W+1%7/+'%4#6{# %$## X$\"# X\"# X"),
          peg$decode("!.k\"\"2k3l+1$7/+'%4\"6|\" %$\"# X\"# X"),
          peg$decode("!7/+7$.i\"\"2i3j+'%4\"6}\" %$\"# X\"# X"),
          peg$decode("!7/+A$.D\"\"2D3E+1%7/+'%4#6~# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.2\"\"2233+1%7/+'%4#6# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.8\"\"2839+1%7/+'%4#6\x80# %$## X$\"# X\"# X"),
          peg$decode("!7/+1$7&+'%4\"6\x81\" %$\"# X\"# X"),
          peg$decode("!7&+1$7/+'%4\"6\x81\" %$\"# X\"# X"),
          peg$decode("!7=+W$ \\7G*) \"7K*# \"7F,/&7G*) \"7K*# \"7F\"+-%7>+#%'#%$## X$\"# X\"# X"),
          peg$decode("0\x82\"\"1!3\x83*A \"0\x84\"\"1!3\x85*5 \"0\x86\"\"1!3\x87*) \"73*# \"7."),
          peg$decode("!!7/+U$7&+K% \\7J*# \"7K,)&7J*# \"7K\"+-%7&+#%'$%$$# X$## X$\"# X\"# X+! (%"),
          peg$decode("!7/+`$7&+V%! \\7J*# \"7K,)&7J*# \"7K\"+! (%+2%7&+(%4$6\x88$!!%$$# X$## X$\"# X\"# X"),
          peg$decode("7.*G \".L\"\"2L3M*; \"0\x89\"\"1!3\x8A*/ \"0\x86\"\"1!3\x87*# \"73"),
          peg$decode("!.m\"\"2m3n+K$0\x8B\"\"1!3\x8C*5 \"0\x8D\"\"1!3\x8E*) \"0\x8F\"\"1!3\x90+#%'\"%$\"# X\"# X"),
          peg$decode("!7N+Q$.8\"\"2839+A%7O*# \" [+1%7S+'%4$6\x91$ %$$# X$## X$\"# X\"# X"),
          peg$decode("!7N+k$.8\"\"2839+[%7O*# \" [+K%7S+A%7_+7%7l*# \" [+'%4&6\x92& %$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!/\x93\"\"1$3\x94*) \"/\x95\"\"1#3\x96+' 4!6\x97!! %"),
          peg$decode("!7P+b$!.8\"\"2839+-$7R+#%'\"%$\"# X\"# X*# \" [+7%.:\"\"2:3;+'%4#6\x98# %$## X$\"# X\"# X"),
          peg$decode(" \\7+*) \"7-*# \"7Q+2$,/&7+*) \"7-*# \"7Q\"\"\" X"),
          peg$decode(".<\"\"2<3=*q \".>\"\"2>3?*e \".@\"\"2@3A*Y \".B\"\"2B3C*M \".D\"\"2D3E*A \".2\"\"2233*5 \".6\"\"2637*) \".4\"\"2435"),
          peg$decode("! \\7+*_ \"7-*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E,e&7+*_ \"7-*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E\"+& 4!6\x99! %"),
          peg$decode("!7T+N$!.8\"\"2839+-$7^+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!7U*) \"7\\*# \"7X+& 4!6\x9A! %"),
          peg$decode("! \\!7V+3$.J\"\"2J3K+#%'\"%$\"# X\"# X,>&!7V+3$.J\"\"2J3K+#%'\"%$\"# X\"# X\"+G$7W+=%.J\"\"2J3K*# \" [+'%4#6\x9B# %$## X$\"# X\"# X"),
          peg$decode(" \\0\x9C\"\"1!3\x9D+,$,)&0\x9C\"\"1!3\x9D\"\"\" X"),
          peg$decode("!0$\"\"1!3%+A$ \\0\x9E\"\"1!3\x9F,)&0\x9E\"\"1!3\x9F\"+#%'\"%$\"# X\"# X"),
          peg$decode("!.o\"\"2o3p+A$7Y+7%.q\"\"2q3r+'%4#6\xA0# %$## X$\"# X\"# X"),
          peg$decode("!!7Z+\xBF$.8\"\"2839+\xAF%7Z+\xA5%.8\"\"2839+\x95%7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'-%$-# X$,# X$+# X$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0838 \"!.\xA1\"\"2\xA13\xA2+\xAF$7Z+\xA5%.8\"\"2839+\x95%7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%',%$,# X$+# X$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0795 \"!.\xA1\"\"2\xA13\xA2+\x95$7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'*%$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u070C \"!.\xA1\"\"2\xA13\xA2+{$7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u069D \"!.\xA1\"\"2\xA13\xA2+a$7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'&%$&# X$%# X$$# X$## X$\"# X\"# X*\u0648 \"!.\xA1\"\"2\xA13\xA2+G$7Z+=%.8\"\"2839+-%7[+#%'$%$$# X$## X$\"# X\"# X*\u060D \"!.\xA1\"\"2\xA13\xA2+-$7[+#%'\"%$\"# X\"# X*\u05EC \"!.\xA1\"\"2\xA13\xA2+-$7Z+#%'\"%$\"# X\"# X*\u05CB \"!7Z+\xA5$.\xA1\"\"2\xA13\xA2+\x95%7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'+%$+# X$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0538 \"!7Z+\xB6$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x8B%.\xA1\"\"2\xA13\xA2+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'*%$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0494 \"!7Z+\xC7$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x9C%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+q%.\xA1\"\"2\xA13\xA2+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%')%$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u03DF \"!7Z+\xD8$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xAD%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x82%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+W%.\xA1\"\"2\xA13\xA2+G%7Z+=%.8\"\"2839+-%7[+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0319 \"!7Z+\xE9$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xBE%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x93%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+h%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+=%.\xA1\"\"2\xA13\xA2+-%7[+#%''%$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0242 \"!7Z+\u0114$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xE9%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xBE%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x93%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+h%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+=%.\xA1\"\"2\xA13\xA2+-%7Z+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0140 \"!7Z+\u0135$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\u010A%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xDF%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xB4%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x89%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+^%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+3%.\xA1\"\"2\xA13\xA2+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X+& 4!6\xA3! %"),
          peg$decode("!7#+S$7#*# \" [+C%7#*# \" [+3%7#*# \" [+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!7Z+=$.8\"\"2839+-%7Z+#%'#%$## X$\"# X\"# X*# \"7\\"),
          peg$decode("!7]+u$.J\"\"2J3K+e%7]+[%.J\"\"2J3K+K%7]+A%.J\"\"2J3K+1%7]+'%4'6\xA4' %$'# X$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!.\xA5\"\"2\xA53\xA6+3$0\xA7\"\"1!3\xA8+#%'\"%$\"# X\"# X*\xA0 \"!.\xA9\"\"2\xA93\xAA+=$0\xAB\"\"1!3\xAC+-%7!+#%'#%$## X$\"# X\"# X*o \"!.\xAD\"\"2\xAD3\xAE+7$7!+-%7!+#%'#%$## X$\"# X\"# X*D \"!0\xAF\"\"1!3\xB0+-$7!+#%'\"%$\"# X\"# X*# \"7!"),
          peg$decode("!!7!*# \" [+c$7!*# \" [+S%7!*# \" [+C%7!*# \" [+3%7!*# \" [+#%'%%$%# X$$# X$## X$\"# X\"# X+' 4!6\xB1!! %"),
          peg$decode(" \\!.2\"\"2233+-$7`+#%'\"%$\"# X\"# X,>&!.2\"\"2233+-$7`+#%'\"%$\"# X\"# X\""),
          peg$decode("7a*A \"7b*; \"7c*5 \"7d*/ \"7e*) \"7f*# \"7g"),
          peg$decode("!/\xB2\"\"1*3\xB3+b$/\xB4\"\"1#3\xB5*G \"/\xB6\"\"1#3\xB7*; \"/\xB8\"\"1$3\xB9*/ \"/\xBA\"\"1#3\xBB*# \"76+(%4\"6\xBC\"! %$\"# X\"# X"),
          peg$decode("!/\xBD\"\"1%3\xBE+J$/\xBF\"\"1%3\xC0*/ \"/\xC1\"\"1\"3\xC2*# \"76+(%4\"6\xC3\"! %$\"# X\"# X"),
          peg$decode("!/\xC4\"\"1'3\xC5+2$7\x8F+(%4\"6\xC6\"! %$\"# X\"# X"),
          peg$decode("!/\xC7\"\"1$3\xC8+2$7\xEF+(%4\"6\xC9\"! %$\"# X\"# X"),
          peg$decode("!/\xCA\"\"1&3\xCB+2$7T+(%4\"6\xCC\"! %$\"# X\"# X"),
          peg$decode("!/\xCD\"\"1\"3\xCE+R$!.>\"\"2>3?+-$76+#%'\"%$\"# X\"# X*# \" [+'%4\"6\xCF\" %$\"# X\"# X"),
          peg$decode("!7h+T$!.>\"\"2>3?+-$7i+#%'\"%$\"# X\"# X*# \" [+)%4\"6\xD0\"\"! %$\"# X\"# X"),
          peg$decode("! \\7j+&$,#&7j\"\"\" X+! (%"),
          peg$decode("! \\7j+&$,#&7j\"\"\" X+! (%"),
          peg$decode("7k*) \"7+*# \"7-"),
          peg$decode(".o\"\"2o3p*e \".q\"\"2q3r*Y \".4\"\"2435*M \".8\"\"2839*A \".<\"\"2<3=*5 \".@\"\"2@3A*) \".B\"\"2B3C"),
          peg$decode("!.6\"\"2637+u$7m+k% \\!.<\"\"2<3=+-$7m+#%'\"%$\"# X\"# X,>&!.<\"\"2<3=+-$7m+#%'\"%$\"# X\"# X\"+#%'#%$## X$\"# X\"# X"),
          peg$decode("!7n+C$.>\"\"2>3?+3%7o+)%4#6\xD1#\"\" %$## X$\"# X\"# X"),
          peg$decode(" \\7p*) \"7+*# \"7-+2$,/&7p*) \"7+*# \"7-\"\"\" X"),
          peg$decode(" \\7p*) \"7+*# \"7-,/&7p*) \"7+*# \"7-\""),
          peg$decode(".o\"\"2o3p*e \".q\"\"2q3r*Y \".4\"\"2435*M \".6\"\"2637*A \".8\"\"2839*5 \".@\"\"2@3A*) \".B\"\"2B3C"),
          peg$decode("7\x90*# \"7r"),
          peg$decode("!7\x8F+K$7'+A%7s+7%7'+-%7\x84+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("7M*# \"7t"),
          peg$decode("!7+G$.8\"\"2839+7%7u*# \"7x+'%4#6\xD2# %$## X$\"# X\"# X"),
          peg$decode("!7v*# \"7w+N$!.6\"\"2637+-$7\x83+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!.\xD3\"\"2\xD33\xD4+=$7\x80+3%7w*# \" [+#%'#%$## X$\"# X\"# X"),
          peg$decode("!.4\"\"2435+-$7{+#%'\"%$\"# X\"# X"),
          peg$decode("!7z+5$ \\7y,#&7y\"+#%'\"%$\"# X\"# X"),
          peg$decode("7**) \"7+*# \"7-"),
          peg$decode("7+*\x8F \"7-*\x89 \".2\"\"2233*} \".6\"\"2637*q \".8\"\"2839*e \".:\"\"2:3;*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E"),
          peg$decode("!7|+k$ \\!.4\"\"2435+-$7|+#%'\"%$\"# X\"# X,>&!.4\"\"2435+-$7|+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("! \\7~,#&7~\"+k$ \\!.2\"\"2233+-$7}+#%'\"%$\"# X\"# X,>&!.2\"\"2233+-$7}+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode(" \\7~,#&7~\""),
          peg$decode("7+*w \"7-*q \".8\"\"2839*e \".:\"\"2:3;*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E"),
          peg$decode("!7\"+\x8D$ \\7\"*G \"7!*A \".@\"\"2@3A*5 \".F\"\"2F3G*) \".J\"\"2J3K,M&7\"*G \"7!*A \".@\"\"2@3A*5 \".F\"\"2F3G*) \".J\"\"2J3K\"+'%4\"6\xD5\" %$\"# X\"# X"),
          peg$decode("7\x81*# \"7\x82"),
          peg$decode("!!7O+3$.:\"\"2:3;+#%'\"%$\"# X\"# X*# \" [+-$7S+#%'\"%$\"# X\"# X*# \" ["),
          peg$decode(" \\7+*\x83 \"7-*} \".B\"\"2B3C*q \".D\"\"2D3E*e \".2\"\"2233*Y \".8\"\"2839*M \".:\"\"2:3;*A \".<\"\"2<3=*5 \".>\"\"2>3?*) \".@\"\"2@3A+\x8C$,\x89&7+*\x83 \"7-*} \".B\"\"2B3C*q \".D\"\"2D3E*e \".2\"\"2233*Y \".8\"\"2839*M \".:\"\"2:3;*A \".<\"\"2<3=*5 \".>\"\"2>3?*) \".@\"\"2@3A\"\"\" X"),
          peg$decode(" \\7y,#&7y\""),
          peg$decode("!/\x95\"\"1#3\xD6+y$.4\"\"2435+i% \\7!+&$,#&7!\"\"\" X+P%.J\"\"2J3K+@% \\7!+&$,#&7!\"\"\" X+'%4%6\xD7% %$%# X$$# X$## X$\"# X\"# X"),
          peg$decode(".\xD8\"\"2\xD83\xD9"),
          peg$decode(".\xDA\"\"2\xDA3\xDB"),
          peg$decode(".\xDC\"\"2\xDC3\xDD"),
          peg$decode(".\xDE\"\"2\xDE3\xDF"),
          peg$decode(".\xE0\"\"2\xE03\xE1"),
          peg$decode(".\xE2\"\"2\xE23\xE3"),
          peg$decode(".\xE4\"\"2\xE43\xE5"),
          peg$decode(".\xE6\"\"2\xE63\xE7"),
          peg$decode(".\xE8\"\"2\xE83\xE9"),
          peg$decode(".\xEA\"\"2\xEA3\xEB"),
          peg$decode("!7\x85*S \"7\x86*M \"7\x88*G \"7\x89*A \"7\x8A*; \"7\x8B*5 \"7\x8C*/ \"7\x8D*) \"7\x8E*# \"76+& 4!6\xEC! %"),
          peg$decode("!7\x84+K$7'+A%7\x91+7%7'+-%7\x93+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!7\x92+' 4!6\xED!! %"),
          peg$decode("!7!+7$7!+-%7!+#%'#%$## X$\"# X\"# X"),
          peg$decode("! \\7**A \"7+*; \"7-*5 \"73*/ \"74*) \"7'*# \"7(,G&7**A \"7+*; \"7-*5 \"73*/ \"74*) \"7'*# \"7(\"+& 4!6\xEE! %"),
          peg$decode("!7\xB5+_$ \\!7A+-$7\xB5+#%'\"%$\"# X\"# X,8&!7A+-$7\xB5+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!79+R$!.:\"\"2:3;+-$79+#%'\"%$\"# X\"# X*# \" [+'%4\"6\xEF\" %$\"# X\"# X"),
          peg$decode("!7:*j \"!7\x97+_$ \\!7A+-$7\x97+#%'\"%$\"# X\"# X,8&!7A+-$7\x97+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+& 4!6\xF0! %"),
          peg$decode("!7L*# \"7\x98+c$ \\!7B+-$7\x9A+#%'\"%$\"# X\"# X,8&!7B+-$7\x9A+#%'\"%$\"# X\"# X\"+'%4\"6\xF1\" %$\"# X\"# X"),
          peg$decode("!7\x99*# \" [+A$7@+7%7M+-%7?+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!!76+_$ \\!7.+-$76+#%'\"%$\"# X\"# X,8&!7.+-$76+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X*# \"7H+' 4!6\xF2!! %"),
          peg$decode("7\x9B*) \"7\x9C*# \"7\x9F"),
          peg$decode("!/\xF3\"\"1!3\xF4+<$7<+2%7\x9E+(%4#6\xF5#! %$## X$\"# X\"# X"),
          peg$decode("!/\xF6\"\"1'3\xF7+<$7<+2%7\x9D+(%4#6\xF8#! %$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\xF9!! %"),
          peg$decode("!.\xFA\"\"2\xFA3\xFB+x$!.J\"\"2J3K+S$7!*# \" [+C%7!*# \" [+3%7!*# \" [+#%'$%$$# X$## X$\"# X\"# X*# \" [+'%4\"6\xFC\" %$\"# X\"# X"),
          peg$decode("!76+N$!7<+-$7\xA0+#%'\"%$\"# X\"# X*# \" [+)%4\"6\xFD\"\"! %$\"# X\"# X"),
          peg$decode("76*) \"7T*# \"7H"),
          peg$decode("!7\xA2+_$ \\!7B+-$7\xA3+#%'\"%$\"# X\"# X,8&!7B+-$7\xA3+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!/\xFE\"\"1&3\xFF*G \"/\u0100\"\"1'3\u0101*; \"/\u0102\"\"1$3\u0103*/ \"/\u0104\"\"1%3\u0105*# \"76+& 4!6\u0106! %"),
          peg$decode("7\xA4*# \"7\x9F"),
          peg$decode("!/\u0107\"\"1(3\u0108+O$7<+E%/\u0109\"\"1(3\u010A*/ \"/\u010B\"\"1(3\u010C*# \"76+#%'#%$## X$\"# X\"# X"),
          peg$decode("!76+_$ \\!7A+-$76+#%'\"%$\"# X\"# X,8&!7A+-$76+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u010D!! %"),
          peg$decode("!7\xA8+& 4!6\u010E! %"),
          peg$decode("!7\xA9+s$7;+i%7\xAE+_% \\!7B+-$7\xAF+#%'\"%$\"# X\"# X,8&!7B+-$7\xAF+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("7\xAA*# \"7\xAB"),
          peg$decode("/\u010F\"\"1$3\u0110*S \"/\u0111\"\"1%3\u0112*G \"/\u0113\"\"1%3\u0114*; \"/\u0115\"\"1%3\u0116*/ \"/\u0117\"\"1+3\u0118*# \"7\xAC"),
          peg$decode("/\u0119\"\"1'3\u011A*/ \"/\u011B\"\"1)3\u011C*# \"7\xAC"),
          peg$decode("76*# \"7\xAD"),
          peg$decode("!/\u011D\"\"1\"3\u011E+-$76+#%'\"%$\"# X\"# X"),
          peg$decode("7\xAC*# \"76"),
          peg$decode("!76+7$7<+-%7\xB0+#%'#%$## X$\"# X\"# X"),
          peg$decode("76*# \"7H"),
          peg$decode("!7\xB2+7$7.+-%7\x8F+#%'#%$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u011F!! %"),
          peg$decode("!7\x9D+' 4!6\u0120!! %"),
          peg$decode("!7\xB5+d$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+(%4\"6\u0121\"!!%$\"# X\"# X"),
          peg$decode("!!77+k$ \\!.J\"\"2J3K+-$77+#%'\"%$\"# X\"# X,>&!.J\"\"2J3K+-$77+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+! (%"),
          peg$decode("!7L*# \"7\x98+c$ \\!7B+-$7\xB7+#%'\"%$\"# X\"# X,8&!7B+-$7\xB7+#%'\"%$\"# X\"# X\"+'%4\"6\u0122\" %$\"# X\"# X"),
          peg$decode("7\xB8*# \"7\x9F"),
          peg$decode("!/\u0123\"\"1#3\u0124+<$7<+2%76+(%4#6\u0125#! %$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u0126!! %"),
          peg$decode("!7\x9D+' 4!6\u0127!! %"),
          peg$decode("! \\7\x99,#&7\x99\"+\x81$7@+w%7M+m%7?+c% \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+'%4%6\u0128% %$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("7\xBD"),
          peg$decode("!/\u0129\"\"1&3\u012A+s$7.+i%7\xC0+_% \\!7A+-$7\xC0+#%'\"%$\"# X\"# X,8&!7A+-$7\xC0+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X*# \"7\xBE"),
          peg$decode("!76+s$7.+i%7\xBF+_% \\!7A+-$7\xBF+#%'\"%$\"# X\"# X,8&!7A+-$7\xBF+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!76+=$7<+3%76*# \"7H+#%'#%$## X$\"# X\"# X"),
          peg$decode("7\xC1*G \"7\xC3*A \"7\xC5*; \"7\xC7*5 \"7\xC8*/ \"7\xC9*) \"7\xCA*# \"7\xBF"),
          peg$decode("!/\u012B\"\"1%3\u012C+7$7<+-%7\xC2+#%'#%$## X$\"# X\"# X"),
          peg$decode("!7I+' 4!6\u012D!! %"),
          peg$decode("!/\u012E\"\"1&3\u012F+\xA5$7<+\x9B%7D+\x91%7\xC4+\x87% \\! \\7'+&$,#&7'\"\"\" X+-$7\xC4+#%'\"%$\"# X\"# X,G&! \\7'+&$,#&7'\"\"\" X+-$7\xC4+#%'\"%$\"# X\"# X\"+-%7E+#%'&%$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("7t*# \"7w"),
          peg$decode("!/\u0130\"\"1%3\u0131+7$7<+-%7\xC6+#%'#%$## X$\"# X\"# X"),
          peg$decode("!7I+' 4!6\u0132!! %"),
          peg$decode("!/\u0133\"\"1&3\u0134+<$7<+2%7I+(%4#6\u0135#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0136\"\"1%3\u0137+_$7<+U%!/\u0138\"\"1$3\u0139+& 4!6\u013A! %*4 \"!/\u013B\"\"1%3\u013C+& 4!6\u013D! %+#%'#%$## X$\"# X\"# X"),
          peg$decode("!/\u013E\"\"1)3\u013F+T$7<+J%/\u0140\"\"1#3\u0141*/ \"/\u0142\"\"1(3\u0143*# \"76+(%4#6\u0144#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0145\"\"1#3\u0146+\x9E$7<+\x94%7D+\x8A%!7\xCB+k$ \\!.D\"\"2D3E+-$7\xCB+#%'\"%$\"# X\"# X,>&!.D\"\"2D3E+-$7\xCB+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+-%7E+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!/\u0147\"\"1(3\u0148*/ \"/\u0149\"\"1$3\u014A*# \"76+' 4!6\u014B!! %"),
          peg$decode("!76+_$ \\!7A+-$76+#%'\"%$\"# X\"# X,8&!7A+-$76+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!7\xCE+K$7.+A%7\xCE+7%7.+-%7\x8F+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u014C!! %"),
          peg$decode("!7\xD0+c$ \\!7A+-$7\xD0+#%'\"%$\"# X\"# X,8&!7A+-$7\xD0+#%'\"%$\"# X\"# X\"+'%4\"6\u014D\" %$\"# X\"# X"),
          peg$decode("!7\x98+c$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+'%4\"6\u014E\" %$\"# X\"# X"),
          peg$decode("!7L*T \"7\x98*N \"!7@*# \" [+=$7t+3%7?*# \" [+#%'#%$## X$\"# X\"# X+c$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+'%4\"6\u014F\" %$\"# X\"# X"),
          peg$decode("!7\xD3+c$ \\!7B+-$7\xD4+#%'\"%$\"# X\"# X,8&!7B+-$7\xD4+#%'\"%$\"# X\"# X\"+'%4\"6\u0150\" %$\"# X\"# X"),
          peg$decode("!7\x95+& 4!6\u0151! %"),
          peg$decode("!/\u0152\"\"1(3\u0153+<$7<+2%76+(%4#6\u0154#! %$## X$\"# X\"# X*j \"!/\u0155\"\"1&3\u0156+<$7<+2%76+(%4#6\u0157#! %$## X$\"# X\"# X*: \"!/\u0158\"\"1*3\u0159+& 4!6\u015A! %*# \"7\x9F"),
          peg$decode("!!76+o$ \\!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X,=&!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X\"+)%4\"6\u015C\"\"! %$\"# X\"# X*# \" [+' 4!6\u015D!! %"),
          peg$decode("!7\xD7+_$ \\!7A+-$7\xD7+#%'\"%$\"# X\"# X,8&!7A+-$7\xD7+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!7\x98+_$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u015E!! %"),
          peg$decode("!7\xDA+_$ \\!7B+-$7\xDB+#%'\"%$\"# X\"# X,8&!7B+-$7\xDB+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!/\u015F\"\"1&3\u0160*; \"/\u0161\"\"1'3\u0162*/ \"/\u0163\"\"1*3\u0164*# \"76+& 4!6\u0165! %"),
          peg$decode("!/\u0166\"\"1&3\u0167+<$7<+2%7\xDC+(%4#6\u0168#! %$## X$\"# X\"# X*\x83 \"!/\xF6\"\"1'3\xF7+<$7<+2%7\x9D+(%4#6\u0169#! %$## X$\"# X\"# X*S \"!/\u016A\"\"1+3\u016B+<$7<+2%7\x9D+(%4#6\u016C#! %$## X$\"# X\"# X*# \"7\x9F"),
          peg$decode("/\u016D\"\"1+3\u016E*k \"/\u016F\"\"1)3\u0170*_ \"/\u0171\"\"1(3\u0172*S \"/\u0173\"\"1'3\u0174*G \"/\u0175\"\"1&3\u0176*; \"/\u0177\"\"1*3\u0178*/ \"/\u0179\"\"1)3\u017A*# \"76"),
          peg$decode("71*# \" ["),
          peg$decode("!!76+o$ \\!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X,=&!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X\"+)%4\"6\u015C\"\"! %$\"# X\"# X*# \" [+' 4!6\u017B!! %"),
          peg$decode("!7L*# \"7\x98+c$ \\!7B+-$7\xE0+#%'\"%$\"# X\"# X,8&!7B+-$7\xE0+#%'\"%$\"# X\"# X\"+'%4\"6\u017C\" %$\"# X\"# X"),
          peg$decode("7\xB8*# \"7\x9F"),
          peg$decode("!7\xE2+_$ \\!7A+-$7\xE2+#%'\"%$\"# X\"# X,8&!7A+-$7\xE2+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!7\xE9+s$7.+i%7\xEC+_% \\!7B+-$7\xE3+#%'\"%$\"# X\"# X,8&!7B+-$7\xE3+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("7\xE4*; \"7\xE5*5 \"7\xE6*/ \"7\xE7*) \"7\xE8*# \"7\x9F"),
          peg$decode("!/\u017D\"\"1#3\u017E+<$7<+2%7\xEF+(%4#6\u017F#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0180\"\"1%3\u0181+<$7<+2%7T+(%4#6\u0182#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0183\"\"1(3\u0184+B$7<+8%7\\*# \"7Y+(%4#6\u0185#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0186\"\"1&3\u0187+<$7<+2%76+(%4#6\u0188#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0189\"\"1%3\u018A+T$!7<+5$ \\7!,#&7!\"+#%'\"%$\"# X\"# X*# \" [+'%4\"6\u018B\" %$\"# X\"# X"),
          peg$decode("!7\xEA+K$7;+A%76+7%7;+-%7\xEB+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!/\x95\"\"1#3\xD6*# \"76+' 4!6\u018C!! %"),
          peg$decode("!/\xB4\"\"1#3\u018D*G \"/\xB6\"\"1#3\u018E*; \"/\xBA\"\"1#3\u018F*/ \"/\xB8\"\"1$3\u0190*# \"76+' 4!6\u0191!! %"),
          peg$decode("!7\xED+H$!7C+-$7\xEE+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!7U*) \"7\\*# \"7X+& 4!6\u0192! %"),
          peg$decode("!!7!*# \" [+c$7!*# \" [+S%7!*# \" [+C%7!*# \" [+3%7!*# \" [+#%'%%$%# X$$# X$## X$\"# X\"# X+' 4!6\u0193!! %"),
          peg$decode("!!7!+C$7!*# \" [+3%7!*# \" [+#%'#%$## X$\"# X\"# X+' 4!6\u0194!! %"),
          peg$decode("7\xBD"),
          peg$decode("!7\x9D+d$ \\!7B+-$7\xF2+#%'\"%$\"# X\"# X,8&!7B+-$7\xF2+#%'\"%$\"# X\"# X\"+(%4\"6\u0195\"!!%$\"# X\"# X"),
          peg$decode("7\xF3*# \"7\x9F"),
          peg$decode("!.\u0196\"\"2\u01963\u0197+N$7<+D%.\u0198\"\"2\u01983\u0199*) \".\u019A\"\"2\u019A3\u019B+(%4#6\u019C#! %$## X$\"# X\"# X"),
          peg$decode("!7\x9D+d$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+(%4\"6\u019D\"!!%$\"# X\"# X"),
          peg$decode("!76+7$70+-%7\xF6+#%'#%$## X$\"# X\"# X"),
          peg$decode(" \\72*) \"74*# \"7.,/&72*) \"74*# \"7.\""),
          peg$decode(" \\7%,#&7%\""),
          peg$decode("!7\xF9+=$.8\"\"2839+-%7\xFA+#%'#%$## X$\"# X\"# X"),
          peg$decode("!/\u019E\"\"1%3\u019F*) \"/\u01A0\"\"1$3\u01A1+' 4!6\u01A2!! %"),
          peg$decode("!7\xFB+N$!.8\"\"2839+-$7^+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!7\\*) \"7X*# \"7\x82+' 4!6\u01A3!! %"),
          peg$decode("! \\7\xFD*) \"7-*# \"7\xFE,/&7\xFD*) \"7-*# \"7\xFE\"+! (%"),
          peg$decode("7\"*S \"7!*M \".F\"\"2F3G*A \".J\"\"2J3K*5 \".H\"\"2H3I*) \".N\"\"2N3O"),
          peg$decode(".L\"\"2L3M*\x95 \".B\"\"2B3C*\x89 \".<\"\"2<3=*} \".R\"\"2R3S*q \".T\"\"2T3U*e \".V\"\"2V3W*Y \".P\"\"2P3Q*M \".@\"\"2@3A*A \".D\"\"2D3E*5 \".2\"\"2233*) \".>\"\"2>3?"),
          peg$decode("!7\u0100+h$.8\"\"2839+X%7\xFA+N%!.\u01A4\"\"2\u01A43\u01A5+-$7\xEB+#%'\"%$\"# X\"# X*# \" [+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!/\u01A6\"\"1%3\u01A7*) \"/\u01A8\"\"1$3\u01A9+' 4!6\u01A2!! %"),
          peg$decode("!7\xEB+Q$/\xB4\"\"1#3\xB5*7 \"/\xB6\"\"1#3\xB7*+ \" \\7+,#&7+\"+'%4\"6\u01AA\" %$\"# X\"# X"),
          peg$decode("!7\u0104+\x8F$.F\"\"2F3G+%7\u0103+u%.F\"\"2F3G+e%7\u0103+[%.F\"\"2F3G+K%7\u0103+A%.F\"\"2F3G+1%7\u0105+'%4)6\u01AB) %$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!7#+A$7#+7%7#+-%7#+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!7\u0103+-$7\u0103+#%'\"%$\"# X\"# X"),
          peg$decode("!7\u0103+7$7\u0103+-%7\u0103+#%'#%$## X$\"# X\"# X")
        ],

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleIndices)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleIndex = peg$startRuleIndices[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$decode(s) {
      var bc = new Array(s.length), i;

      for (i = 0; i < s.length; i++) {
        bc[i] = s.charCodeAt(i) - 32;
      }

      return bc;
    }

    function peg$parseRule(index) {
      var bc    = peg$bytecode[index],
          ip    = 0,
          ips   = [],
          end   = bc.length,
          ends  = [],
          stack = [],
          params, i;

      function protect(object) {
        return Object.prototype.toString.apply(object) === "[object Array]" ? [] : object;
      }

      while (true) {
        while (ip < end) {
          switch (bc[ip]) {
            case 0:
              stack.push(protect(peg$consts[bc[ip + 1]]));
              ip += 2;
              break;

            case 1:
              stack.push(peg$currPos);
              ip++;
              break;

            case 2:
              stack.pop();
              ip++;
              break;

            case 3:
              peg$currPos = stack.pop();
              ip++;
              break;

            case 4:
              stack.length -= bc[ip + 1];
              ip += 2;
              break;

            case 5:
              stack.splice(-2, 1);
              ip++;
              break;

            case 6:
              stack[stack.length - 2].push(stack.pop());
              ip++;
              break;

            case 7:
              stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));
              ip += 2;
              break;

            case 8:
              stack.pop();
              stack.push(input.substring(stack[stack.length - 1], peg$currPos));
              ip++;
              break;

            case 9:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1]) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 10:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1] === peg$FAILED) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 11:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1] !== peg$FAILED) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 12:
              if (stack[stack.length - 1] !== peg$FAILED) {
                ends.push(end);
                ips.push(ip);

                end = ip + 2 + bc[ip + 1];
                ip += 2;
              } else {
                ip += 2 + bc[ip + 1];
              }

              break;

            case 13:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (input.length > peg$currPos) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 14:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (input.substr(peg$currPos, peg$consts[bc[ip + 1]].length) === peg$consts[bc[ip + 1]]) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 15:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (input.substr(peg$currPos, peg$consts[bc[ip + 1]].length).toLowerCase() === peg$consts[bc[ip + 1]]) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 16:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (peg$consts[bc[ip + 1]].test(input.charAt(peg$currPos))) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 17:
              stack.push(input.substr(peg$currPos, bc[ip + 1]));
              peg$currPos += bc[ip + 1];
              ip += 2;
              break;

            case 18:
              stack.push(peg$consts[bc[ip + 1]]);
              peg$currPos += peg$consts[bc[ip + 1]].length;
              ip += 2;
              break;

            case 19:
              stack.push(peg$FAILED);
              if (peg$silentFails === 0) {
                peg$fail(peg$consts[bc[ip + 1]]);
              }
              ip += 2;
              break;

            case 20:
              peg$reportedPos = stack[stack.length - 1 - bc[ip + 1]];
              ip += 2;
              break;

            case 21:
              peg$reportedPos = peg$currPos;
              ip++;
              break;

            case 22:
              params = bc.slice(ip + 4, ip + 4 + bc[ip + 3]);
              for (i = 0; i < bc[ip + 3]; i++) {
                params[i] = stack[stack.length - 1 - params[i]];
              }

              stack.splice(
                stack.length - bc[ip + 2],
                bc[ip + 2],
                peg$consts[bc[ip + 1]].apply(null, params)
              );

              ip += 4 + bc[ip + 3];
              break;

            case 23:
              stack.push(peg$parseRule(bc[ip + 1]));
              ip += 2;
              break;

            case 24:
              peg$silentFails++;
              ip++;
              break;

            case 25:
              peg$silentFails--;
              ip++;
              break;

            default:
              throw new Error("Invalid opcode: " + bc[ip] + ".");
          }
        }

        if (ends.length > 0) {
          end = ends.pop();
          ip = ips.pop();
        } else {
          break;
        }
      }

      return stack[0];
    }


      options.data = {}; // Object to which header attributes will be assigned during parsing

      function list (first, rest) {
        return [first].concat(rest);
      }


    peg$result = peg$parseRule(peg$startRuleIndex);

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();

},{}],63:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Hacks - This file contains all of the things we
 * wish we didn't have to do, just for interop.  It is similar to
 * Utils, which provides actually useful and relevant functions for
 * a SIP library. Methods in this file are grouped by vendor, so
 * as to most easily track when particular hacks may not be necessary anymore.
 */

module.exports = function (SIP) {
var Hacks = {
  AllBrowsers: {
    maskDtls: function (sdp) {
      if (sdp) {
        sdp = sdp.replace(/ UDP\/TLS\/RTP\/SAVP/gmi, " RTP/SAVP");
      }
      return sdp;
    },
    unmaskDtls: function (sdp) {
      /**
       * Chrome does not handle DTLS correctly (Canaray does, but not production)
       * keeping Chrome as SDES until DTLS is fixed (comment out 'is_opera' condition)
       *
       * UPDATE: May 21, 2014
       * Chrome 35 now properly defaults to DTLS.  Only Opera remains using SDES
       *
       * UPDATE: 2014-09-24
       * Opera now supports DTLS by default as well.
       *
       **/
      return sdp.replace(/ RTP\/SAVP/gmi, " UDP/TLS/RTP/SAVP");
    }
  },
  Firefox: {
    /* Condition to detect if hacks are applicable */
    isFirefox: function () {
      return typeof mozRTCPeerConnection !== 'undefined';
    },

    cannotHandleExtraWhitespace: function (sdp) {
      if (this.isFirefox() && sdp) {
        sdp = sdp.replace(/ \r\n/g, "\r\n");
      }
      return sdp;
    },

    hasMissingCLineInSDP: function (sdp) {
      /*
       * This is a Firefox hack to insert valid sdp when getDescription is
       * called with the constraint offerToReceiveVideo = false.
       * We search for either a c-line at the top of the sdp above all
       * m-lines. If that does not exist then we search for a c-line
       * beneath each m-line. If it is missing a c-line, we insert
       * a fake c-line with the ip address 0.0.0.0. This is then valid
       * sdp and no media will be sent for that m-line.
       *
       * Valid SDP is:
       * m=
       * i=
       * c=
       */
      var insertAt, mlines;
      if (sdp.indexOf('c=') > sdp.indexOf('m=')) {

        // Find all m= lines
        mlines = sdp.match(/m=.*\r\n.*/g);
        for (var i=0; i<mlines.length; i++) {

          // If it has an i= line, check if the next line is the c= line
          if (mlines[i].toString().search(/i=.*/) >= 0) {
            insertAt = sdp.indexOf(mlines[i].toString())+mlines[i].toString().length;
            if (sdp.substr(insertAt,2)!=='c=') {
              sdp = sdp.substr(0,insertAt) + '\r\nc=IN IP4 0.0.0.0' + sdp.substr(insertAt);
            }

          // else add the C line if it's missing
          } else if (mlines[i].toString().search(/c=.*/) < 0) {
            insertAt = sdp.indexOf(mlines[i].toString().match(/.*/))+mlines[i].toString().match(/.*/).toString().length;
            sdp = sdp.substr(0,insertAt) + '\r\nc=IN IP4 0.0.0.0' + sdp.substr(insertAt);
          }
        }
      }
      return sdp;
    },

    hasIncompatibleCLineWithSomeSIPEndpoints: function(sdp) {
      /*
       * Firefox appears to be following https://tools.ietf.org/html/rfc5245#section-9.1.1.1
       * and using a c line IP address of 0.0.0.0. This is completely valid, however it is
       * causing some endpoints (such as FreeSWITCH) to interpret the SDP as being on hold
       * https://freeswitch.org/jira/browse/FS-6955. To get around this issue we pull the
       * replace the c line with 1.1.1.1 which SIP clients do not interpret as hold.
       * This makes the other endpoint believe that the call is not on hold and audio flows
       * because ICE determines the media pathway (not the c line).
       */
      return sdp.replace(/(0\.0\.0\.0)/gmi, SIP.Utils.getRandomTestNetIP());
    }
  },

  Chrome: {
    needsExplicitlyInactiveSDP: function (sdp) {
      var sub, index;

      if (Hacks.Firefox.isFirefox()) { // Fix this in Firefox before sending
        index = sdp.indexOf('m=video 0');
        if (index !== -1) {
          sub = sdp.substr(index);
          sub = sub.replace(/\r\nc=IN IP4.*\r\n$/,
                            '\r\nc=IN IP4 0.0.0.0\r\na=inactive\r\n');
          return sdp.substr(0, index) + sub;
        }
      }
      return sdp;
    },

    getsConfusedAboutGUM: function (session) {
      if (session.mediaHandler) {
        session.mediaHandler.close();
      }
    }
  }
};
return Hacks;
};

},{}],64:[function(require,module,exports){
"use strict";
var levels = {
  'error': 0,
  'warn': 1,
  'log': 2,
  'debug': 3
};

module.exports = function (console) {

var LoggerFactory = function () {
  var logger,
    level = 2,
    builtinEnabled = true,
    connector = null;

    this.loggers = {};

    logger = this.getLogger('sip.loggerfactory');


  Object.defineProperties(this, {
    builtinEnabled: {
      get: function(){ return builtinEnabled; },
      set: function(value){
        if (typeof value === 'boolean') {
          builtinEnabled = value;
        } else {
          logger.error('invalid "builtinEnabled" parameter value: '+ JSON.stringify(value));
        }
      }
    },

    level: {
      get: function() {return level; },
      set: function(value) {
        if (value >= 0 && value <=3) {
          level = value;
        } else if (value > 3) {
          level = 3;
        } else if (levels.hasOwnProperty(value)) {
          level = levels[value];
        } else {
          logger.error('invalid "level" parameter value: '+ JSON.stringify(value));
        }
      }
    },

    connector: {
      get: function() {return connector; },
      set: function(value){
        if(value === null || value === "" || value === undefined) {
          connector = null;
        } else if (typeof value === 'function') {
          connector = value;
        } else {
          logger.error('invalid "connector" parameter value: '+ JSON.stringify(value));
        }
      }
    }
  });
};

LoggerFactory.prototype.print = function(target, category, label, content) {
  if (typeof content === 'string') {
    var prefix = [new Date(), category];
    if (label) {
      prefix.push(label);
    }
    content = prefix.concat(content).join(' | ');
  }
  target.call(console, content);
};

function Logger (logger, category, label) {
  this.logger = logger;
  this.category = category;
  this.label = label;
}

Object.keys(levels).forEach(function (targetName) {
  Logger.prototype[targetName] = function (content) {
    this.logger[targetName](this.category, this.label, content);
  };

  LoggerFactory.prototype[targetName] = function (category, label, content) {
    if (this.level >= levels[targetName]) {
      if (this.builtinEnabled) {
        this.print(console[targetName], category, label, content);
      }

      if (this.connector) {
        this.connector(targetName, category, label, content);
      }
    }
  };
});

LoggerFactory.prototype.getLogger = function(category, label) {
  var logger;

  if (label && this.level === 3) {
    return new Logger(this, category, label);
  } else if (this.loggers[category]) {
    return this.loggers[category];
  } else {
    logger = new Logger(this, category);
    this.loggers[category] = logger;
    return logger;
  }
};

return LoggerFactory;
};

},{}],65:[function(require,module,exports){
"use strict";
/**
 * @fileoverview MediaHandler
 */

/* MediaHandler
 * @class PeerConnection helper Class.
 * @param {SIP.Session} session
 * @param {Object} [options]
 */
module.exports = function (EventEmitter) {
var MediaHandler = function(session, options) {
  // keep jshint happy
  session = session;
  options = options;
};

MediaHandler.prototype = Object.create(EventEmitter.prototype, {
  isReady: {value: function isReady () {}},

  close: {value: function close () {}},

  /**
   * @param {Object} [mediaHint] A custom object describing the media to be used during this session.
   */
  getDescription: {value: function getDescription (mediaHint) {
    // keep jshint happy
    mediaHint = mediaHint;
  }},

  /**
   * Check if a SIP message contains a session description.
   * @param {SIP.SIPMessage} message
   * @returns {boolean}
   */
  hasDescription: {value: function hasDescription (message) {
    // keep jshint happy
    message = message;
  }},

  /**
   * Set the session description contained in a SIP message.
   * @param {SIP.SIPMessage} message
   * @returns {Promise}
   */
  setDescription: {value: function setDescription (message) {
    // keep jshint happy
    message = message;
  }}
});

return MediaHandler;
};

},{}],66:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP NameAddrHeader
 */

/**
 * @augments SIP
 * @class Class creating a Name Address SIP header.
 *
 * @param {SIP.URI} uri
 * @param {String} [displayName]
 * @param {Object} [parameters]
 *
 */
module.exports = function (SIP) {
var NameAddrHeader;

NameAddrHeader = function(uri, displayName, parameters) {
  var param;

  // Checks
  if(!uri || !(uri instanceof SIP.URI)) {
    throw new TypeError('missing or invalid "uri" parameter');
  }

  // Initialize parameters
  this.uri = uri;
  this.parameters = {};

  for (param in parameters) {
    this.setParam(param, parameters[param]);
  }

  Object.defineProperties(this, {
    friendlyName: {
      get: function() { return this.displayName || uri.aor; }
    },

    displayName: {
      get: function() { return displayName; },
      set: function(value) {
        displayName = (value === 0) ? '0' : value;
      }
    }
  });
};
NameAddrHeader.prototype = {
  setParam: function (key, value) {
    if(key) {
      this.parameters[key.toLowerCase()] = (typeof value === 'undefined' || value === null) ? null : value.toString();
    }
  },
  getParam: SIP.URI.prototype.getParam,
  hasParam: SIP.URI.prototype.hasParam,
  deleteParam: SIP.URI.prototype.deleteParam,
  clearParams: SIP.URI.prototype.clearParams,

  clone: function() {
    return new NameAddrHeader(
      this.uri.clone(),
      this.displayName,
      JSON.parse(JSON.stringify(this.parameters)));
  },

  toString: function() {
    var body, parameter;

    body  = (this.displayName || this.displayName === 0) ? '"' + this.displayName + '" ' : '';
    body += '<' + this.uri.toString() + '>';

    for (parameter in this.parameters) {
      body += ';' + parameter;

      if (this.parameters[parameter] !== null) {
        body += '='+ this.parameters[parameter];
      }
    }

    return body;
  }
};


/**
  * Parse the given string and returns a SIP.NameAddrHeader instance or undefined if
  * it is an invalid NameAddrHeader.
  * @public
  * @param {String} name_addr_header
  */
NameAddrHeader.parse = function(name_addr_header) {
  name_addr_header = SIP.Grammar.parse(name_addr_header,'Name_Addr_Header');

  if (name_addr_header !== -1) {
    return name_addr_header;
  } else {
    return undefined;
  }
};

SIP.NameAddrHeader = NameAddrHeader;
};

},{}],67:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Message Parser
 */

/**
 * Extract and parse every header of a SIP message.
 * @augments SIP
 * @namespace
 */
module.exports = function (SIP) {
var Parser;

function getHeader(data, headerStart) {
  var
    // 'start' position of the header.
    start = headerStart,
    // 'end' position of the header.
    end = 0,
    // 'partial end' position of the header.
    partialEnd = 0;

  //End of message.
  if (data.substring(start, start + 2).match(/(^\r\n)/)) {
    return -2;
  }

  while(end === 0) {
    // Partial End of Header.
    partialEnd = data.indexOf('\r\n', start);

    // 'indexOf' returns -1 if the value to be found never occurs.
    if (partialEnd === -1) {
      return partialEnd;
    }

    if(!data.substring(partialEnd + 2, partialEnd + 4).match(/(^\r\n)/) && data.charAt(partialEnd + 2).match(/(^\s+)/)) {
      // Not the end of the message. Continue from the next position.
      start = partialEnd + 2;
    } else {
      end = partialEnd;
    }
  }

  return end;
}

function parseHeader(message, data, headerStart, headerEnd) {
  var header, idx, length, parsed,
    hcolonIndex = data.indexOf(':', headerStart),
    headerName = data.substring(headerStart, hcolonIndex).trim(),
    headerValue = data.substring(hcolonIndex + 1, headerEnd).trim();

  // If header-field is well-known, parse it.
  switch(headerName.toLowerCase()) {
    case 'via':
    case 'v':
      message.addHeader('via', headerValue);
      if(message.getHeaders('via').length === 1) {
        parsed = message.parseHeader('Via');
        if(parsed) {
          message.via = parsed;
          message.via_branch = parsed.branch;
        }
      } else {
        parsed = 0;
      }
      break;
    case 'from':
    case 'f':
      message.setHeader('from', headerValue);
      parsed = message.parseHeader('from');
      if(parsed) {
        message.from = parsed;
        message.from_tag = parsed.getParam('tag');
      }
      break;
    case 'to':
    case 't':
      message.setHeader('to', headerValue);
      parsed = message.parseHeader('to');
      if(parsed) {
        message.to = parsed;
        message.to_tag = parsed.getParam('tag');
      }
      break;
    case 'record-route':
      parsed = SIP.Grammar.parse(headerValue, 'Record_Route');

      if (parsed === -1) {
        parsed = undefined;
        break;
      }

      length = parsed.length;
      for (idx = 0; idx < length; idx++) {
        header = parsed[idx];
        message.addHeader('record-route', headerValue.substring(header.position, header.offset));
        message.headers['Record-Route'][message.getHeaders('record-route').length - 1].parsed = header.parsed;
      }
      break;
    case 'call-id':
    case 'i':
      message.setHeader('call-id', headerValue);
      parsed = message.parseHeader('call-id');
      if(parsed) {
        message.call_id = headerValue;
      }
      break;
    case 'contact':
    case 'm':
      parsed = SIP.Grammar.parse(headerValue, 'Contact');

      if (parsed === -1) {
        parsed = undefined;
        break;
      }

      length = parsed.length;
      for (idx = 0; idx < length; idx++) {
        header = parsed[idx];
        message.addHeader('contact', headerValue.substring(header.position, header.offset));
        message.headers['Contact'][message.getHeaders('contact').length - 1].parsed = header.parsed;
      }
      break;
    case 'content-length':
    case 'l':
      message.setHeader('content-length', headerValue);
      parsed = message.parseHeader('content-length');
      break;
    case 'content-type':
    case 'c':
      message.setHeader('content-type', headerValue);
      parsed = message.parseHeader('content-type');
      break;
    case 'cseq':
      message.setHeader('cseq', headerValue);
      parsed = message.parseHeader('cseq');
      if(parsed) {
        message.cseq = parsed.value;
      }
      if(message instanceof SIP.IncomingResponse) {
        message.method = parsed.method;
      }
      break;
    case 'max-forwards':
      message.setHeader('max-forwards', headerValue);
      parsed = message.parseHeader('max-forwards');
      break;
    case 'www-authenticate':
      message.setHeader('www-authenticate', headerValue);
      parsed = message.parseHeader('www-authenticate');
      break;
    case 'proxy-authenticate':
      message.setHeader('proxy-authenticate', headerValue);
      parsed = message.parseHeader('proxy-authenticate');
      break;
    case 'refer-to':
    case 'r':
      message.setHeader('refer-to', headerValue);
      parsed = message.parseHeader('refer-to');
      if (parsed) {
        message.refer_to = parsed;
      }
      break;
    default:
      // Do not parse this header.
      message.setHeader(headerName, headerValue);
      parsed = 0;
  }

  if (parsed === undefined) {
    return {
      error: 'error parsing header "'+ headerName +'"'
    };
  } else {
    return true;
  }
}

/** Parse SIP Message
 * @function
 * @param {String} message SIP message.
 * @param {Object} logger object.
 * @returns {SIP.IncomingRequest|SIP.IncomingResponse|undefined}
 */
Parser = {};
Parser.parseMessage = function(data, ua) {
  var message, firstLine, contentLength, bodyStart, parsed,
    headerStart = 0,
    headerEnd = data.indexOf('\r\n'),
    logger = ua.getLogger('sip.parser');

  if(headerEnd === -1) {
    logger.warn('no CRLF found, not a SIP message, discarded');
    return;
  }

  // Parse first line. Check if it is a Request or a Reply.
  firstLine = data.substring(0, headerEnd);
  parsed = SIP.Grammar.parse(firstLine, 'Request_Response');

  if(parsed === -1) {
    logger.warn('error parsing first line of SIP message: "' + firstLine + '"');
    return;
  } else if(!parsed.status_code) {
    message = new SIP.IncomingRequest(ua);
    message.method = parsed.method;
    message.ruri = parsed.uri;
  } else {
    message = new SIP.IncomingResponse(ua);
    message.status_code = parsed.status_code;
    message.reason_phrase = parsed.reason_phrase;
  }

  message.data = data;
  headerStart = headerEnd + 2;

  /* Loop over every line in data. Detect the end of each header and parse
  * it or simply add to the headers collection.
  */
  while(true) {
    headerEnd = getHeader(data, headerStart);

    // The SIP message has normally finished.
    if(headerEnd === -2) {
      bodyStart = headerStart + 2;
      break;
    }
    // data.indexOf returned -1 due to a malformed message.
    else if(headerEnd === -1) {
      logger.error('malformed message');
      return;
    }

    parsed = parseHeader(message, data, headerStart, headerEnd);

    if(parsed !== true) {
      logger.error(parsed.error);
      return;
    }

    headerStart = headerEnd + 2;
  }

  /* RFC3261 18.3.
   * If there are additional bytes in the transport packet
   * beyond the end of the body, they MUST be discarded.
   */
  if(message.hasHeader('content-length')) {
    contentLength = message.getHeader('content-length');
    message.body = data.substr(bodyStart, contentLength);
  } else {
    message.body = data.substring(bodyStart);
  }

  return message;
};

SIP.Parser = Parser;
};

},{}],68:[function(require,module,exports){
var localMinSE = 90;

module.exports = function (Timers) {

// http://tools.ietf.org/html/rfc4028#section-9
function hasSmallMinSE (message) {
  var supportedOptions = message.parseHeader('Supported') || [];
  var sessionExpires = message.parseHeader('Session-Expires') || {};
  return supportedOptions.indexOf('timer') >= 0 && sessionExpires.deltaSeconds < localMinSE;
}

// `response` is an IncomingResponse or a String (outgoing response)
function updateState (dialog, response, parseMessage, ua) {
  dialog.sessionTimerState = dialog.sessionTimerState || {};
  Timers.clearTimeout(dialog.sessionTimerState.timeout);

  var isUAS = typeof response === 'string';
  if (isUAS) {
    response = parseMessage(response, ua);
  }

  var sessionExpires = response.parseHeader('Session-Expires');
  // If the most recent 2xx response had no Session-Expires header field, there
  // is no session expiration, and no refreshes have to be performed
  if (!sessionExpires) {
    dialog.sessionTimerState = null;
    return;
  }

  var interval = sessionExpires.deltaSeconds;
  var isRefresher = isUAS === (sessionExpires.refresher === 'uas');

  dialog.sessionTimerState = {
    interval: interval,
    isRefresher: isRefresher
  };

  var intervalMilliseconds = interval * 1000;
  var self = this;
  if (isRefresher) {
    dialog.sessionTimerState.timeout = Timers.setInterval(function sendRefresh () {
      var exists = dialog.owner.ua.dialogs[dialog.id.toString()] || false;
      if (exists) {
        dialog.sendRequest(self, "UPDATE", { extraHeaders: ["Session-Expires: " + interval]});
      } else {
        Timers.clearInterval(dialog.sessionTimerState.timeout);
      }
    }, intervalMilliseconds / 2);
  } else {
    var before = Math.min(32 * 1000, intervalMilliseconds / 3);
    dialog.sessionTimerState.timeout = Timers.setTimeout(function sendBye () {
      // TODO
    }, intervalMilliseconds - before);
  }
}

function receiveResponse(response) {
  /* jshint unused: false */
}

function onDialogError(response) {
  /* jshint unused: false */
}

return {
  localMinSE: localMinSE,
  hasSmallMinSE: hasSmallMinSE,
  updateState: updateState,
  receiveResponse: receiveResponse,
  onDialogError: onDialogError
};

};

},{}],69:[function(require,module,exports){
"use strict";
module.exports = function (SIP) {

var RegisterContext;

RegisterContext = function (ua) {
  var params = {},
      regId = 1;

  this.registrar = ua.configuration.registrarServer;
  this.expires = ua.configuration.registerExpires;


  // Contact header
  this.contact = ua.contact.toString();

  if(regId) {
    this.contact += ';reg-id='+ regId;
    this.contact += ';+sip.instance="<urn:uuid:'+ ua.configuration.instanceId+'>"';
  }

  // Call-ID and CSeq values RFC3261 10.2
  this.call_id = SIP.Utils.createRandomToken(22);
  this.cseq = 80;

  this.to_uri = ua.configuration.uri;

  params.to_uri = this.to_uri;
  params.call_id = this.call_id;
  params.cseq = this.cseq;

  // Extends ClientContext
  SIP.Utils.augment(this, SIP.ClientContext, [ua, 'REGISTER', this.registrar, {params: params}]);

  this.registrationTimer = null;
  this.registrationExpiredTimer = null;

  // Set status
  this.registered = false;

  this.logger = ua.getLogger('sip.registercontext');
};

RegisterContext.prototype = {
  register: function (options) {
    var self = this, extraHeaders;

    // Handle Options
    this.options = options || {};
    extraHeaders = (this.options.extraHeaders || []).slice();
    extraHeaders.push('Contact: ' + this.contact + ';expires=' + this.expires);
    extraHeaders.push('Allow: ' + SIP.Utils.getAllowedMethods(this.ua));

    // Save original extraHeaders to be used in .close
    this.closeHeaders = this.options.closeWithHeaders ?
      (this.options.extraHeaders || []).slice() : [];

    this.receiveResponse = function(response) {
      var contact, expires,
        contacts = response.getHeaders('contact').length,
        cause;

      // Discard responses to older REGISTER/un-REGISTER requests.
      if(response.cseq !== this.cseq) {
        return;
      }

      // Clear registration timer
      if (this.registrationTimer !== null) {
        SIP.Timers.clearTimeout(this.registrationTimer);
        this.registrationTimer = null;
      }

      switch(true) {
        case /^1[0-9]{2}$/.test(response.status_code):
          this.emit('progress', response);
          break;
        case /^2[0-9]{2}$/.test(response.status_code):
          this.emit('accepted', response);

          if(response.hasHeader('expires')) {
            expires = response.getHeader('expires');
          }

          if (this.registrationExpiredTimer !== null) {
            SIP.Timers.clearTimeout(this.registrationExpiredTimer);
            this.registrationExpiredTimer = null;
          }

          // Search the Contact pointing to us and update the expires value accordingly.
          if (!contacts) {
            this.logger.warn('no Contact header in response to REGISTER, response ignored');
            break;
          }

          while(contacts--) {
            contact = response.parseHeader('contact', contacts);
            if(contact.uri.user === this.ua.contact.uri.user) {
              expires = contact.getParam('expires');
              break;
            } else {
              contact = null;
            }
          }

          if (!contact) {
            this.logger.warn('no Contact header pointing to us, response ignored');
            break;
          }

          if(!expires) {
            expires = this.expires;
          }

          // Re-Register before the expiration interval has elapsed.
          // For that, decrease the expires value. ie: 3 seconds
          this.registrationTimer = SIP.Timers.setTimeout(function() {
            self.registrationTimer = null;
            self.register(self.options);
          }, (expires * 1000) - 3000);
          this.registrationExpiredTimer = SIP.Timers.setTimeout(function () {
            self.logger.warn('registration expired');
            if (self.registered) {
              self.unregistered(null, SIP.C.causes.EXPIRES);
            }
          }, expires * 1000);

          //Save gruu values
          if (contact.hasParam('temp-gruu')) {
            this.ua.contact.temp_gruu = SIP.URI.parse(contact.getParam('temp-gruu').replace(/"/g,''));
          }
          if (contact.hasParam('pub-gruu')) {
            this.ua.contact.pub_gruu = SIP.URI.parse(contact.getParam('pub-gruu').replace(/"/g,''));
          }

          this.registered = true;
          this.emit('registered', response || null);
          break;
        // Interval too brief RFC3261 10.2.8
        case /^423$/.test(response.status_code):
          if(response.hasHeader('min-expires')) {
            // Increase our registration interval to the suggested minimum
            this.expires = response.getHeader('min-expires');
            // Attempt the registration again immediately
            this.register(this.options);
          } else { //This response MUST contain a Min-Expires header field
            this.logger.warn('423 response received for REGISTER without Min-Expires');
            this.registrationFailure(response, SIP.C.causes.SIP_FAILURE_CODE);
          }
          break;
        default:
          cause = SIP.Utils.sipErrorCause(response.status_code);
          this.registrationFailure(response, cause);
      }
    };

    this.onRequestTimeout = function() {
      this.registrationFailure(null, SIP.C.causes.REQUEST_TIMEOUT);
    };

    this.onTransportError = function() {
      this.registrationFailure(null, SIP.C.causes.CONNECTION_ERROR);
    };

    this.cseq++;
    this.request.cseq = this.cseq;
    this.request.setHeader('cseq', this.cseq + ' REGISTER');
    this.request.extraHeaders = extraHeaders;
    this.send();
  },

  registrationFailure: function (response, cause) {
    this.emit('failed', response || null, cause || null);
  },

  onTransportClosed: function() {
    this.registered_before = this.registered;
    if (this.registrationTimer !== null) {
      SIP.Timers.clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    if (this.registrationExpiredTimer !== null) {
      SIP.Timers.clearTimeout(this.registrationExpiredTimer);
      this.registrationExpiredTimer = null;
    }

    if(this.registered) {
      this.unregistered(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onTransportConnected: function() {
    this.register(this.options);
  },

  close: function() {
    var options = {
      all: false,
      extraHeaders: this.closeHeaders
    };

    this.registered_before = this.registered;
    this.unregister(options);
  },

  unregister: function(options) {
    var extraHeaders;

    options = options || {};

    if(!this.registered && !options.all) {
      this.logger.warn('already unregistered');
      return;
    }

    extraHeaders = (options.extraHeaders || []).slice();

    this.registered = false;

    // Clear the registration timer.
    if (this.registrationTimer !== null) {
      SIP.Timers.clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    if(options.all) {
      extraHeaders.push('Contact: *');
      extraHeaders.push('Expires: 0');
    } else {
      extraHeaders.push('Contact: '+ this.contact + ';expires=0');
    }


    this.receiveResponse = function(response) {
      var cause;

      switch(true) {
        case /^1[0-9]{2}$/.test(response.status_code):
          this.emit('progress', response);
          break;
        case /^2[0-9]{2}$/.test(response.status_code):
          this.emit('accepted', response);
          if (this.registrationExpiredTimer !== null) {
            SIP.Timers.clearTimeout(this.registrationExpiredTimer);
            this.registrationExpiredTimer = null;
          }
          this.unregistered(response);
          break;
        default:
          cause = SIP.Utils.sipErrorCause(response.status_code);
          this.unregistered(response,cause);
      }
    };

    this.onRequestTimeout = function() {
      // Not actually unregistered...
      //this.unregistered(null, SIP.C.causes.REQUEST_TIMEOUT);
    };

    this.onTransportError = function() {
      // Not actually unregistered...
      //this.unregistered(null, SIP.C.causes.CONNECTION_ERROR);
    };

    this.cseq++;
    this.request.cseq = this.cseq;
    this.request.setHeader('cseq', this.cseq + ' REGISTER');
    this.request.extraHeaders = extraHeaders;

    this.send();
  },

  unregistered: function(response, cause) {
    this.registered = false;
    this.emit('unregistered', response || null, cause || null);
  }

};


SIP.RegisterContext = RegisterContext;
};

},{}],70:[function(require,module,exports){
"use strict";

/**
 * @fileoverview Request Sender
 */

/**
 * @augments SIP
 * @class Class creating a request sender.
 * @param {Object} applicant
 * @param {SIP.UA} ua
 */
module.exports = function (SIP) {
var RequestSender;

RequestSender = function(applicant, ua) {
  this.logger = ua.getLogger('sip.requestsender');
  this.ua = ua;
  this.applicant = applicant;
  this.method = applicant.request.method;
  this.request = applicant.request;
  this.credentials = null;
  this.challenged = false;
  this.staled = false;

  // If ua is in closing process or even closed just allow sending Bye and ACK
  if (ua.status === SIP.UA.C.STATUS_USER_CLOSED && (this.method !== SIP.C.BYE || this.method !== SIP.C.ACK)) {
    this.onTransportError();
  }
};

/**
* Create the client transaction and send the message.
*/
RequestSender.prototype = {
  send: function() {
    switch(this.method) {
      case "INVITE":
        this.clientTransaction = new SIP.Transactions.InviteClientTransaction(this, this.request, this.ua.transport);
        break;
      case "ACK":
        this.clientTransaction = new SIP.Transactions.AckClientTransaction(this, this.request, this.ua.transport);
        break;
      default:
        this.clientTransaction = new SIP.Transactions.NonInviteClientTransaction(this, this.request, this.ua.transport);
    }
    this.clientTransaction.send();

    return this.clientTransaction;
  },

  /**
  * Callback fired when receiving a request timeout error from the client transaction.
  * To be re-defined by the applicant.
  * @event
  */
  onRequestTimeout: function() {
    this.applicant.onRequestTimeout();
  },

  /**
  * Callback fired when receiving a transport error from the client transaction.
  * To be re-defined by the applicant.
  * @event
  */
  onTransportError: function() {
    this.applicant.onTransportError();
  },

  /**
  * Called from client transaction when receiving a correct response to the request.
  * Authenticate request if needed or pass the response back to the applicant.
  * @param {SIP.IncomingResponse} response
  */
  receiveResponse: function(response) {
    var cseq, challenge, authorization_header_name,
      status_code = response.status_code;

    /*
    * Authentication
    * Authenticate once. _challenged_ flag used to avoid infinite authentications.
    */
    if (status_code === 401 || status_code === 407) {

      // Get and parse the appropriate WWW-Authenticate or Proxy-Authenticate header.
      if (response.status_code === 401) {
        challenge = response.parseHeader('www-authenticate');
        authorization_header_name = 'authorization';
      } else {
        challenge = response.parseHeader('proxy-authenticate');
        authorization_header_name = 'proxy-authorization';
      }

      // Verify it seems a valid challenge.
      if (! challenge) {
        this.logger.warn(response.status_code + ' with wrong or missing challenge, cannot authenticate');
        this.applicant.receiveResponse(response);
        return;
      }

      if (!this.challenged || (!this.staled && challenge.stale === true)) {
        if (!this.credentials) {
          this.credentials = this.ua.configuration.authenticationFactory(this.ua);
        }

        // Verify that the challenge is really valid.
        if (!this.credentials.authenticate(this.request, challenge)) {
          this.applicant.receiveResponse(response);
          return;
        }
        this.challenged = true;

        if (challenge.stale) {
          this.staled = true;
        }

        if (response.method === SIP.C.REGISTER) {
          cseq = this.applicant.cseq += 1;
        } else if (this.request.dialog){
          cseq = this.request.dialog.local_seqnum += 1;
        } else {
          cseq = this.request.cseq + 1;
          this.request.cseq = cseq;
        }
        this.request.setHeader('cseq', cseq +' '+ this.method);

        this.request.setHeader(authorization_header_name, this.credentials.toString());
        this.send();
      } else {
        this.applicant.receiveResponse(response);
      }
    } else {
      this.applicant.receiveResponse(response);
    }
  }
};

SIP.RequestSender = RequestSender;
};

},{}],71:[function(require,module,exports){
/**
 * @name SIP
 * @namespace
 */
"use strict";

var SIP = {};
module.exports = function (environment) {

var pkg = require('../package.json');

Object.defineProperties(SIP, {
  version: {
    get: function(){ return pkg.version; }
  },
  name: {
    get: function(){ return pkg.title; }
  }
});

require('./Utils')(SIP, environment);
SIP.LoggerFactory = require('./LoggerFactory')(environment.console);
SIP.EventEmitter = require('./EventEmitter')(environment.console);
SIP.C = require('./Constants')(SIP.name, SIP.version);
SIP.Exceptions = require('./Exceptions');
SIP.Timers = require('./Timers')(environment.timers);
SIP.Transport = environment.Transport(SIP, environment.WebSocket);
require('./Parser')(SIP);
require('./SIPMessage')(SIP);
require('./URI')(SIP);
require('./NameAddrHeader')(SIP);
require('./Transactions')(SIP);
require('./Dialogs')(SIP);
require('./RequestSender')(SIP);
require('./RegisterContext')(SIP);
SIP.MediaHandler = require('./MediaHandler')(SIP.EventEmitter);
require('./ClientContext')(SIP);
require('./ServerContext')(SIP);
require('./Session')(SIP, environment);
require('./Subscription')(SIP);
SIP.WebRTC = require('./WebRTC')(SIP, environment);
require('./UA')(SIP, environment);
SIP.Hacks = require('./Hacks')(SIP);
require('./SanityCheck')(SIP);
SIP.DigestAuthentication = require('./DigestAuthentication')(SIP.Utils);
SIP.Grammar = require('./Grammar')(SIP);

return SIP;
};

},{"../package.json":53,"./ClientContext":54,"./Constants":55,"./Dialogs":57,"./DigestAuthentication":58,"./EventEmitter":59,"./Exceptions":60,"./Grammar":61,"./Hacks":63,"./LoggerFactory":64,"./MediaHandler":65,"./NameAddrHeader":66,"./Parser":67,"./RegisterContext":69,"./RequestSender":70,"./SIPMessage":72,"./SanityCheck":73,"./ServerContext":74,"./Session":75,"./Subscription":77,"./Timers":78,"./Transactions":79,"./UA":81,"./URI":82,"./Utils":83,"./WebRTC":84}],72:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Message
 */

module.exports = function (SIP) {
var
  OutgoingRequest,
  IncomingMessage,
  IncomingRequest,
  IncomingResponse;

function getSupportedHeader (request) {
  var allowUnregistered = request.ua.configuration.hackAllowUnregisteredOptionTags;
  var optionTags = [];
  var optionTagSet = {};

  if (request.method === SIP.C.REGISTER) {
    optionTags.push('path', 'gruu');
  } else if (request.method === SIP.C.INVITE &&
             (request.ua.contact.pub_gruu || request.ua.contact.temp_gruu)) {
    optionTags.push('gruu');
  }

  if (request.ua.configuration.rel100 === SIP.C.supported.SUPPORTED) {
    optionTags.push('100rel');
  }
  if (request.ua.configuration.replaces === SIP.C.supported.SUPPORTED) {
    optionTags.push('replaces');
  }

  optionTags.push('outbound');

  optionTags = optionTags.concat(request.ua.configuration.extraSupported);

  optionTags = optionTags.filter(function(optionTag) {
    var registered = SIP.C.OPTION_TAGS[optionTag];
    var unique = !optionTagSet[optionTag];
    optionTagSet[optionTag] = true;
    return (registered || allowUnregistered) && unique;
  });

  return 'Supported: ' + optionTags.join(', ') + '\r\n';
}

/**
 * @augments SIP
 * @class Class for outgoing SIP request.
 * @param {String} method request method
 * @param {String} ruri request uri
 * @param {SIP.UA} ua
 * @param {Object} params parameters that will have priority over ua.configuration parameters:
 * <br>
 *  - cseq, call_id, from_tag, from_uri, from_displayName, to_uri, to_tag, route_set
 * @param {Object} [headers] extra headers
 * @param {String} [body]
 */
OutgoingRequest = function(method, ruri, ua, params, extraHeaders, body) {
  var
    to,
    from,
    call_id,
    cseq,
    to_uri,
    from_uri;

  params = params || {};

  // Mandatory parameters check
  if(!method || !ruri || !ua) {
    return null;
  }

  this.logger = ua.getLogger('sip.sipmessage');
  this.ua = ua;
  this.headers = {};
  this.method = method;
  this.ruri = ruri;
  this.body = body;
  this.extraHeaders = (extraHeaders || []).slice();
  this.statusCode = params.status_code;
  this.reasonPhrase = params.reason_phrase;

  // Fill the Common SIP Request Headers

  // Route
  if (params.route_set) {
    this.setHeader('route', params.route_set);
  } else if (ua.configuration.usePreloadedRoute){
    this.setHeader('route', ua.transport.server.sip_uri);
  }

  // Via
  // Empty Via header. Will be filled by the client transaction.
  this.setHeader('via', '');

  // Max-Forwards
  this.setHeader('max-forwards', SIP.UA.C.MAX_FORWARDS);

  // To
  to_uri = params.to_uri || ruri;
  to = (params.to_displayName || params.to_displayName === 0) ? '"' + params.to_displayName + '" ' : '';
  to += '<' + (to_uri && to_uri.toRaw ? to_uri.toRaw() : to_uri) + '>';
  to += params.to_tag ? ';tag=' + params.to_tag : '';
  this.to = new SIP.NameAddrHeader.parse(to);
  this.setHeader('to', to);

  // From
  from_uri = params.from_uri || ua.configuration.uri;
  if (params.from_displayName || params.from_displayName === 0) {
    from = '"' + params.from_displayName + '" ';
  } else if (ua.configuration.displayName) {
    from = '"' + ua.configuration.displayName + '" ';
  } else {
    from = '';
  }
  from += '<' + (from_uri && from_uri.toRaw ? from_uri.toRaw() : from_uri) + '>;tag=';
  from += params.from_tag || SIP.Utils.newTag();
  this.from = new SIP.NameAddrHeader.parse(from);
  this.setHeader('from', from);

  // Call-ID
  call_id = params.call_id || (ua.configuration.sipjsId + SIP.Utils.createRandomToken(15));
  this.call_id = call_id;
  this.setHeader('call-id', call_id);

  // CSeq
  cseq = params.cseq || Math.floor(Math.random() * 10000);
  this.cseq = cseq;
  this.setHeader('cseq', cseq + ' ' + method);
};

OutgoingRequest.prototype = {
  /**
   * Replace the the given header by the given value.
   * @param {String} name header name
   * @param {String | Array} value header value
   */
  setHeader: function(name, value) {
    this.headers[SIP.Utils.headerize(name)] = (value instanceof Array) ? value : [value];
  },

  /**
   * Get the value of the given header name at the given position.
   * @param {String} name header name
   * @returns {String|undefined} Returns the specified header, undefined if header doesn't exist.
   */
  getHeader: function(name) {
    var regexp, idx,
      length = this.extraHeaders.length,
      header = this.headers[SIP.Utils.headerize(name)];

    if(header) {
      if(header[0]) {
        return header[0];
      }
    } else {
      regexp = new RegExp('^\\s*' + name + '\\s*:','i');
      for (idx = 0; idx < length; idx++) {
        header = this.extraHeaders[idx];
        if (regexp.test(header)) {
          return header.substring(header.indexOf(':')+1).trim();
        }
      }
    }

    return;
  },

  /**
   * Get the header/s of the given name.
   * @param {String} name header name
   * @returns {Array} Array with all the headers of the specified name.
   */
  getHeaders: function(name) {
    var idx, length, regexp,
      header = this.headers[SIP.Utils.headerize(name)],
      result = [];

    if(header) {
      length = header.length;
      for (idx = 0; idx < length; idx++) {
        result.push(header[idx]);
      }
      return result;
    } else {
      length = this.extraHeaders.length;
      regexp = new RegExp('^\\s*' + name + '\\s*:','i');
      for (idx = 0; idx < length; idx++) {
        header = this.extraHeaders[idx];
        if (regexp.test(header)) {
          result.push(header.substring(header.indexOf(':')+1).trim());
        }
      }
      return result;
    }
  },

  /**
   * Verify the existence of the given header.
   * @param {String} name header name
   * @returns {boolean} true if header with given name exists, false otherwise
   */
  hasHeader: function(name) {
    var regexp, idx,
      length = this.extraHeaders.length;

    if (this.headers[SIP.Utils.headerize(name)]) {
      return true;
    } else {
      regexp = new RegExp('^\\s*' + name + '\\s*:','i');
      for (idx = 0; idx < length; idx++) {
        if (regexp.test(this.extraHeaders[idx])) {
          return true;
        }
      }
    }

    return false;
  },

  toString: function() {
    var msg = '', header, length, idx;

    msg += this.method + ' ' + (this.ruri.toRaw ? this.ruri.toRaw() : this.ruri) + ' SIP/2.0\r\n';

    for (header in this.headers) {
      length = this.headers[header].length;
      for (idx = 0; idx < length; idx++) {
        msg += header + ': ' + this.headers[header][idx] + '\r\n';
      }
    }

    length = this.extraHeaders.length;
    for (idx = 0; idx < length; idx++) {
      msg += this.extraHeaders[idx].trim() +'\r\n';
    }

    msg += getSupportedHeader(this);
    msg += 'User-Agent: ' + this.ua.configuration.userAgentString +'\r\n';

    if(this.body) {
      length = SIP.Utils.str_utf8_length(this.body);
      msg += 'Content-Length: ' + length + '\r\n\r\n';
      msg += this.body;
    } else {
      msg += 'Content-Length: 0\r\n\r\n';
    }

    return msg;
  }
};

/**
 * @augments SIP
 * @class Class for incoming SIP message.
 */
IncomingMessage = function(){
  this.data = null;
  this.headers = null;
  this.method =  null;
  this.via = null;
  this.via_branch = null;
  this.call_id = null;
  this.cseq = null;
  this.from = null;
  this.from_tag = null;
  this.to = null;
  this.to_tag = null;
  this.body = null;
};

IncomingMessage.prototype = {
  /**
  * Insert a header of the given name and value into the last position of the
  * header array.
  * @param {String} name header name
  * @param {String} value header value
  */
  addHeader: function(name, value) {
    var header = { raw: value };

    name = SIP.Utils.headerize(name);

    if(this.headers[name]) {
      this.headers[name].push(header);
    } else {
      this.headers[name] = [header];
    }
  },

  /**
   * Get the value of the given header name at the given position.
   * @param {String} name header name
   * @returns {String|undefined} Returns the specified header, null if header doesn't exist.
   */
  getHeader: function(name) {
    var header = this.headers[SIP.Utils.headerize(name)];

    if(header) {
      if(header[0]) {
        return header[0].raw;
      }
    } else {
      return;
    }
  },

  /**
   * Get the header/s of the given name.
   * @param {String} name header name
   * @returns {Array} Array with all the headers of the specified name.
   */
  getHeaders: function(name) {
    var idx, length,
      header = this.headers[SIP.Utils.headerize(name)],
      result = [];

    if(!header) {
      return [];
    }

    length = header.length;
    for (idx = 0; idx < length; idx++) {
      result.push(header[idx].raw);
    }

    return result;
  },

  /**
   * Verify the existence of the given header.
   * @param {String} name header name
   * @returns {boolean} true if header with given name exists, false otherwise
   */
  hasHeader: function(name) {
    return(this.headers[SIP.Utils.headerize(name)]) ? true : false;
  },

  /**
  * Parse the given header on the given index.
  * @param {String} name header name
  * @param {Number} [idx=0] header index
  * @returns {Object|undefined} Parsed header object, undefined if the header is not present or in case of a parsing error.
  */
  parseHeader: function(name, idx) {
    var header, value, parsed;

    name = SIP.Utils.headerize(name);

    idx = idx || 0;

    if(!this.headers[name]) {
      this.logger.log('header "' + name + '" not present');
      return;
    } else if(idx >= this.headers[name].length) {
      this.logger.log('not so many "' + name + '" headers present');
      return;
    }

    header = this.headers[name][idx];
    value = header.raw;

    if(header.parsed) {
      return header.parsed;
    }

    //substitute '-' by '_' for grammar rule matching.
    parsed = SIP.Grammar.parse(value, name.replace(/-/g, '_'));

    if(parsed === -1) {
      this.headers[name].splice(idx, 1); //delete from headers
      this.logger.warn('error parsing "' + name + '" header field with value "' + value + '"');
      return;
    } else {
      header.parsed = parsed;
      return parsed;
    }
  },

  /**
   * Message Header attribute selector. Alias of parseHeader.
   * @param {String} name header name
   * @param {Number} [idx=0] header index
   * @returns {Object|undefined} Parsed header object, undefined if the header is not present or in case of a parsing error.
   *
   * @example
   * message.s('via',3).port
   */
  s: function(name, idx) {
    return this.parseHeader(name, idx);
  },

  /**
  * Replace the value of the given header by the value.
  * @param {String} name header name
  * @param {String} value header value
  */
  setHeader: function(name, value) {
    var header = { raw: value };
    this.headers[SIP.Utils.headerize(name)] = [header];
  },

  toString: function() {
    return this.data;
  }
};

/**
 * @augments IncomingMessage
 * @class Class for incoming SIP request.
 */
IncomingRequest = function(ua) {
  this.logger = ua.getLogger('sip.sipmessage');
  this.ua = ua;
  this.headers = {};
  this.ruri = null;
  this.transport = null;
  this.server_transaction = null;
};
IncomingRequest.prototype = new IncomingMessage();

/**
* Stateful reply.
* @param {Number} code status code
* @param {String} reason reason phrase
* @param {Object} headers extra headers
* @param {String} body body
* @param {Function} [onSuccess] onSuccess callback
* @param {Function} [onFailure] onFailure callback
*/
IncomingRequest.prototype.reply = function(code, reason, extraHeaders, body, onSuccess, onFailure) {
  var rr, vias, length, idx, response,
    to = this.getHeader('To'),
    r = 0,
    v = 0;

  response = SIP.Utils.buildStatusLine(code, reason);
  extraHeaders = (extraHeaders || []).slice();

  if(this.method === SIP.C.INVITE && code > 100 && code <= 200) {
    rr = this.getHeaders('record-route');
    length = rr.length;

    for(r; r < length; r++) {
      response += 'Record-Route: ' + rr[r] + '\r\n';
    }
  }

  vias = this.getHeaders('via');
  length = vias.length;

  for(v; v < length; v++) {
    response += 'Via: ' + vias[v] + '\r\n';
  }

  if(!this.to_tag && code > 100) {
    to += ';tag=' + SIP.Utils.newTag();
  } else if(this.to_tag && !this.s('to').hasParam('tag')) {
    to += ';tag=' + this.to_tag;
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + this.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + this.call_id + '\r\n';
  response += 'CSeq: ' + this.cseq + ' ' + this.method + '\r\n';

  length = extraHeaders.length;
  for (idx = 0; idx < length; idx++) {
    response += extraHeaders[idx].trim() +'\r\n';
  }

  response += getSupportedHeader(this);
  response += 'User-Agent: ' + this.ua.configuration.userAgentString +'\r\n';

  if(body) {
    length = SIP.Utils.str_utf8_length(body);
    response += 'Content-Type: application/sdp\r\n';
    response += 'Content-Length: ' + length + '\r\n\r\n';
    response += body;
  } else {
    response += 'Content-Length: ' + 0 + '\r\n\r\n';
  }

  this.server_transaction.receiveResponse(code, response).then(onSuccess, onFailure);

  return response;
};

/**
* Stateless reply.
* @param {Number} code status code
* @param {String} reason reason phrase
*/
IncomingRequest.prototype.reply_sl = function(code, reason) {
  var to, response,
    v = 0,
    vias = this.getHeaders('via'),
    length = vias.length;

  response = SIP.Utils.buildStatusLine(code, reason);

  for(v; v < length; v++) {
    response += 'Via: ' + vias[v] + '\r\n';
  }

  to = this.getHeader('To');

  if(!this.to_tag && code > 100) {
    to += ';tag=' + SIP.Utils.newTag();
  } else if(this.to_tag && !this.s('to').hasParam('tag')) {
    to += ';tag=' + this.to_tag;
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + this.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + this.call_id + '\r\n';
  response += 'CSeq: ' + this.cseq + ' ' + this.method + '\r\n';
  response += 'User-Agent: ' + this.ua.configuration.userAgentString +'\r\n';
  response += 'Content-Length: ' + 0 + '\r\n\r\n';

  this.transport.send(response);
};


/**
 * @augments IncomingMessage
 * @class Class for incoming SIP response.
 */
IncomingResponse = function(ua) {
  this.logger = ua.getLogger('sip.sipmessage');
  this.headers = {};
  this.status_code = null;
  this.reason_phrase = null;
};
IncomingResponse.prototype = new IncomingMessage();

SIP.OutgoingRequest = OutgoingRequest;
SIP.IncomingRequest = IncomingRequest;
SIP.IncomingResponse = IncomingResponse;
};

},{}],73:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Incoming SIP Message Sanity Check
 */

/**
 * SIP message sanity check.
 * @augments SIP
 * @function
 * @param {SIP.IncomingMessage} message
 * @param {SIP.UA} ua
 * @param {SIP.Transport} transport
 * @returns {Boolean}
 */
module.exports = function (SIP) {
var sanityCheck,
 logger,
 message, ua, transport,
 requests = [],
 responses = [],
 all = [];

/*
 * Sanity Check for incoming Messages
 *
 * Requests:
 *  - _rfc3261_8_2_2_1_ Receive a Request with a non supported URI scheme
 *  - _rfc3261_16_3_4_ Receive a Request already sent by us
 *   Does not look at via sent-by but at sipjsId, which is inserted as
 *   a prefix in all initial requests generated by the ua
 *  - _rfc3261_18_3_request_ Body Content-Length
 *  - _rfc3261_8_2_2_2_ Merged Requests
 *
 * Responses:
 *  - _rfc3261_8_1_3_3_ Multiple Via headers
 *  - _rfc3261_18_1_2_ sent-by mismatch
 *  - _rfc3261_18_3_response_ Body Content-Length
 *
 * All:
 *  - Minimum headers in a SIP message
 */

// Sanity Check functions for requests
function rfc3261_8_2_2_1() {
  if(!message.ruri || message.ruri.scheme !== 'sip') {
    reply(416);
    return false;
  }
}

function rfc3261_16_3_4() {
  if(!message.to_tag) {
    if(message.call_id.substr(0, 5) === ua.configuration.sipjsId) {
      reply(482);
      return false;
    }
  }
}

function rfc3261_18_3_request() {
  var len = SIP.Utils.str_utf8_length(message.body),
  contentLength = message.getHeader('content-length');

  if(len < contentLength) {
    reply(400);
    return false;
  }
}

function rfc3261_8_2_2_2() {
  var tr, idx,
    fromTag = message.from_tag,
    call_id = message.call_id,
    cseq = message.cseq;

  if(!message.to_tag) {
    if(message.method === SIP.C.INVITE) {
      tr = ua.transactions.ist[message.via_branch];
      if(tr) {
        return;
      } else {
        for(idx in ua.transactions.ist) {
          tr = ua.transactions.ist[idx];
          if(tr.request.from_tag === fromTag && tr.request.call_id === call_id && tr.request.cseq === cseq) {
            reply(482);
            return false;
          }
        }
      }
    } else {
      tr = ua.transactions.nist[message.via_branch];
      if(tr) {
        return;
      } else {
        for(idx in ua.transactions.nist) {
          tr = ua.transactions.nist[idx];
          if(tr.request.from_tag === fromTag && tr.request.call_id === call_id && tr.request.cseq === cseq) {
            reply(482);
            return false;
          }
        }
      }
    }
  }
}

// Sanity Check functions for responses
function rfc3261_8_1_3_3() {
  if(message.getHeaders('via').length > 1) {
    logger.warn('More than one Via header field present in the response. Dropping the response');
    return false;
  }
}

function rfc3261_18_1_2() {
  var viaHost = ua.configuration.viaHost;
  if(message.via.host !== viaHost || message.via.port !== undefined) {
    logger.warn('Via sent-by in the response does not match UA Via host value. Dropping the response');
    return false;
  }
}

function rfc3261_18_3_response() {
  var
    len = SIP.Utils.str_utf8_length(message.body),
    contentLength = message.getHeader('content-length');

    if(len < contentLength) {
      logger.warn('Message body length is lower than the value in Content-Length header field. Dropping the response');
      return false;
    }
}

// Sanity Check functions for requests and responses
function minimumHeaders() {
  var
    mandatoryHeaders = ['from', 'to', 'call_id', 'cseq', 'via'],
    idx = mandatoryHeaders.length;

  while(idx--) {
    if(!message.hasHeader(mandatoryHeaders[idx])) {
      logger.warn('Missing mandatory header field : '+ mandatoryHeaders[idx] +'. Dropping the response');
      return false;
    }
  }
}

// Reply
function reply(status_code) {
  var to,
    response = SIP.Utils.buildStatusLine(status_code),
    vias = message.getHeaders('via'),
    length = vias.length,
    idx = 0;

  for(idx; idx < length; idx++) {
    response += "Via: " + vias[idx] + "\r\n";
  }

  to = message.getHeader('To');

  if(!message.to_tag) {
    to += ';tag=' + SIP.Utils.newTag();
  }

  response += "To: " + to + "\r\n";
  response += "From: " + message.getHeader('From') + "\r\n";
  response += "Call-ID: " + message.call_id + "\r\n";
  response += "CSeq: " + message.cseq + " " + message.method + "\r\n";
  response += "\r\n";

  transport.send(response);
}

requests.push(rfc3261_8_2_2_1);
requests.push(rfc3261_16_3_4);
requests.push(rfc3261_18_3_request);
requests.push(rfc3261_8_2_2_2);

responses.push(rfc3261_8_1_3_3);
// responses.push(rfc3261_18_1_2);
responses.push(rfc3261_18_3_response);

all.push(minimumHeaders);

sanityCheck = function(m, u, t) {
  var len, pass;

  message = m;
  ua = u;
  transport = t;

  logger = ua.getLogger('sip.sanitycheck');

  len = all.length;
  while(len--) {
    pass = all[len](message);
    if(pass === false) {
      return false;
    }
  }

  if(message instanceof SIP.IncomingRequest) {
    len = requests.length;
    while(len--) {
      pass = requests[len](message);
      if(pass === false) {
        return false;
      }
    }
  }

  else if(message instanceof SIP.IncomingResponse) {
    len = responses.length;
    while(len--) {
      pass = responses[len](message);
      if(pass === false) {
        return false;
      }
    }
  }

  //Everything is OK
  return true;
};

SIP.sanityCheck = sanityCheck;
};

},{}],74:[function(require,module,exports){
"use strict";
module.exports = function (SIP) {
var ServerContext;

ServerContext = function (ua, request) {
  this.ua = ua;
  this.logger = ua.getLogger('sip.servercontext');
  this.request = request;
  if (request.method === SIP.C.INVITE) {
    this.transaction = new SIP.Transactions.InviteServerTransaction(request, ua);
  } else {
    this.transaction = new SIP.Transactions.NonInviteServerTransaction(request, ua);
  }

  if (request.body) {
    this.body = request.body;
  }
  if (request.hasHeader('Content-Type')) {
    this.contentType = request.getHeader('Content-Type');
  }
  this.method = request.method;

  this.data = {};

  this.localIdentity = request.to;
  this.remoteIdentity = request.from;
};

ServerContext.prototype = Object.create(SIP.EventEmitter.prototype);

ServerContext.prototype.progress = function (options) {
  options = Object.create(options || Object.prototype);
  options.statusCode || (options.statusCode = 180);
  options.minCode = 100;
  options.maxCode = 199;
  options.events = ['progress'];
  return this.reply(options);
};

ServerContext.prototype.accept = function (options) {
  options = Object.create(options || Object.prototype);
  options.statusCode || (options.statusCode = 200);
  options.minCode = 200;
  options.maxCode = 299;
  options.events = ['accepted'];
  return this.reply(options);
};

ServerContext.prototype.reject = function (options) {
  options = Object.create(options || Object.prototype);
  options.statusCode || (options.statusCode = 480);
  options.minCode = 300;
  options.maxCode = 699;
  options.events = ['rejected', 'failed'];
  return this.reply(options);
};

ServerContext.prototype.reply = function (options) {
  options = options || {}; // This is okay, so long as we treat options as read-only in this method
  var
    statusCode = options.statusCode || 100,
    minCode = options.minCode || 100,
    maxCode = options.maxCode || 699,
    reasonPhrase = SIP.Utils.getReasonPhrase(statusCode, options.reasonPhrase),
    extraHeaders = options.extraHeaders || [],
    body = options.body,
    events = options.events || [],
    response;

  if (statusCode < minCode || statusCode > maxCode) {
    throw new TypeError('Invalid statusCode: ' + statusCode);
  }
  response = this.request.reply(statusCode, reasonPhrase, extraHeaders, body);
  events.forEach(function (event) {
    this.emit(event, response, reasonPhrase);
  }, this);

  return this;
};

ServerContext.prototype.onRequestTimeout = function () {
  this.emit('failed', null, SIP.C.causes.REQUEST_TIMEOUT);
};

ServerContext.prototype.onTransportError = function () {
  this.emit('failed', null, SIP.C.causes.CONNECTION_ERROR);
};

SIP.ServerContext = ServerContext;
};

},{}],75:[function(require,module,exports){
"use strict";
module.exports = function (SIP, environment) {

var DTMF = require('./Session/DTMF')(SIP);
var RFC4028 = require('./RFC4028')(SIP.Timers);

var Session, InviteServerContext, InviteClientContext,
 C = {
    //Session states
    STATUS_NULL:                        0,
    STATUS_INVITE_SENT:                 1,
    STATUS_1XX_RECEIVED:                2,
    STATUS_INVITE_RECEIVED:             3,
    STATUS_WAITING_FOR_ANSWER:          4,
    STATUS_ANSWERED:                    5,
    STATUS_WAITING_FOR_PRACK:           6,
    STATUS_WAITING_FOR_ACK:             7,
    STATUS_CANCELED:                    8,
    STATUS_TERMINATED:                  9,
    STATUS_ANSWERED_WAITING_FOR_PRACK: 10,
    STATUS_EARLY_MEDIA:                11,
    STATUS_CONFIRMED:                  12
  };

/*
 * @param {function returning SIP.MediaHandler} [mediaHandlerFactory]
 *        (See the documentation for the mediaHandlerFactory argument of the UA constructor.)
 */
Session = function (mediaHandlerFactory) {
  this.status = C.STATUS_NULL;
  this.dialog = null;
  this.earlyDialogs = {};
  this.mediaHandlerFactory = mediaHandlerFactory || SIP.WebRTC.MediaHandler.defaultFactory;
  // this.mediaHandler gets set by ICC/ISC constructors
  this.hasOffer = false;
  this.hasAnswer = false;

  // Session Timers
  this.timers = {
    ackTimer: null,
    expiresTimer: null,
    invite2xxTimer: null,
    userNoAnswerTimer: null,
    rel1xxTimer: null,
    prackTimer: null
  };

  // Session info
  this.startTime = null;
  this.endTime = null;
  this.tones = null;

  // Mute/Hold state
  this.local_hold = false;
  this.remote_hold = false;

  this.pending_actions = {
    actions: [],

    length: function() {
      return this.actions.length;
    },

    isPending: function(name){
      var
      idx = 0,
      length = this.actions.length;

      for (idx; idx<length; idx++) {
        if (this.actions[idx].name === name) {
          return true;
        }
      }
      return false;
    },

    shift: function() {
      return this.actions.shift();
    },

    push: function(name) {
      this.actions.push({
        name: name
      });
    },

    pop: function(name) {
      var
      idx = 0,
      length = this.actions.length;

      for (idx; idx<length; idx++) {
        if (this.actions[idx].name === name) {
          this.actions.splice(idx,1);
          length --;
          idx--;
        }
      }
    }
   };

  this.early_sdp = null;
  this.rel100 = SIP.C.supported.UNSUPPORTED;
};

Session.prototype = {
  dtmf: function(tones, options) {
    var tone, dtmfs = [],
        self = this;

    options = options || {};

    if (tones === undefined) {
      throw new TypeError('Not enough arguments');
    }

    // Check Session Status
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_WAITING_FOR_ACK) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    // Check tones
    if ((typeof tones !== 'string' && typeof tones !== 'number') || !tones.toString().match(/^[0-9A-D#*,]+$/i)) {
      throw new TypeError('Invalid tones: '+ tones);
    }

    tones = tones.toString().split('');

    while (tones.length > 0) { dtmfs.push(new DTMF(this, tones.shift(), options)); }

    if (this.tones) {
      // Tones are already queued, just add to the queue
      this.tones =  this.tones.concat(dtmfs);
      return this;
    }

    var sendDTMF = function () {
      var dtmf, timeout;

      if (self.status === C.STATUS_TERMINATED || !self.tones || self.tones.length === 0) {
        // Stop sending DTMF
        self.tones = null;
        return this;
      }

      dtmf = self.tones.shift();

      if (tone === ',') {
        timeout = 2000;
      } else {
        dtmf.on('failed', function(){self.tones = null;});
        dtmf.send(options);
        timeout = dtmf.duration + dtmf.interToneGap;
      }

      // Set timeout for the next tone
      SIP.Timers.setTimeout(sendDTMF, timeout);
    };

    this.tones = dtmfs;
    sendDTMF();
    return this;
  },

  bye: function(options) {
    options = Object.create(options || Object.prototype);
    var statusCode = options.statusCode;

    // Check Session Status
    if (this.status === C.STATUS_TERMINATED) {
      this.logger.error('Error: Attempted to send BYE in a terminated session.');
      return this;
    }

    this.logger.log('terminating Session');

    if (statusCode && (statusCode < 200 || statusCode >= 700)) {
      throw new TypeError('Invalid statusCode: '+ statusCode);
    }

    options.receiveResponse = function () {};

    return this.
      sendRequest(SIP.C.BYE, options).
      terminated();
  },

  refer: function(target, options) {
    options = options || {};
    var extraHeaders = (options.extraHeaders || []).slice(),
        withReplaces =
          target instanceof SIP.InviteServerContext ||
          target instanceof SIP.InviteClientContext,
        originalTarget = target;

    if (target === undefined) {
      throw new TypeError('Not enough arguments');
    }

    // Check Session Status
    if (this.status !== C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    // transform `target` so that it can be a Refer-To header value
    if (withReplaces) {
      //Attended Transfer
      // B.transfer(C)
      target = '"' + target.remoteIdentity.friendlyName + '" ' +
        '<' + target.dialog.remote_target.toString() +
        '?Replaces=' + target.dialog.id.call_id +
        '%3Bto-tag%3D' + target.dialog.id.remote_tag +
        '%3Bfrom-tag%3D' + target.dialog.id.local_tag + '>';
    } else {
      //Blind Transfer
      // normalizeTarget allows instances of SIP.URI to pass through unaltered,
      // so try to make one ahead of time
      try {
        target = SIP.Grammar.parse(target, 'Refer_To').uri || target;
      } catch (e) {
        this.logger.debug(".refer() cannot parse Refer_To from", target);
        this.logger.debug("...falling through to normalizeTarget()");
      }

      // Check target validity
      target = this.ua.normalizeTarget(target);
      if (!target) {
        throw new TypeError('Invalid target: ' + originalTarget);
      }
    }

    extraHeaders.push('Contact: '+ this.contact);
    extraHeaders.push('Allow: '+ SIP.Utils.getAllowedMethods(this.ua));
    extraHeaders.push('Refer-To: '+ target);

    // Send the request
    this.sendRequest(SIP.C.REFER, {
      extraHeaders: extraHeaders,
      body: options.body,
      receiveResponse: function (response) {
        if ( ! /^2[0-9]{2}$/.test(response.status_code) ) {
          return;
        }
        // hang up only if we transferred to a SIP address
        if (withReplaces || (target.scheme && target.scheme.match("^sips?$"))) {
          this.terminate();
        }
      }.bind(this)
    });
    return this;
  },

  followRefer: function followRefer (callback) {
    return function referListener (callback, request) {
      // open non-SIP URIs if possible and keep session open
      var referTo = request.parseHeader('refer-to');
      var target = referTo.uri;
      if (!target.scheme.match("^sips?$")) {
        var targetString = target.toString();
        if (typeof environment.open === "function") {
          environment.open(targetString);
        } else {
          this.logger.warn("referred to non-SIP URI but `open` isn't in the environment: " + targetString);
        }
        return;
      }

      var extraHeaders = [];

      /* Copy the Replaces query into a Replaces header */
      /* TODO - make sure we don't copy a poorly formatted header? */
      var replaces = target.getHeader('Replaces');
      if (replaces !== undefined) {
        extraHeaders.push('Replaces: ' + decodeURIComponent(replaces));
      }

      // don't embed headers into Request-URI of INVITE
      target.clearHeaders();

      /*
        Harmless race condition.  Both sides of REFER
        may send a BYE, but in the end the dialogs are destroyed.
      */
      var getReferMedia = this.mediaHandler.getReferMedia;
      var mediaHint = getReferMedia ? getReferMedia.call(this.mediaHandler) : this.mediaHint;

      SIP.Hacks.Chrome.getsConfusedAboutGUM(this);

      var referSession = this.ua.invite(target, {
        media: mediaHint,
        params: {
          to_displayName: referTo.friendlyName
        },
        extraHeaders: extraHeaders
      });

      callback.call(this, request, referSession);

      this.terminate();
    }.bind(this, callback);
  },

  sendRequest: function(method,options) {
    options = options || {};
    var self = this;

    var request = new SIP.OutgoingRequest(
      method,
      this.dialog.remote_target,
      this.ua,
      {
        cseq: options.cseq || (this.dialog.local_seqnum += 1),
        call_id: this.dialog.id.call_id,
        from_uri: this.dialog.local_uri,
        from_tag: this.dialog.id.local_tag,
        to_uri: this.dialog.remote_uri,
        to_tag: this.dialog.id.remote_tag,
        route_set: this.dialog.route_set,
        statusCode: options.statusCode,
        reasonPhrase: options.reasonPhrase
      },
      options.extraHeaders || [],
      options.body
    );

    new SIP.RequestSender({
      request: request,
      onRequestTimeout: function() {
        self.onRequestTimeout();
      },
      onTransportError: function() {
        self.onTransportError();
      },
      receiveResponse: options.receiveResponse || function(response) {
        self.receiveNonInviteResponse(response);
      }
    }, this.ua).send();

    // Emit the request event
    this.emit(method.toLowerCase(), request);

    return this;
  },

  close: function() {
    var idx;

    if(this.status === C.STATUS_TERMINATED) {
      return this;
    }

    this.logger.log('closing INVITE session ' + this.id);

    // 1st Step. Terminate media.
    if (this.mediaHandler){
      this.mediaHandler.close();
    }

    // 2nd Step. Terminate signaling.

    // Clear session timers
    for(idx in this.timers) {
      SIP.Timers.clearTimeout(this.timers[idx]);
    }

    // Terminate dialogs

    // Terminate confirmed dialog
    if(this.dialog) {
      this.dialog.terminate();
      delete this.dialog;
    }

    // Terminate early dialogs
    for(idx in this.earlyDialogs) {
      this.earlyDialogs[idx].terminate();
      delete this.earlyDialogs[idx];
    }

    this.status = C.STATUS_TERMINATED;

    delete this.ua.sessions[this.id];
    return this;
  },

  createDialog: function(message, type, early) {
    var dialog, early_dialog,
      local_tag = message[(type === 'UAS') ? 'to_tag' : 'from_tag'],
      remote_tag = message[(type === 'UAS') ? 'from_tag' : 'to_tag'],
      id = message.call_id + local_tag + remote_tag;

    early_dialog = this.earlyDialogs[id];

    // Early Dialog
    if (early) {
      if (early_dialog) {
        return true;
      } else {
        early_dialog = new SIP.Dialog(this, message, type, SIP.Dialog.C.STATUS_EARLY);

        // Dialog has been successfully created.
        if(early_dialog.error) {
          this.logger.error(early_dialog.error);
          this.failed(message, SIP.C.causes.INTERNAL_ERROR);
          return false;
        } else {
          this.earlyDialogs[id] = early_dialog;
          return true;
        }
      }
    }
    // Confirmed Dialog
    else {
      // In case the dialog is in _early_ state, update it
      if (early_dialog) {
        early_dialog.update(message, type);
        this.dialog = early_dialog;
        delete this.earlyDialogs[id];
        for (var dia in this.earlyDialogs) {
          this.earlyDialogs[dia].terminate();
          delete this.earlyDialogs[dia];
        }
        return true;
      }

      // Otherwise, create a _confirmed_ dialog
      dialog = new SIP.Dialog(this, message, type);

      if(dialog.error) {
        this.logger.error(dialog.error);
        this.failed(message, SIP.C.causes.INTERNAL_ERROR);
        return false;
      } else {
        this.to_tag = message.to_tag;
        this.dialog = dialog;
        return true;
      }
    }
  },

  /**
  * Check if Session is ready for a re-INVITE
  *
  * @returns {Boolean}
  */
  isReadyToReinvite: function() {
    return this.mediaHandler.isReady() &&
      !this.dialog.uac_pending_reply &&
      !this.dialog.uas_pending_reply;
  },

  /**
   * Mute
   */
  mute: function(options) {
    var ret = this.mediaHandler.mute(options);
    if (ret) {
      this.onmute(ret);
    }
  },

  /**
   * Unmute
   */
  unmute: function(options) {
    var ret = this.mediaHandler.unmute(options);
    if (ret) {
      this.onunmute(ret);
    }
  },

  /**
   * Hold
   */
  hold: function() {

    if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.mediaHandler.hold();

    // Check if RTCSession is ready to send a reINVITE
    if (!this.isReadyToReinvite()) {
      /* If there is a pending 'unhold' action, cancel it and don't queue this one
       * Else, if there isn't any 'hold' action, add this one to the queue
       * Else, if there is already a 'hold' action, skip
       */
      if (this.pending_actions.isPending('unhold')) {
        this.pending_actions.pop('unhold');
      } else if (!this.pending_actions.isPending('hold')) {
        this.pending_actions.push('hold');
      }
      return;
    } else if (this.local_hold === true) {
        return;
    }

    this.onhold('local');

    this.sendReinvite();
  },

  /**
   * Unhold
   */
  unhold: function() {

    if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.mediaHandler.unhold();

    if (!this.isReadyToReinvite()) {
      /* If there is a pending 'hold' action, cancel it and don't queue this one
       * Else, if there isn't any 'unhold' action, add this one to the queue
       * Else, if there is already a 'unhold' action, skip
       */
      if (this.pending_actions.isPending('hold')) {
        this.pending_actions.pop('hold');
      } else if (!this.pending_actions.isPending('unhold')) {
        this.pending_actions.push('unhold');
      }
      return;
    } else if (this.local_hold === false) {
      return;
    }

    this.onunhold('local');

    this.sendReinvite();
  },

  /**
   * isOnHold
   */
  isOnHold: function() {
    return {
      local: this.local_hold,
      remote: this.remote_hold
    };
  },

  /**
   * In dialog INVITE Reception
   * @private
   */
  receiveReinvite: function(request) {
    var self = this;

    if (!this.mediaHandler.hasDescription(request)) {
      this.logger.warn('invalid Content-Type');
      request.reply(415);
      return;
    }

    this.mediaHandler.setDescription(request)
    .then(this.mediaHandler.getDescription.bind(this.mediaHandler, this.mediaHint))
    .then(function(description) {
      var extraHeaders = ['Contact: ' + self.contact];
      if (description.extraHeaders) {
        extraHeaders = extraHeaders.concat(description.extraHeaders);
      }
      request.reply(200, null, extraHeaders, description.body,
        function() {
          self.status = C.STATUS_WAITING_FOR_ACK;
          self.setInvite2xxTimer(request, description);
          self.setACKTimer();

          // Are we holding?
          var hold = self.mediaHandler.onhold;

          if (self.remote_hold && !hold) {
            self.onunhold('remote');
          } else if (!self.remote_hold && hold) {
            self.onhold('remote');
          }
        });
    })
    .catch(function onFailure (e) {
      var statusCode;
      if (e instanceof SIP.Exceptions.GetDescriptionError) {
        statusCode = 500;
      } else {
        self.logger.error(e);
        statusCode = 488;
      }
      request.reply(statusCode);
    });
  },

  sendReinvite: function(options) {
    options = options || {};

    var
      self = this,
       extraHeaders = (options.extraHeaders || []).slice(),
       eventHandlers = options.eventHandlers || {};

    if (eventHandlers.succeeded) {
      this.reinviteSucceeded = eventHandlers.succeeded;
    } else {
      this.reinviteSucceeded = function(){
        SIP.Timers.clearTimeout(self.timers.ackTimer);
        SIP.Timers.clearTimeout(self.timers.invite2xxTimer);
        self.status = C.STATUS_CONFIRMED;
      };
    }
    if (eventHandlers.failed) {
      this.reinviteFailed = eventHandlers.failed;
    } else {
      this.reinviteFailed = function(){};
    }

    extraHeaders.push('Contact: ' + this.contact);
    extraHeaders.push('Allow: '+ SIP.Utils.getAllowedMethods(this.ua));

    this.receiveResponse = this.receiveReinviteResponse;
    //REVISIT
    this.mediaHandler.getDescription(self.mediaHint)
    .then(
      function(description){
        if (description.extraHeaders) {
          extraHeaders = extraHeaders.concat(description.extraHeaders);
        }
        self.dialog.sendRequest(self, SIP.C.INVITE, {
          extraHeaders: extraHeaders,
          body: description.body
        });
      },
      function() {
        if (self.isReadyToReinvite()) {
          self.onReadyToReinvite();
        }
        self.reinviteFailed();
      }
    );
  },

  receiveRequest: function (request) {
    switch (request.method) {
      case SIP.C.BYE:
        request.reply(200);
        if(this.status === C.STATUS_CONFIRMED) {
          this.emit('bye', request);
          this.terminated(request, SIP.C.causes.BYE);
        }
        break;
      case SIP.C.INVITE:
        if(this.status === C.STATUS_CONFIRMED) {
          this.logger.log('re-INVITE received');
          this.receiveReinvite(request);
        }
        break;
      case SIP.C.INFO:
        if(this.status === C.STATUS_CONFIRMED || this.status === C.STATUS_WAITING_FOR_ACK) {
          var body, tone, duration,
              contentType = request.getHeader('content-type'),
              reg_tone = /^(Signal\s*?=\s*?)([0-9A-D#*]{1})(\s)?.*/,
              reg_duration = /^(Duration\s?=\s?)([0-9]{1,4})(\s)?.*/;

          if (contentType) {
            if (contentType.match(/^application\/dtmf-relay/i)) {
              if (request.body) {
                body = request.body.split('\r\n', 2);
                if (body.length === 2) {
                  if (reg_tone.test(body[0])) {
                    tone = body[0].replace(reg_tone,"$2");
                  }
                  if (reg_duration.test(body[1])) {
                    duration = parseInt(body[1].replace(reg_duration,"$2"), 10);
                  }
                }
              }

              new DTMF(this, tone, {duration: duration}).init_incoming(request);
            } else {
              request.reply(415, null, ["Accept: application/dtmf-relay"]);
            }
          }
        }
        break;
      case SIP.C.REFER:
        if(this.status ===  C.STATUS_CONFIRMED) {
          this.logger.log('REFER received');
          request.reply(202, 'Accepted');
          var
            hasReferListener = this.listeners('refer').length,
            notifyBody = hasReferListener ?
              'SIP/2.0 100 Trying' :
              // RFC 3515.2.4.2: 'the UA MAY decline the request.'
              'SIP/2.0 603 Declined'
          ;

          this.sendRequest(SIP.C.NOTIFY, {
            extraHeaders:[
              'Event: refer',
              'Subscription-State: terminated',
              'Content-Type: message/sipfrag'
            ],
            body: notifyBody,
            receiveResponse: function() {}
          });

          if (hasReferListener) {
            this.emit('refer', request);
          }
        }
        break;
      case SIP.C.NOTIFY:
        request.reply(200, 'OK');
        this.emit('notify', request);
        break;
    }
  },

  /**
   * Reception of Response for in-dialog INVITE
   * @private
   */
  receiveReinviteResponse: function(response) {
    var self = this;

    if (this.status === C.STATUS_TERMINATED) {
      return;
    }

    switch(true) {
      case /^1[0-9]{2}$/.test(response.status_code):
        break;
      case /^2[0-9]{2}$/.test(response.status_code):
        this.status = C.STATUS_CONFIRMED;

        this.sendRequest(SIP.C.ACK,{cseq:response.cseq});

        if (!this.mediaHandler.hasDescription(response)) {
          this.reinviteFailed();
          break;
        }

        //REVISIT
        this.mediaHandler.setDescription(response)
        .then(
          function onSuccess () {
            self.reinviteSucceeded();
          },
          function onFailure () {
            self.reinviteFailed();
          }
        );
        break;
      default:
        this.reinviteFailed();
    }
  },

  acceptAndTerminate: function(response, status_code, reason_phrase) {
    var extraHeaders = [];

    if (status_code) {
      extraHeaders.push('Reason: ' + SIP.Utils.getReasonHeaderValue(status_code, reason_phrase));
    }

    // An error on dialog creation will fire 'failed' event
    if (this.dialog || this.createDialog(response, 'UAC')) {
      this.sendRequest(SIP.C.ACK,{cseq: response.cseq});
      this.sendRequest(SIP.C.BYE, {
        extraHeaders: extraHeaders
      });
    }

    return this;
  },

  /**
   * RFC3261 13.3.1.4
   * Response retransmissions cannot be accomplished by transaction layer
   *  since it is destroyed when receiving the first 2xx answer
   */
  setInvite2xxTimer: function(request, description) {
    var self = this,
        timeout = SIP.Timers.T1;

    this.timers.invite2xxTimer = SIP.Timers.setTimeout(function invite2xxRetransmission() {
      if (self.status !== C.STATUS_WAITING_FOR_ACK) {
        return;
      }

      self.logger.log('no ACK received, attempting to retransmit OK');

      var extraHeaders = ['Contact: ' + self.contact];
      if (description.extraHeaders) {
        extraHeaders = extraHeaders.concat(description.extraHeaders);
      }

      request.reply(200, null, description.extraHeaders, description.body);

      timeout = Math.min(timeout * 2, SIP.Timers.T2);

      self.timers.invite2xxTimer = SIP.Timers.setTimeout(invite2xxRetransmission, timeout);
    }, timeout);
  },

  /**
   * RFC3261 14.2
   * If a UAS generates a 2xx response and never receives an ACK,
   *  it SHOULD generate a BYE to terminate the dialog.
   */
  setACKTimer: function() {
    var self = this;

    this.timers.ackTimer = SIP.Timers.setTimeout(function() {
      if(self.status === C.STATUS_WAITING_FOR_ACK) {
        self.logger.log('no ACK received for an extended period of time, terminating the call');
        SIP.Timers.clearTimeout(self.timers.invite2xxTimer);
        self.sendRequest(SIP.C.BYE);
        self.terminated(null, SIP.C.causes.NO_ACK);
      }
    }, SIP.Timers.TIMER_H);
  },

  /*
   * @private
   */
  onReadyToReinvite: function() {
    var action = this.pending_actions.shift();

    if (!action || !this[action.name]) {
      return;
    }

    this[action.name]();
  },

  onTransportError: function() {
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onRequestTimeout: function() {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.REQUEST_TIMEOUT);
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    }
  },

  onDialogError: function(response) {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(response, SIP.C.causes.DIALOG_ERROR);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(response, SIP.C.causes.DIALOG_ERROR);
      this.terminated(response, SIP.C.causes.DIALOG_ERROR);
    }
  },

  /**
   * @private
   */
  onhold: function(originator) {
    this[originator === 'local' ? 'local_hold' : 'remote_hold'] = true;
    this.emit('hold', { originator: originator });
  },

  /**
   * @private
   */
  onunhold: function(originator) {
    this[originator === 'local' ? 'local_hold' : 'remote_hold'] = false;
    this.emit('unhold', { originator: originator });
  },

  /*
   * @private
   */
  onmute: function(options) {
    this.emit('muted', {
      audio: options.audio,
      video: options.video
    });
  },

  /*
   * @private
   */
  onunmute: function(options) {
    this.emit('unmuted', {
      audio: options.audio,
      video: options.video
    });
  },

  failed: function(response, cause) {
    if (this.status === C.STATUS_TERMINATED) {
      return this;
    }
    this.emit('failed', response || null, cause || null);
    return this;
  },

  rejected: function(response, cause) {
    this.emit('rejected',
      response || null,
      cause || null
    );
    return this;
  },

  canceled: function() {
    this.emit('cancel');
    return this;
  },

  accepted: function(response, cause) {
    cause = SIP.Utils.getReasonPhrase(response && response.status_code, cause);

    this.startTime = new Date();

    if (this.replacee) {
      this.replacee.emit('replaced', this);
      this.replacee.terminate();
    }
    if (response) {
      RFC4028.updateState(this.dialog, response, SIP.Parser.parseMessage, this.ua);
    }
    this.emit('accepted', response, cause);
    return this;
  },

  terminated: function(message, cause) {
    if (this.status === C.STATUS_TERMINATED) {
      return this;
    }

    this.endTime = new Date();

    this.close();
    this.emit('terminated',
      message || null,
      cause || null
    );
    return this;
  },

  connecting: function(request) {
    this.emit('connecting', { request: request });
    return this;
  }
};

Session.desugar = function desugar(options) {
  if (environment.HTMLMediaElement && options instanceof environment.HTMLMediaElement) {
    options = {
      media: {
        constraints: {
          audio: true,
          video: options.tagName === 'VIDEO'
        },
        render: {
          remote: options
        }
      }
    };
  }
  return options || {};
};


Session.C = C;
SIP.Session = Session;


InviteServerContext = function(ua, request) {
  var expires,
    self = this,
    contentType = request.getHeader('Content-Type'),
    contentDisp = request.parseHeader('Content-Disposition');

  SIP.Utils.augment(this, SIP.ServerContext, [ua, request]);
  SIP.Utils.augment(this, SIP.Session, [ua.configuration.mediaHandlerFactory]);

  //Initialize Media Session
  this.mediaHandler = this.mediaHandlerFactory(this, {
    RTCConstraints: {"optional": [{'DtlsSrtpKeyAgreement': 'true'}]}
  });

  // Check body and content type
  if ((!contentDisp && !this.mediaHandler.hasDescription(request)) || (contentDisp && contentDisp.type === 'render')) {
    this.renderbody = request.body;
    this.rendertype = contentType;
  } else if (!this.mediaHandler.hasDescription(request) && (contentDisp && contentDisp.type === 'session')) {
    request.reply(415);
    //TODO: instead of 415, pass off to the media handler, who can then decide if we can use it
    return;
  }

  // TODO test
  // http://tools.ietf.org/html/rfc4028#section-9
  if (RFC4028.hasSmallMinSE(request)) {
    request.reply(422, null, ['Min-SE: ' + RFC4028.localMinSE]);
    return;
  }

  this.status = C.STATUS_INVITE_RECEIVED;
  this.from_tag = request.from_tag;
  this.id = request.call_id + this.from_tag;
  this.request = request;
  this.contact = this.ua.contact.toString();

  this.receiveNonInviteResponse = function () {}; // intentional no-op

  this.logger = ua.getLogger('sip.inviteservercontext', this.id);

  //Save the session into the ua sessions collection.
  this.ua.sessions[this.id] = this;

  //Get the Expires header value if exists
  if(request.hasHeader('expires')) {
    expires = request.getHeader('expires') * 1000;
  }

  //Set 100rel if necessary
  function set100rel(h,c) {
    if (request.hasHeader(h) && request.getHeader(h).toLowerCase().indexOf('100rel') >= 0) {
      self.rel100 = c;
    }
  }
  set100rel('require', SIP.C.supported.REQUIRED);
  set100rel('supported', SIP.C.supported.SUPPORTED);

  /* Set the to_tag before
   * replying a response code that will create a dialog.
   */
  request.to_tag = SIP.Utils.newTag();

  // An error on dialog creation will fire 'failed' event
  if(!this.createDialog(request, 'UAS', true)) {
    request.reply(500, 'Missing Contact header field');
    return;
  }

  if (this.mediaHandler && this.mediaHandler.getRemoteStreams) {
    this.getRemoteStreams = this.mediaHandler.getRemoteStreams.bind(this.mediaHandler);
    this.getLocalStreams = this.mediaHandler.getLocalStreams.bind(this.mediaHandler);
  }

  function fireNewSession() {
    var options = {extraHeaders: ['Contact: ' + self.contact]};

    if (self.rel100 !== SIP.C.supported.REQUIRED) {
      self.progress(options);
    }
    self.status = C.STATUS_WAITING_FOR_ANSWER;

    // Set userNoAnswerTimer
    self.timers.userNoAnswerTimer = SIP.Timers.setTimeout(function() {
      request.reply(408);
      self.failed(request, SIP.C.causes.NO_ANSWER);
      self.terminated(request, SIP.C.causes.NO_ANSWER);
    }, self.ua.configuration.noAnswerTimeout);

    /* Set expiresTimer
     * RFC3261 13.3.1
     */
    if (expires) {
      self.timers.expiresTimer = SIP.Timers.setTimeout(function() {
        if(self.status === C.STATUS_WAITING_FOR_ANSWER) {
          request.reply(487);
          self.failed(request, SIP.C.causes.EXPIRES);
          self.terminated(request, SIP.C.causes.EXPIRES);
        }
      }, expires);
    }

    self.emit('invite',request);
  }

  if (!this.mediaHandler.hasDescription(request) || this.renderbody) {
    SIP.Timers.setTimeout(fireNewSession, 0);
  } else {
    this.hasOffer = true;
    this.mediaHandler.setDescription(request)
    .then(
      fireNewSession,
      function onFailure (e) {
        self.logger.warn('invalid description');
        self.logger.warn(e);
        request.reply(488);
      }
    );
  }
};

InviteServerContext.prototype = {
  reject: function(options) {
    // Check Session Status
    if (this.status === C.STATUS_TERMINATED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.logger.log('rejecting RTCSession');

    SIP.ServerContext.prototype.reject.call(this, options);
    return this.terminated();
  },

  terminate: function(options) {
    options = options || {};

    var
    extraHeaders = (options.extraHeaders || []).slice(),
    body = options.body,
    dialog,
    self = this;

    if (this.status === C.STATUS_WAITING_FOR_ACK &&
       this.request.server_transaction.state !== SIP.Transactions.C.STATUS_TERMINATED) {
      dialog = this.dialog;

      this.receiveRequest = function(request) {
        if (request.method === SIP.C.ACK) {
          this.request(SIP.C.BYE, {
            extraHeaders: extraHeaders,
            body: body
          });
          dialog.terminate();
        }
      };

      this.request.server_transaction.on('stateChanged', function(){
        if (this.state === SIP.Transactions.C.STATUS_TERMINATED) {
          this.request = new SIP.OutgoingRequest(
            SIP.C.BYE,
            this.dialog.remote_target,
            this.ua,
            {
              'cseq': this.dialog.local_seqnum+=1,
              'call_id': this.dialog.id.call_id,
              'from_uri': this.dialog.local_uri,
              'from_tag': this.dialog.id.local_tag,
              'to_uri': this.dialog.remote_uri,
              'to_tag': this.dialog.id.remote_tag,
              'route_set': this.dialog.route_set
            },
            extraHeaders,
            body
          );

          new SIP.RequestSender(
            {
              request: this.request,
              onRequestTimeout: function() {
                self.onRequestTimeout();
              },
              onTransportError: function() {
                self.onTransportError();
              },
              receiveResponse: function() {
                return;
              }
            },
            this.ua
          ).send();
          dialog.terminate();
        }
      });

      this.emit('bye', this.request);
      this.terminated();

      // Restore the dialog into 'this' in order to be able to send the in-dialog BYE :-)
      this.dialog = dialog;

      // Restore the dialog into 'ua' so the ACK can reach 'this' session
      this.ua.dialogs[dialog.id.toString()] = dialog;

    } else if (this.status === C.STATUS_CONFIRMED) {
      this.bye(options);
    } else {
      this.reject(options);
    }

    return this;
  },

  /*
   * @param {Object} [options.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
   */
  progress: function (options) {
    options = options || {};
    var
      statusCode = options.statusCode || 180,
      reasonPhrase = options.reasonPhrase,
      extraHeaders = (options.extraHeaders || []).slice(),
      body = options.body,
      response;

    if (statusCode < 100 || statusCode > 199) {
      throw new TypeError('Invalid statusCode: ' + statusCode);
    }

    if (this.isCanceled || this.status === C.STATUS_TERMINATED) {
      return this;
    }

    function do100rel() {
      /* jshint validthis: true */
      statusCode = options.statusCode || 183;

      // Set status and add extra headers
      this.status = C.STATUS_WAITING_FOR_PRACK;
      extraHeaders.push('Contact: '+ this.contact);
      extraHeaders.push('Require: 100rel');
      extraHeaders.push('RSeq: ' + Math.floor(Math.random() * 10000));

      // Save media hint for later (referred sessions)
      this.mediaHint = options.media;

      // Get the session description to add to preaccept with
      this.mediaHandler.getDescription(options.media)
      .then(
        function onSuccess (description) {
          if (this.isCanceled || this.status === C.STATUS_TERMINATED) {
            return;
          }

          this.early_sdp = description.body;
          this[this.hasOffer ? 'hasAnswer' : 'hasOffer'] = true;

          if (description.extraHeaders) {
            extraHeaders = extraHeaders.concat(description.extraHeaders);
          }

          // Retransmit until we get a response or we time out (see prackTimer below)
          var timeout = SIP.Timers.T1;
          this.timers.rel1xxTimer = SIP.Timers.setTimeout(function rel1xxRetransmission() {
            this.request.reply(statusCode, null, extraHeaders, description.body);
            timeout *= 2;
            this.timers.rel1xxTimer = SIP.Timers.setTimeout(rel1xxRetransmission.bind(this), timeout);
          }.bind(this), timeout);

          // Timeout and reject INVITE if no response
          this.timers.prackTimer = SIP.Timers.setTimeout(function () {
            if (this.status !== C.STATUS_WAITING_FOR_PRACK) {
              return;
            }

            this.logger.log('no PRACK received, rejecting the call');
            SIP.Timers.clearTimeout(this.timers.rel1xxTimer);
            this.request.reply(504);
            this.terminated(null, SIP.C.causes.NO_PRACK);
          }.bind(this), SIP.Timers.T1 * 64);

          // Send the initial response
          response = this.request.reply(statusCode, reasonPhrase, extraHeaders, description.body);
          this.emit('progress', response, reasonPhrase);
        }.bind(this),

        function onFailure () {
          this.request.reply(480);
          this.failed(null, SIP.C.causes.WEBRTC_ERROR);
          this.terminated(null, SIP.C.causes.WEBRTC_ERROR);
        }.bind(this)
      );
    } // end do100rel

    function normalReply() {
      /* jshint validthis:true */
      response = this.request.reply(statusCode, reasonPhrase, extraHeaders, body);
      this.emit('progress', response, reasonPhrase);
    }

    if (options.statusCode !== 100 &&
        (this.rel100 === SIP.C.supported.REQUIRED ||
         (this.rel100 === SIP.C.supported.SUPPORTED && options.rel100) ||
         (this.rel100 === SIP.C.supported.SUPPORTED && (this.ua.configuration.rel100 === SIP.C.supported.REQUIRED)))) {
      do100rel.apply(this);
    } else {
      normalReply.apply(this);
    }
    return this;
  },

  /*
   * @param {Object} [options.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
   */
  accept: function(options) {
    options = Object.create(Session.desugar(options));
    SIP.Utils.optionsOverride(options, 'media', 'mediaConstraints', true, this.logger, this.ua.configuration.media);
    this.mediaHint = options.media;

    // commented out now-unused hold-related variables for jshint. See below. JMF 2014-1-21
    var
      //idx, length, hasAudio, hasVideo,
      self = this,
      request = this.request,
      extraHeaders = (options.extraHeaders || []).slice(),
    //mediaStream = options.mediaStream || null,
      descriptionCreationSucceeded = function(description) {
        var
          response,
          // run for reply success callback
          replySucceeded = function() {
            self.status = C.STATUS_WAITING_FOR_ACK;

            self.setInvite2xxTimer(request, description);
            self.setACKTimer();
          },

          // run for reply failure callback
          replyFailed = function() {
            self.failed(null, SIP.C.causes.CONNECTION_ERROR);
            self.terminated(null, SIP.C.causes.CONNECTION_ERROR);
          };

        // Chrome might call onaddstream before accept() is called, which means
        // mediaHandler.render() was called without a renderHint, so we need to
        // re-render now that mediaHint.render has been set.
        //
        // Chrome seems to be in the right regarding this, see
        // http://dev.w3.org/2011/webrtc/editor/webrtc.html#widl-RTCPeerConnection-onaddstream
        self.mediaHandler.render();

        extraHeaders.push('Contact: ' + self.contact);
        extraHeaders.push('Allow: ' + SIP.Utils.getAllowedMethods(self.ua));

        // TODO test
        // http://tools.ietf.org/html/rfc4028#section-9
        var supportedOptions = request.parseHeader('Supported') || [];
        var sessionExpires = request.parseHeader('Session-Expires') || {};
        var interval = sessionExpires.deltaSeconds;
        if (interval) {
          var refresher = sessionExpires.refresher || 'uas';
          extraHeaders.push('Session-Expires: ' + interval + ';' + refresher);
          if (refresher === 'uac' || supportedOptions.indexOf('timer') >= 0) {
            extraHeaders.push('Require: timer');
          }
        }

        if (description.extraHeaders) {
          extraHeaders = extraHeaders.concat(description.extraHeaders);
        }

        if(!self.hasOffer) {
          self.hasOffer = true;
        } else {
          self.hasAnswer = true;
        }
        response = request.reply(200, null, extraHeaders,
                      description.body,
                      replySucceeded,
                      replyFailed
                     );
        if (self.status !== C.STATUS_TERMINATED) { // Didn't fail
          self.accepted(response, SIP.Utils.getReasonPhrase(200));
        }
      },

      descriptionCreationFailed = function() {
        if (self.status === C.STATUS_TERMINATED) {
          return;
        }
        // TODO - fail out on error
        self.request.reply(480);
        //self.failed(response, SIP.C.causes.USER_DENIED_MEDIA_ACCESS);
        self.failed(null, SIP.C.causes.WEBRTC_ERROR);
        self.terminated(null, SIP.C.causes.WEBRTC_ERROR);
      };

    // Check Session Status
    if (this.status === C.STATUS_WAITING_FOR_PRACK) {
      this.status = C.STATUS_ANSWERED_WAITING_FOR_PRACK;
      return this;
    } else if (this.status === C.STATUS_WAITING_FOR_ANSWER) {
      this.status = C.STATUS_ANSWERED;
    } else if (this.status !== C.STATUS_EARLY_MEDIA) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    // An error on dialog creation will fire 'failed' event
    if(!this.createDialog(request, 'UAS')) {
      request.reply(500, 'Missing Contact header field');
      return this;
    }

    SIP.Timers.clearTimeout(this.timers.userNoAnswerTimer);

    // this hold-related code breaks FF accepting new calls - JMF 2014-1-21
    /*
    length = this.getRemoteStreams().length;

    for (idx = 0; idx < length; idx++) {
      if (this.mediaHandler.getRemoteStreams()[idx].getVideoTracks().length > 0) {
        hasVideo = true;
      }
      if (this.mediaHandler.getRemoteStreams()[idx].getAudioTracks().length > 0) {
        hasAudio = true;
      }
    }

    if (!hasAudio && this.mediaConstraints.audio === true) {
      this.mediaConstraints.audio = false;
      if (mediaStream) {
        length = mediaStream.getAudioTracks().length;
        for (idx = 0; idx < length; idx++) {
          mediaStream.removeTrack(mediaStream.getAudioTracks()[idx]);
        }
      }
    }

    if (!hasVideo && this.mediaConstraints.video === true) {
      this.mediaConstraints.video = false;
      if (mediaStream) {
        length = mediaStream.getVideoTracks().length;
        for (idx = 0; idx < length; idx++) {
          mediaStream.removeTrack(mediaStream.getVideoTracks()[idx]);
        }
      }
    }
    */

    if (this.status === C.STATUS_EARLY_MEDIA) {
      descriptionCreationSucceeded({});
    } else {
      this.mediaHandler.getDescription(self.mediaHint)
      .then(
        descriptionCreationSucceeded,
        descriptionCreationFailed
      );
    }

    return this;
  },

  receiveRequest: function(request) {

    // ISC RECEIVE REQUEST

    function confirmSession() {
      /* jshint validthis:true */
      var contentType;

      SIP.Timers.clearTimeout(this.timers.ackTimer);
      SIP.Timers.clearTimeout(this.timers.invite2xxTimer);
      this.status = C.STATUS_CONFIRMED;
      this.unmute();

      // TODO - this logic assumes Content-Disposition defaults
      contentType = request.getHeader('Content-Type');
      if (!this.mediaHandler.hasDescription(request)) {
        this.renderbody = request.body;
        this.rendertype = contentType;
      }
    }

    switch(request.method) {
    case SIP.C.CANCEL:
      /* RFC3261 15 States that a UAS may have accepted an invitation while a CANCEL
       * was in progress and that the UAC MAY continue with the session established by
       * any 2xx response, or MAY terminate with BYE. SIP does continue with the
       * established session. So the CANCEL is processed only if the session is not yet
       * established.
       */

      /*
       * Terminate the whole session in case the user didn't accept (or yet to send the answer) nor reject the
       *request opening the session.
       */
      if(this.status === C.STATUS_WAITING_FOR_ANSWER ||
         this.status === C.STATUS_WAITING_FOR_PRACK ||
         this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK ||
         this.status === C.STATUS_EARLY_MEDIA ||
         this.status === C.STATUS_ANSWERED) {

        this.status = C.STATUS_CANCELED;
        this.request.reply(487);
        this.canceled(request);
        this.rejected(request, SIP.C.causes.CANCELED);
        this.failed(request, SIP.C.causes.CANCELED);
        this.terminated(request, SIP.C.causes.CANCELED);
      }
      break;
    case SIP.C.ACK:
      if(this.status === C.STATUS_WAITING_FOR_ACK) {
        if (!this.hasAnswer) {
          if(this.mediaHandler.hasDescription(request)) {
            // ACK contains answer to an INVITE w/o SDP negotiation
            this.hasAnswer = true;
            this.mediaHandler.setDescription(request)
            .then(
              confirmSession.bind(this),
              function onFailure (e) {
                this.logger.warn(e);
                this.terminate({
                  statusCode: '488',
                  reasonPhrase: 'Bad Media Description'
                });
                this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
                this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              }.bind(this)
            );
          } else if (this.early_sdp) {
            confirmSession.apply(this);
          } else {
            //TODO: Pass to mediahandler
            this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
          }
        } else {
          confirmSession.apply(this);
        }
      }
      break;
    case SIP.C.PRACK:
      if (this.status === C.STATUS_WAITING_FOR_PRACK || this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK) {
        //localMedia = session.mediaHandler.localMedia;
        if(!this.hasAnswer) {
          if(this.mediaHandler.hasDescription(request)) {
            this.hasAnswer = true;
            this.mediaHandler.setDescription(request)
            .then(
              function onSuccess () {
                SIP.Timers.clearTimeout(this.timers.rel1xxTimer);
                SIP.Timers.clearTimeout(this.timers.prackTimer);
                request.reply(200);
                if (this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK) {
                  this.status = C.STATUS_EARLY_MEDIA;
                  this.accept();
                }
                this.status = C.STATUS_EARLY_MEDIA;
                //REVISIT
                this.mute();
              }.bind(this),
              function onFailure (e) {
                //TODO: Send to media handler
                this.logger.warn(e);
                this.terminate({
                  statusCode: '488',
                  reasonPhrase: 'Bad Media Description'
                });
                this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
                this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              }.bind(this)
            );
          } else {
            this.terminate({
              statusCode: '488',
              reasonPhrase: 'Bad Media Description'
            });
            this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
          }
        } else {
          SIP.Timers.clearTimeout(this.timers.rel1xxTimer);
          SIP.Timers.clearTimeout(this.timers.prackTimer);
          request.reply(200);

          if (this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK) {
            this.status = C.STATUS_EARLY_MEDIA;
            this.accept();
          }
          this.status = C.STATUS_EARLY_MEDIA;
          //REVISIT
          this.mute();
        }
      } else if(this.status === C.STATUS_EARLY_MEDIA) {
        request.reply(200);
      }
      break;
    default:
      Session.prototype.receiveRequest.apply(this, [request]);
      break;
    }
  },

  onTransportError: function() {
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onRequestTimeout: function() {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.REQUEST_TIMEOUT);
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    }
  }

};

SIP.InviteServerContext = InviteServerContext;

InviteClientContext = function(ua, target, options) {
  options = Object.create(Session.desugar(options));
  options.params = Object.create(options.params || Object.prototype);

  var iceServers,
    extraHeaders = (options.extraHeaders || []).slice(),
    stunServers = options.stunServers || null,
    turnServers = options.turnServers || null,
    isMediaSupported = ua.configuration.mediaHandlerFactory.isSupported;

  // Check WebRTC support
  if (isMediaSupported && !isMediaSupported()) {
    throw new SIP.Exceptions.NotSupportedError('Media not supported');
  }

  this.RTCConstraints = options.RTCConstraints || {};
  this.inviteWithoutSdp = options.inviteWithoutSdp || false;

  // Set anonymous property
  this.anonymous = options.anonymous || false;

  // Custom data to be sent either in INVITE or in ACK
  this.renderbody = options.renderbody || null;
  this.rendertype = options.rendertype || 'text/plain';

  options.params.from_tag = this.from_tag;

  /* Do not add ;ob in initial forming dialog requests if the registration over
   *  the current connection got a GRUU URI.
   */
  this.contact = ua.contact.toString({
    anonymous: this.anonymous,
    outbound: this.anonymous ? !ua.contact.temp_gruu : !ua.contact.pub_gruu
  });

  if (this.anonymous) {
    options.params.from_displayName = 'Anonymous';
    options.params.from_uri = 'sip:anonymous@anonymous.invalid';

    extraHeaders.push('P-Preferred-Identity: '+ ua.configuration.uri.toString());
    extraHeaders.push('Privacy: id');
  }
  extraHeaders.push('Contact: '+ this.contact);
  extraHeaders.push('Allow: '+ SIP.Utils.getAllowedMethods(ua));
  if (this.inviteWithoutSdp && this.renderbody) {
    extraHeaders.push('Content-Type: ' + this.rendertype);
    extraHeaders.push('Content-Disposition: render;handling=optional');
  }

  if (ua.configuration.rel100 === SIP.C.supported.REQUIRED) {
    extraHeaders.push('Require: 100rel');
  }
  if (ua.configuration.replaces === SIP.C.supported.REQUIRED) {
    extraHeaders.push('Require: replaces');
  }

  options.extraHeaders = extraHeaders;

  SIP.Utils.augment(this, SIP.ClientContext, [ua, SIP.C.INVITE, target, options]);
  SIP.Utils.augment(this, SIP.Session, [ua.configuration.mediaHandlerFactory]);

  // Check Session Status
  if (this.status !== C.STATUS_NULL) {
    throw new SIP.Exceptions.InvalidStateError(this.status);
  }

  // Session parameter initialization
  this.from_tag = SIP.Utils.newTag();

  // OutgoingSession specific parameters
  this.isCanceled = false;
  this.received_100 = false;

  this.method = SIP.C.INVITE;

  this.receiveNonInviteResponse = this.receiveResponse;
  this.receiveResponse = this.receiveInviteResponse;

  this.logger = ua.getLogger('sip.inviteclientcontext');

  if (stunServers) {
    iceServers = SIP.UA.configuration_check.optional['stunServers'](stunServers);
    if (!iceServers) {
      throw new TypeError('Invalid stunServers: '+ stunServers);
    } else {
      this.stunServers = iceServers;
    }
  }

  if (turnServers) {
    iceServers = SIP.UA.configuration_check.optional['turnServers'](turnServers);
    if (!iceServers) {
      throw new TypeError('Invalid turnServers: '+ turnServers);
    } else {
      this.turnServers = iceServers;
    }
  }

  ua.applicants[this] = this;

  this.id = this.request.call_id + this.from_tag;

  //Initialize Media Session
  this.mediaHandler = this.mediaHandlerFactory(this, {
    RTCConstraints: this.RTCConstraints,
    stunServers: this.stunServers,
    turnServers: this.turnServers
  });

  if (this.mediaHandler && this.mediaHandler.getRemoteStreams) {
    this.getRemoteStreams = this.mediaHandler.getRemoteStreams.bind(this.mediaHandler);
    this.getLocalStreams = this.mediaHandler.getLocalStreams.bind(this.mediaHandler);
  }

  SIP.Utils.optionsOverride(options, 'media', 'mediaConstraints', true, this.logger, this.ua.configuration.media);
  this.mediaHint = options.media;
};

InviteClientContext.prototype = {
  invite: function () {
    var self = this;

    //Save the session into the ua sessions collection.
    //Note: placing in constructor breaks call to request.cancel on close... User does not need this anyway
    this.ua.sessions[this.id] = this;

    //Note: due to the way Firefox handles gUM calls, it is recommended to make the gUM call at the app level
    // and hand sip.js a stream as the mediaHint
    if (this.inviteWithoutSdp) {
      //just send an invite with no sdp...
      this.request.body = self.renderbody;
      this.status = C.STATUS_INVITE_SENT;
      this.send();
    } else {
      this.mediaHandler.getDescription(self.mediaHint)
      .then(
        function onSuccess(description) {
          if (self.isCanceled || self.status === C.STATUS_TERMINATED) {
            return;
          }
          self.hasOffer = true;
          self.request.body = description.body;
          self.status = C.STATUS_INVITE_SENT;
          if (description.extraHeaders) {
            self.request.extraHeaders = self.request.extraHeaders.concat(description.extraHeaders);
          }
          self.send();
        },
        function onFailure() {
          if (self.status === C.STATUS_TERMINATED) {
            return;
          }
          // TODO...fail out
          //self.failed(null, SIP.C.causes.USER_DENIED_MEDIA_ACCESS);
          //self.failed(null, SIP.C.causes.WEBRTC_ERROR);
          self.failed(null, SIP.C.causes.WEBRTC_ERROR);
          self.terminated(null, SIP.C.causes.WEBRTC_ERROR);
        }
      );
    }

    return this;
  },

  receiveInviteResponse: function(response) {
    var cause, //localMedia,
      session = this,
      id = response.call_id + response.from_tag + response.to_tag,
      extraHeaders = [],
      options = {};

    if (this.status === C.STATUS_TERMINATED || response.method !== SIP.C.INVITE) {
      return;
    }

    if (this.dialog && (response.status_code >= 200 && response.status_code <= 299)) {
      if (id !== this.dialog.id.toString() ) {
        if (!this.createDialog(response, 'UAC', true)) {
          return;
        }
        this.earlyDialogs[id].sendRequest(this, SIP.C.ACK,
                                          {
                                            body: SIP.Utils.generateFakeSDP(response.body)
                                          });
        this.earlyDialogs[id].sendRequest(this, SIP.C.BYE);

        /* NOTE: This fails because the forking proxy does not recognize that an unanswerable
         * leg (due to peerConnection limitations) has been answered first. If your forking
         * proxy does not hang up all unanswered branches on the first branch answered, remove this.
         */
        if(this.status !== C.STATUS_CONFIRMED) {
          this.failed(response, SIP.C.causes.WEBRTC_ERROR);
          this.terminated(response, SIP.C.causes.WEBRTC_ERROR);
        }
        return;
      } else if (this.status === C.STATUS_CONFIRMED) {
        this.sendRequest(SIP.C.ACK,{cseq: response.cseq});
        return;
      } else if (!this.hasAnswer) {
        // invite w/o sdp is waiting for callback
        //an invite with sdp must go on, and hasAnswer is true
        return;
      }
    }

    if (this.dialog && response.status_code < 200) {
      /*
        Early media has been set up with at least one other different branch,
        but a final 2xx response hasn't been received
      */
      if (this.dialog.pracked.indexOf(response.getHeader('rseq')) !== -1 ||
          (this.dialog.pracked[this.dialog.pracked.length-1] >= response.getHeader('rseq') && this.dialog.pracked.length > 0)) {
        return;
      }

      if (!this.earlyDialogs[id] && !this.createDialog(response, 'UAC', true)) {
        return;
      }

      if (this.earlyDialogs[id].pracked.indexOf(response.getHeader('rseq')) !== -1 ||
          (this.earlyDialogs[id].pracked[this.earlyDialogs[id].pracked.length-1] >= response.getHeader('rseq') && this.earlyDialogs[id].pracked.length > 0)) {
        return;
      }

      extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));
      this.earlyDialogs[id].pracked.push(response.getHeader('rseq'));

      this.earlyDialogs[id].sendRequest(this, SIP.C.PRACK, {
        extraHeaders: extraHeaders,
        body: SIP.Utils.generateFakeSDP(response.body)
      });
      return;
    }

    // Proceed to cancellation if the user requested.
    if(this.isCanceled) {
      if(response.status_code >= 100 && response.status_code < 200) {
        this.request.cancel(this.cancelReason);
        this.canceled(null);
      } else if(response.status_code >= 200 && response.status_code < 299) {
        this.acceptAndTerminate(response);
        this.emit('bye', this.request);
      } else if (response.status_code >= 300) {
        cause = SIP.C.REASON_PHRASE[response.status_code] || SIP.C.causes.CANCELED;
        this.rejected(response, cause);
        this.failed(response, cause);
        this.terminated(response, cause);
      }
      return;
    }

    switch(true) {
      case /^100$/.test(response.status_code):
        this.received_100 = true;
        this.emit('progress', response);
        break;
      case (/^1[0-9]{2}$/.test(response.status_code)):
        // Do nothing with 1xx responses without To tag.
        if(!response.to_tag) {
          this.logger.warn('1xx response received without to tag');
          break;
        }

        // Create Early Dialog if 1XX comes with contact
        if(response.hasHeader('contact')) {
          // An error on dialog creation will fire 'failed' event
          if (!this.createDialog(response, 'UAC', true)) {
            break;
          }
        }

        this.status = C.STATUS_1XX_RECEIVED;

        if(response.hasHeader('require') &&
           response.getHeader('require').indexOf('100rel') !== -1) {

          // Do nothing if this.dialog is already confirmed
          if (this.dialog || !this.earlyDialogs[id]) {
            break;
          }

          if (this.earlyDialogs[id].pracked.indexOf(response.getHeader('rseq')) !== -1 ||
              (this.earlyDialogs[id].pracked[this.earlyDialogs[id].pracked.length-1] >= response.getHeader('rseq') && this.earlyDialogs[id].pracked.length > 0)) {
            return;
          }

          if (!this.mediaHandler.hasDescription(response)) {
            extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));
            this.earlyDialogs[id].pracked.push(response.getHeader('rseq'));
            this.earlyDialogs[id].sendRequest(this, SIP.C.PRACK, {
              extraHeaders: extraHeaders
            });
            this.emit('progress', response);

          } else if (this.hasOffer) {
            if (!this.createDialog(response, 'UAC')) {
              break;
            }
            this.hasAnswer = true;
            this.dialog.pracked.push(response.getHeader('rseq'));

            this.mediaHandler.setDescription(response)
            .then(
              function onSuccess () {
                extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));

                session.sendRequest(SIP.C.PRACK, {
                  extraHeaders: extraHeaders,
                  receiveResponse: function() {}
                });
                session.status = C.STATUS_EARLY_MEDIA;
                session.mute();
                session.emit('progress', response);
                /*
                if (session.status === C.STATUS_EARLY_MEDIA) {
                  localMedia = session.mediaHandler.localMedia;
                  if (localMedia.getAudioTracks().length > 0) {
                    localMedia.getAudioTracks()[0].enabled = false;
                  }
                  if (localMedia.getVideoTracks().length > 0) {
                    localMedia.getVideoTracks()[0].enabled = false;
                  }
                }*/
              },
              function onFailure (e) {
                session.logger.warn(e);
                session.acceptAndTerminate(response, 488, 'Not Acceptable Here');
                session.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              }
            );
          } else {
            var earlyDialog = this.earlyDialogs[id];
            var earlyMedia = earlyDialog.mediaHandler;

            earlyDialog.pracked.push(response.getHeader('rseq'));

            earlyMedia.setDescription(response)
            .then(earlyMedia.getDescription.bind(earlyMedia, session.mediaHint))
            .then(function onSuccess(description) {
              if (description.extraHeaders) {
                extraHeaders = extraHeaders.concat(description.extraHeaders);
              }

              extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));
              earlyDialog.sendRequest(session, SIP.C.PRACK, {
                extraHeaders: extraHeaders,
                body: description.body
              });
              session.status = C.STATUS_EARLY_MEDIA;
              session.emit('progress', response);
            })
            .catch(function onFailure(e) {
              if (e instanceof SIP.Exceptions.GetDescriptionError) {
                earlyDialog.pracked.push(response.getHeader('rseq'));
                if (session.status === C.STATUS_TERMINATED) {
                  return;
                }
                // TODO - fail out on error
                // session.failed(gum error);
                session.failed(null, SIP.C.causes.WEBRTC_ERROR);
                session.terminated(null, SIP.C.causes.WEBRTC_ERROR);
              } else {
                earlyDialog.pracked.splice(earlyDialog.pracked.indexOf(response.getHeader('rseq')), 1);
                // Could not set remote description
                session.logger.warn('invalid description');
                session.logger.warn(e);
              }
            });
          }
        } else {
          this.emit('progress', response);
        }
        break;
      case /^2[0-9]{2}$/.test(response.status_code):
        var cseq = this.request.cseq + ' ' + this.request.method;
        if (cseq !== response.getHeader('cseq')) {
          break;
        }

        if (this.status === C.STATUS_EARLY_MEDIA && this.dialog) {
          this.status = C.STATUS_CONFIRMED;
          this.unmute();
          /*localMedia = this.mediaHandler.localMedia;
          if (localMedia.getAudioTracks().length > 0) {
            localMedia.getAudioTracks()[0].enabled = true;
          }
          if (localMedia.getVideoTracks().length > 0) {
            localMedia.getVideoTracks()[0].enabled = true;
          }*/
          options = {};
          if (this.renderbody) {
            extraHeaders.push('Content-Type: ' + this.rendertype);
            options.extraHeaders = extraHeaders;
            options.body = this.renderbody;
          }
          options.cseq = response.cseq;
          this.sendRequest(SIP.C.ACK, options);
          this.accepted(response);
          break;
        }
        // Do nothing if this.dialog is already confirmed
        if (this.dialog) {
          break;
        }

        // This is an invite without sdp
        if (!this.hasOffer) {
          if (this.earlyDialogs[id] && this.earlyDialogs[id].mediaHandler.localMedia) {
            //REVISIT
            this.hasOffer = true;
            this.hasAnswer = true;
            this.mediaHandler = this.earlyDialogs[id].mediaHandler;
            if (!this.createDialog(response, 'UAC')) {
              break;
            }
            this.status = C.STATUS_CONFIRMED;
            this.sendRequest(SIP.C.ACK, {cseq:response.cseq});

            this.unmute();
            /*
            localMedia = session.mediaHandler.localMedia;
            if (localMedia.getAudioTracks().length > 0) {
              localMedia.getAudioTracks()[0].enabled = true;
            }
            if (localMedia.getVideoTracks().length > 0) {
              localMedia.getVideoTracks()[0].enabled = true;
            }*/
            this.accepted(response);
          } else {
            if(!this.mediaHandler.hasDescription(response)) {
              this.acceptAndTerminate(response, 400, 'Missing session description');
              this.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              break;
            }
            if (!this.createDialog(response, 'UAC')) {
              break;
            }
            this.hasOffer = true;
            this.mediaHandler.setDescription(response)
            .then(this.mediaHandler.getDescription.bind(this.mediaHandler, this.mediaHint))
            .then(function onSuccess(description) {
              //var localMedia;
              if(session.isCanceled || session.status === C.STATUS_TERMINATED) {
                return;
              }

              session.status = C.STATUS_CONFIRMED;
              session.hasAnswer = true;

              session.unmute();
              /*localMedia = session.mediaHandler.localMedia;
              if (localMedia.getAudioTracks().length > 0) {
                localMedia.getAudioTracks()[0].enabled = true;
              }
              if (localMedia.getVideoTracks().length > 0) {
                localMedia.getVideoTracks()[0].enabled = true;
              }*/
              session.sendRequest(SIP.C.ACK,{
                body: description.body,
                extraHeaders: description.extraHeaders,
                cseq:response.cseq
              });
              session.accepted(response);
            })
            .catch(function onFailure(e) {
              if (e instanceof SIP.Exceptions.GetDescriptionError) {
                // TODO do something here
                session.logger.warn("there was a problem");
              } else {
                session.logger.warn('invalid description');
                session.logger.warn(e);
                response.reply(488);
              }
            });
          }
        } else if (this.hasAnswer){
          if (this.renderbody) {
            extraHeaders.push('Content-Type: ' + session.rendertype);
            options.extraHeaders = extraHeaders;
            options.body = this.renderbody;
          }
          this.sendRequest(SIP.C.ACK, options);
        } else {
          if(!this.mediaHandler.hasDescription(response)) {
            this.acceptAndTerminate(response, 400, 'Missing session description');
            this.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            break;
          }
          if (!this.createDialog(response, 'UAC')) {
            break;
          }
          this.hasAnswer = true;
          this.mediaHandler.setDescription(response)
          .then(
            function onSuccess () {
              var options = {};//,localMedia;
              session.status = C.STATUS_CONFIRMED;
              session.unmute();
              /*localMedia = session.mediaHandler.localMedia;
              if (localMedia.getAudioTracks().length > 0) {
                localMedia.getAudioTracks()[0].enabled = true;
              }
              if (localMedia.getVideoTracks().length > 0) {
                localMedia.getVideoTracks()[0].enabled = true;
              }*/
              if (session.renderbody) {
                extraHeaders.push('Content-Type: ' + session.rendertype);
                options.extraHeaders = extraHeaders;
                options.body = session.renderbody;
              }
              options.cseq = response.cseq;
              session.sendRequest(SIP.C.ACK, options);
              session.accepted(response);
            },
            function onFailure (e) {
              session.logger.warn(e);
              session.acceptAndTerminate(response, 488, 'Not Acceptable Here');
              session.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            }
          );
        }
        break;
      default:
        cause = SIP.Utils.sipErrorCause(response.status_code);
        this.rejected(response, cause);
        this.failed(response, cause);
        this.terminated(response, cause);
    }
  },

  cancel: function(options) {
    options = options || {};

    // Check Session Status
    if (this.status === C.STATUS_TERMINATED || this.status === C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.logger.log('canceling RTCSession');

    var cancel_reason = SIP.Utils.getCancelReason(options.status_code, options.reason_phrase);

    // Check Session Status
    if (this.status === C.STATUS_NULL ||
        (this.status === C.STATUS_INVITE_SENT && !this.received_100)) {
      this.isCanceled = true;
      this.cancelReason = cancel_reason;
    } else if (this.status === C.STATUS_INVITE_SENT ||
               this.status === C.STATUS_1XX_RECEIVED ||
               this.status === C.STATUS_EARLY_MEDIA) {
      this.request.cancel(cancel_reason);
    }

    return this.canceled();
  },

  terminate: function(options) {
    if (this.status === C.STATUS_TERMINATED) {
      return this;
    }

    if (this.status === C.STATUS_WAITING_FOR_ACK || this.status === C.STATUS_CONFIRMED) {
      this.bye(options);
    } else {
      this.cancel(options);
    }

    return this;
  },

  receiveRequest: function(request) {
    // ICC RECEIVE REQUEST

    // Reject CANCELs
    if (request.method === SIP.C.CANCEL) {
      // TODO; make this a switch when it gets added
    }

    if (request.method === SIP.C.ACK && this.status === C.STATUS_WAITING_FOR_ACK) {
      SIP.Timers.clearTimeout(this.timers.ackTimer);
      SIP.Timers.clearTimeout(this.timers.invite2xxTimer);
      this.status = C.STATUS_CONFIRMED;
      this.unmute();

      this.accepted();
    }

    return Session.prototype.receiveRequest.apply(this, [request]);
  },

  onTransportError: function() {
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onRequestTimeout: function() {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.REQUEST_TIMEOUT);
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    }
  }

};

SIP.InviteClientContext = InviteClientContext;

};

},{"./RFC4028":68,"./Session/DTMF":76}],76:[function(require,module,exports){
"use strict";
/**
 * @fileoverview DTMF
 */

/**
 * @class DTMF
 * @param {SIP.Session} session
 */
module.exports = function (SIP) {

var DTMF,
  C = {
    MIN_DURATION:            70,
    MAX_DURATION:            6000,
    DEFAULT_DURATION:        100,
    MIN_INTER_TONE_GAP:      50,
    DEFAULT_INTER_TONE_GAP:  500
  };

DTMF = function(session, tone, options) {
  var duration, interToneGap;

  if (tone === undefined) {
    throw new TypeError('Not enough arguments');
  }

  this.logger = session.ua.getLogger('sip.invitecontext.dtmf', session.id);
  this.owner = session;
  this.direction = null;

  options = options || {};
  duration = options.duration || null;
  interToneGap = options.interToneGap || null;

  // Check tone type
  if (typeof tone === 'string' ) {
    tone = tone.toUpperCase();
  } else if (typeof tone === 'number') {
    tone = tone.toString();
  } else {
    throw new TypeError('Invalid tone: '+ tone);
  }

  // Check tone value
  if (!tone.match(/^[0-9A-D#*]$/)) {
    throw new TypeError('Invalid tone: '+ tone);
  } else {
    this.tone = tone;
  }

  // Check duration
  if (duration && !SIP.Utils.isDecimal(duration)) {
    throw new TypeError('Invalid tone duration: '+ duration);
  } else if (!duration) {
    duration = DTMF.C.DEFAULT_DURATION;
  } else if (duration < DTMF.C.MIN_DURATION) {
    this.logger.warn('"duration" value is lower than the minimum allowed, setting it to '+ DTMF.C.MIN_DURATION+ ' milliseconds');
    duration = DTMF.C.MIN_DURATION;
  } else if (duration > DTMF.C.MAX_DURATION) {
    this.logger.warn('"duration" value is greater than the maximum allowed, setting it to '+ DTMF.C.MAX_DURATION +' milliseconds');
    duration = DTMF.C.MAX_DURATION;
  } else {
    duration = Math.abs(duration);
  }
  this.duration = duration;

  // Check interToneGap
  if (interToneGap && !SIP.Utils.isDecimal(interToneGap)) {
    throw new TypeError('Invalid interToneGap: '+ interToneGap);
  } else if (!interToneGap) {
    interToneGap = DTMF.C.DEFAULT_INTER_TONE_GAP;
  } else if (interToneGap < DTMF.C.MIN_INTER_TONE_GAP) {
    this.logger.warn('"interToneGap" value is lower than the minimum allowed, setting it to '+ DTMF.C.MIN_INTER_TONE_GAP +' milliseconds');
    interToneGap = DTMF.C.MIN_INTER_TONE_GAP;
  } else {
    interToneGap = Math.abs(interToneGap);
  }
  this.interToneGap = interToneGap;
};
DTMF.prototype = Object.create(SIP.EventEmitter.prototype);


DTMF.prototype.send = function(options) {
  var extraHeaders, body;

  this.direction = 'outgoing';

  // Check RTCSession Status
  if (this.owner.status !== SIP.Session.C.STATUS_CONFIRMED &&
    this.owner.status !== SIP.Session.C.STATUS_WAITING_FOR_ACK) {
    throw new SIP.Exceptions.InvalidStateError(this.owner.status);
  }

  // Get DTMF options
  options = options || {};
  extraHeaders = options.extraHeaders ? options.extraHeaders.slice() : [];

  extraHeaders.push('Content-Type: application/dtmf-relay');

  body = "Signal= " + this.tone + "\r\n";
  body += "Duration= " + this.duration;

  this.request = this.owner.dialog.sendRequest(this, SIP.C.INFO, {
    extraHeaders: extraHeaders,
    body: body
  });

  this.owner.emit('dtmf', this.request, this);
};

/**
 * @private
 */
DTMF.prototype.receiveResponse = function(response) {
  var cause;

  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      // Ignore provisional responses.
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      this.emit('succeeded', {
        originator: 'remote',
        response: response
      });
      break;

    default:
      cause = SIP.Utils.sipErrorCause(response.status_code);
      this.emit('failed', response, cause);
      break;
  }
};

/**
 * @private
 */
DTMF.prototype.onRequestTimeout = function() {
  this.emit('failed', null, SIP.C.causes.REQUEST_TIMEOUT);
  this.owner.onRequestTimeout();
};

/**
 * @private
 */
DTMF.prototype.onTransportError = function() {
  this.emit('failed', null, SIP.C.causes.CONNECTION_ERROR);
  this.owner.onTransportError();
};

/**
 * @private
 */
DTMF.prototype.onDialogError = function(response) {
  this.emit('failed', response, SIP.C.causes.DIALOG_ERROR);
  this.owner.onDialogError(response);
};

/**
 * @private
 */
DTMF.prototype.init_incoming = function(request) {
  this.direction = 'incoming';
  this.request = request;

  request.reply(200);

  if (!this.tone || !this.duration) {
    this.logger.warn('invalid INFO DTMF received, discarded');
  } else {
    this.owner.emit('dtmf', request, this);
  }
};

DTMF.C = C;
return DTMF;
};

},{}],77:[function(require,module,exports){
"use strict";

/**
 * @fileoverview SIP Subscriber (SIP-Specific Event Notifications RFC6665)
 */

/**
 * @augments SIP
 * @class Class creating a SIP Subscription.
 */
module.exports = function (SIP) {
SIP.Subscription = function (ua, target, event, options) {
  options = Object.create(options || Object.prototype);
  this.extraHeaders = options.extraHeaders = (options.extraHeaders || []).slice();

  this.id = null;
  this.state = 'init';

  if (!event) {
    throw new TypeError('Event necessary to create a subscription.');
  } else {
    //TODO: check for valid events here probably make a list in SIP.C; or leave it up to app to check?
    //The check may need to/should probably occur on the other side,
    this.event = event;
  }

  if(typeof options.expires !== 'number'){
    ua.logger.warn('expires must be a number. Using default of 3600.');
    this.expires = 3600;
  } else {
    this.expires = options.expires;
  }

  options.extraHeaders.push('Event: ' + this.event);
  options.extraHeaders.push('Expires: ' + this.expires);

  if (options.body) {
    this.body = options.body;
  }

  this.contact = ua.contact.toString();

  options.extraHeaders.push('Contact: '+ this.contact);
  options.extraHeaders.push('Allow: '+ SIP.Utils.getAllowedMethods(ua));

  SIP.Utils.augment(this, SIP.ClientContext, [ua, SIP.C.SUBSCRIBE, target, options]);

  this.logger = ua.getLogger('sip.subscription');

  this.dialog = null;
  this.timers = {N: null, sub_duration: null};
  this.errorCodes  = [404,405,410,416,480,481,482,483,484,485,489,501,604];
};

SIP.Subscription.prototype = {
  subscribe: function() {
    var sub = this;

    SIP.Timers.clearTimeout(this.timers.sub_duration);
    SIP.Timers.clearTimeout(this.timers.N);
    this.timers.N = SIP.Timers.setTimeout(sub.timer_fire.bind(sub), SIP.Timers.TIMER_N);

    this.send();

    this.state = 'notify_wait';

    return this;
  },

  refresh: function () {
    if (this.state === 'terminated' || this.state === 'pending' || this.state === 'notify_wait') {
      return;
    }

    this.dialog.sendRequest(this, SIP.C.SUBSCRIBE, {
      extraHeaders: this.extraHeaders,
      body: this.body
    });
  },

  receiveResponse: function(response) {
    var expires, sub = this,
        cause = SIP.Utils.getReasonPhrase(response.status_code);

    if (this.errorCodes.indexOf(response.status_code) !== -1) {
      this.failed(response, null);
    } else if (/^2[0-9]{2}$/.test(response.status_code)){
      expires = response.getHeader('Expires');
      SIP.Timers.clearTimeout(this.timers.N);

      if (this.createConfirmedDialog(response,'UAC')) {
        this.id = this.dialog.id.toString();
        this.ua.subscriptions[this.id] = this;
        this.emit('accepted', response, cause);
        // UPDATE ROUTE SET TO BE BACKWARDS COMPATIBLE?
      }

      if (expires && expires <= this.expires) {
        this.timers.sub_duration = SIP.Timers.setTimeout(sub.refresh.bind(sub), expires * 900);
      } else {
        if (!expires) {
          this.logger.warn('Expires header missing in a 200-class response to SUBSCRIBE');
          this.failed(response, SIP.C.EXPIRES_HEADER_MISSING);
        } else {
          this.logger.warn('Expires header in a 200-class response to SUBSCRIBE with a higher value than the one in the request');
          this.failed(response, SIP.C.INVALID_EXPIRES_HEADER);
        }
      }
    } //Used to just ignore provisional responses; now ignores everything except errorCodes and 2xx
  },

  unsubscribe: function() {
    var extraHeaders = [], sub = this;

    this.state = 'terminated';

    extraHeaders.push('Event: ' + this.event);
    extraHeaders.push('Expires: 0');

    extraHeaders.push('Contact: '+ this.contact);
    extraHeaders.push('Allow: '+ SIP.Utils.getAllowedMethods(this.ua));

    this.request = new SIP.OutgoingRequest(this.method, this.request.to.uri.toString(), this.ua, null, extraHeaders);

    //MAYBE, may want to see state
    this.receiveResponse = function(){};

    SIP.Timers.clearTimeout(this.timers.sub_duration);
    SIP.Timers.clearTimeout(this.timers.N);
    this.timers.N = SIP.Timers.setTimeout(sub.timer_fire.bind(sub), SIP.Timers.TIMER_N);

    this.send();
  },

  /**
  * @private
  */
  timer_fire: function(){
    if (this.state === 'terminated') {
      this.close();
    } else if (this.state === 'pending' || this.state === 'notify_wait') {
      this.state = 'terminated';
      this.close();
    } else {
      this.refresh();
    }
  },

  /**
  * @private
  */
  close: function() {
    if(this.state !== 'terminated') {
      this.unsubscribe();
    }

    this.terminateDialog();
    SIP.Timers.clearTimeout(this.timers.N);
    SIP.Timers.clearTimeout(this.timers.sub_duration);

    delete this.ua.subscriptions[this.id];
  },

  /**
  * @private
  */
  createConfirmedDialog: function(message, type) {
    var dialog;

    this.terminateDialog();
    dialog = new SIP.Dialog(this, message, type);

    if(!dialog.error) {
      this.dialog = dialog;
      return true;
    }
    // Dialog not created due to an error
    else {
      return false;
    }
  },

  /**
  * @private
  */
  terminateDialog: function() {
    if(this.dialog) {
      delete this.ua.subscriptions[this.id];
      this.dialog.terminate();
      delete this.dialog;
    }
  },

  /**
  * @private
  */
  receiveRequest: function(request) {
    var sub_state, sub = this;

    function setExpiresTimeout() {
      if (sub_state.expires) {
        sub_state.expires = Math.min(sub.expires,
                                     Math.max(sub_state.expires, 0));
        sub.timers.sub_duration = SIP.Timers.setTimeout(sub.refresh.bind(sub),
                                                    sub_state.expires * 900);
      }
    }

    if (!this.matchEvent(request)) { //checks event and subscription_state headers
      request.reply(489);
      return;
    }

    sub_state = request.parseHeader('Subscription-State');

    request.reply(200, SIP.C.REASON_200);

    SIP.Timers.clearTimeout(this.timers.N);
    SIP.Timers.clearTimeout(this.timers.sub_duration);

    this.emit('notify', {request: request});

    switch (sub_state.state) {
      case 'active':
        this.state = 'active';
        setExpiresTimeout();
        break;
      case 'pending':
        if (this.state === 'notify_wait') {
          setExpiresTimeout();
        }
        this.state = 'pending';
        break;
      case 'terminated':
        if (sub_state.reason) {
          this.logger.log('terminating subscription with reason '+ sub_state.reason);
          switch (sub_state.reason) {
            case 'deactivated':
            case 'timeout':
              this.subscribe();
              return;
            case 'probation':
            case 'giveup':
              if(sub_state.params && sub_state.params['retry-after']) {
                this.timers.sub_duration = SIP.Timers.setTimeout(sub.subscribe.bind(sub), sub_state.params['retry-after']);
              } else {
                this.subscribe();
              }
              return;
            case 'rejected':
            case 'noresource':
            case 'invariant':
              break;
          }
        }
        this.close();
        break;
    }
  },

  failed: function(response, cause) {
    this.close();
    this.emit('failed', response, cause);
    return this;
  },

  /**
  * @private
  */
  matchEvent: function(request) {
    var event;

    // Check mandatory header Event
    if (!request.hasHeader('Event')) {
      this.logger.warn('missing Event header');
      return false;
    }
    // Check mandatory header Subscription-State
    if (!request.hasHeader('Subscription-State')) {
      this.logger.warn('missing Subscription-State header');
      return false;
    }

    // Check whether the event in NOTIFY matches the event in SUBSCRIBE
    event = request.parseHeader('event').event;

    if (this.event !== event) {
      this.logger.warn('event match failed');
      request.reply(481, 'Event Match Failed');
      return false;
    } else {
      return true;
    }
  }
};
};

},{}],78:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP TIMERS
 */

/**
 * @augments SIP
 */
var
  T1 = 500,
  T2 = 4000,
  T4 = 5000;
module.exports = function (timers) {
  var Timers = {
    T1: T1,
    T2: T2,
    T4: T4,
    TIMER_B: 64 * T1,
    TIMER_D: 0  * T1,
    TIMER_F: 64 * T1,
    TIMER_H: 64 * T1,
    TIMER_I: 0  * T1,
    TIMER_J: 0  * T1,
    TIMER_K: 0  * T4,
    TIMER_L: 64 * T1,
    TIMER_M: 64 * T1,
    TIMER_N: 64 * T1,
    PROVISIONAL_RESPONSE_INTERVAL: 60000  // See RFC 3261 Section 13.3.1.1
  };

  ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
  .forEach(function (name) {
    // can't just use timers[name].bind(timers) since it bypasses jasmine's
    // clock-mocking
    Timers[name] = function () {
      return timers[name].apply(timers, arguments);
    };
  });

  return Timers;
};

},{}],79:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Transactions
 */

/**
 * SIP Transactions module.
 * @augments SIP
 */
module.exports = function (SIP) {
var
  C = {
    // Transaction states
    STATUS_TRYING:     1,
    STATUS_PROCEEDING: 2,
    STATUS_CALLING:    3,
    STATUS_ACCEPTED:   4,
    STATUS_COMPLETED:  5,
    STATUS_TERMINATED: 6,
    STATUS_CONFIRMED:  7,

    // Transaction types
    NON_INVITE_CLIENT: 'nict',
    NON_INVITE_SERVER: 'nist',
    INVITE_CLIENT: 'ict',
    INVITE_SERVER: 'ist'
  };

function buildViaHeader (request_sender, transport, id) {
  var via;
  via = 'SIP/2.0/' + (request_sender.ua.configuration.hackViaTcp ? 'TCP' : transport.server.scheme);
  via += ' ' + request_sender.ua.configuration.viaHost + ';branch=' + id;
  if (request_sender.ua.configuration.forceRport) {
    via += ';rport';
  }
  return via;
}

/**
* @augments SIP.Transactions
* @class Non Invite Client Transaction
* @param {SIP.RequestSender} request_sender
* @param {SIP.OutgoingRequest} request
* @param {SIP.Transport} transport
*/
var NonInviteClientTransaction = function(request_sender, request, transport) {
  var via;

  this.type = C.NON_INVITE_CLIENT;
  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  this.logger = request_sender.ua.getLogger('sip.transaction.nict', this.id);

  via = buildViaHeader(request_sender, transport, this.id);
  this.request.setHeader('via', via);

  this.request_sender.ua.newTransaction(this);
};
NonInviteClientTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

NonInviteClientTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

NonInviteClientTransaction.prototype.send = function() {
  var tr = this;

  this.stateChanged(C.STATUS_TRYING);
  this.F = SIP.Timers.setTimeout(tr.timer_F.bind(tr), SIP.Timers.TIMER_F);

  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

NonInviteClientTransaction.prototype.onTransportError = function() {
  this.logger.log('transport error occurred, deleting non-INVITE client transaction ' + this.id);
  SIP.Timers.clearTimeout(this.F);
  SIP.Timers.clearTimeout(this.K);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
  this.request_sender.onTransportError();
};

NonInviteClientTransaction.prototype.timer_F = function() {
  this.logger.log('Timer F expired for non-INVITE client transaction ' + this.id);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
  this.request_sender.onRequestTimeout();
};

NonInviteClientTransaction.prototype.timer_K = function() {
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

NonInviteClientTransaction.prototype.receiveResponse = function(response) {
  var
    tr = this,
    status_code = response.status_code;

  if(status_code < 200) {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_PROCEEDING);
        this.request_sender.receiveResponse(response);
        break;
    }
  } else {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        SIP.Timers.clearTimeout(this.F);

        if(status_code === 408) {
          this.request_sender.onRequestTimeout();
        } else {
          this.request_sender.receiveResponse(response);
        }

        this.K = SIP.Timers.setTimeout(tr.timer_K.bind(tr), SIP.Timers.TIMER_K);
        break;
      case C.STATUS_COMPLETED:
        break;
    }
  }
};



/**
* @augments SIP.Transactions
* @class Invite Client Transaction
* @param {SIP.RequestSender} request_sender
* @param {SIP.OutgoingRequest} request
* @param {SIP.Transport} transport
*/
var InviteClientTransaction = function(request_sender, request, transport) {
  var via,
    tr = this;

  this.type = C.INVITE_CLIENT;
  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  this.logger = request_sender.ua.getLogger('sip.transaction.ict', this.id);

  via = buildViaHeader(request_sender, transport, this.id);
  this.request.setHeader('via', via);

  this.request_sender.ua.newTransaction(this);

  // Add the cancel property to the request.
  //Will be called from the request instance, not the transaction itself.
  this.request.cancel = function(reason) {
    tr.cancel_request(tr, reason);
  };
};
InviteClientTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

InviteClientTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

InviteClientTransaction.prototype.send = function() {
  var tr = this;
  this.stateChanged(C.STATUS_CALLING);
  this.B = SIP.Timers.setTimeout(tr.timer_B.bind(tr), SIP.Timers.TIMER_B);

  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

InviteClientTransaction.prototype.onTransportError = function() {
  this.logger.log('transport error occurred, deleting INVITE client transaction ' + this.id);
  SIP.Timers.clearTimeout(this.B);
  SIP.Timers.clearTimeout(this.D);
  SIP.Timers.clearTimeout(this.M);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);

  if (this.state !== C.STATUS_ACCEPTED) {
    this.request_sender.onTransportError();
  }
};

// RFC 6026 7.2
InviteClientTransaction.prototype.timer_M = function() {
  this.logger.log('Timer M expired for INVITE client transaction ' + this.id);

  if(this.state === C.STATUS_ACCEPTED) {
    SIP.Timers.clearTimeout(this.B);
    this.stateChanged(C.STATUS_TERMINATED);
    this.request_sender.ua.destroyTransaction(this);
  }
};

// RFC 3261 17.1.1
InviteClientTransaction.prototype.timer_B = function() {
  this.logger.log('Timer B expired for INVITE client transaction ' + this.id);
  if(this.state === C.STATUS_CALLING) {
    this.stateChanged(C.STATUS_TERMINATED);
    this.request_sender.ua.destroyTransaction(this);
    this.request_sender.onRequestTimeout();
  }
};

InviteClientTransaction.prototype.timer_D = function() {
  this.logger.log('Timer D expired for INVITE client transaction ' + this.id);
  SIP.Timers.clearTimeout(this.B);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

InviteClientTransaction.prototype.sendACK = function(response) {
  var tr = this;

  this.ack = 'ACK ' + this.request.ruri + ' SIP/2.0\r\n';
  this.ack += 'Via: ' + this.request.headers['Via'].toString() + '\r\n';

  if(this.request.headers['Route']) {
    this.ack += 'Route: ' + this.request.headers['Route'].toString() + '\r\n';
  }

  this.ack += 'To: ' + response.getHeader('to') + '\r\n';
  this.ack += 'From: ' + this.request.headers['From'].toString() + '\r\n';
  this.ack += 'Call-ID: ' + this.request.headers['Call-ID'].toString() + '\r\n';
  this.ack += 'Content-Length: 0\r\n';
  this.ack += 'CSeq: ' + this.request.headers['CSeq'].toString().split(' ')[0];
  this.ack += ' ACK\r\n\r\n';

  this.D = SIP.Timers.setTimeout(tr.timer_D.bind(tr), SIP.Timers.TIMER_D);

  this.transport.send(this.ack);
};

InviteClientTransaction.prototype.cancel_request = function(tr, reason) {
  var request = tr.request;

  this.cancel = SIP.C.CANCEL + ' ' + request.ruri + ' SIP/2.0\r\n';
  this.cancel += 'Via: ' + request.headers['Via'].toString() + '\r\n';

  if(this.request.headers['Route']) {
    this.cancel += 'Route: ' + request.headers['Route'].toString() + '\r\n';
  }

  this.cancel += 'To: ' + request.headers['To'].toString() + '\r\n';
  this.cancel += 'From: ' + request.headers['From'].toString() + '\r\n';
  this.cancel += 'Call-ID: ' + request.headers['Call-ID'].toString() + '\r\n';
  this.cancel += 'CSeq: ' + request.headers['CSeq'].toString().split(' ')[0] +
  ' CANCEL\r\n';

  if(reason) {
    this.cancel += 'Reason: ' + reason + '\r\n';
  }

  this.cancel += 'Content-Length: 0\r\n\r\n';

  // Send only if a provisional response (>100) has been received.
  if(this.state === C.STATUS_PROCEEDING) {
    this.transport.send(this.cancel);
  }
};

InviteClientTransaction.prototype.receiveResponse = function(response) {
  var
  tr = this,
  status_code = response.status_code;

  if(status_code >= 100 && status_code <= 199) {
    switch(this.state) {
      case C.STATUS_CALLING:
        this.stateChanged(C.STATUS_PROCEEDING);
        this.request_sender.receiveResponse(response);
        if(this.cancel) {
          this.transport.send(this.cancel);
        }
        break;
      case C.STATUS_PROCEEDING:
        this.request_sender.receiveResponse(response);
        break;
    }
  } else if(status_code >= 200 && status_code <= 299) {
    switch(this.state) {
      case C.STATUS_CALLING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_ACCEPTED);
        this.M = SIP.Timers.setTimeout(tr.timer_M.bind(tr), SIP.Timers.TIMER_M);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_ACCEPTED:
        this.request_sender.receiveResponse(response);
        break;
    }
  } else if(status_code >= 300 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_CALLING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        this.sendACK(response);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_COMPLETED:
        this.sendACK(response);
        break;
    }
  }
};


/**
 * @augments SIP.Transactions
 * @class ACK Client Transaction
 * @param {SIP.RequestSender} request_sender
 * @param {SIP.OutgoingRequest} request
 * @param {SIP.Transport} transport
 */
var AckClientTransaction = function(request_sender, request, transport) {
  var via;

  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  this.logger = request_sender.ua.getLogger('sip.transaction.nict', this.id);

  via = buildViaHeader(request_sender, transport, this.id);
  this.request.setHeader('via', via);
};
AckClientTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

AckClientTransaction.prototype.send = function() {
  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

AckClientTransaction.prototype.onTransportError = function() {
  this.logger.log('transport error occurred, for an ACK client transaction ' + this.id);
  this.request_sender.onTransportError();
};


/**
* @augments SIP.Transactions
* @class Non Invite Server Transaction
* @param {SIP.IncomingRequest} request
* @param {SIP.UA} ua
*/
var NonInviteServerTransaction = function(request, ua) {
  this.type = C.NON_INVITE_SERVER;
  this.id = request.via_branch;
  this.request = request;
  this.transport = request.transport;
  this.ua = ua;
  this.last_response = '';
  request.server_transaction = this;

  this.logger = ua.getLogger('sip.transaction.nist', this.id);

  this.state = C.STATUS_TRYING;

  ua.newTransaction(this);
};
NonInviteServerTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

NonInviteServerTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

NonInviteServerTransaction.prototype.timer_J = function() {
  this.logger.log('Timer J expired for non-INVITE server transaction ' + this.id);
  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

NonInviteServerTransaction.prototype.onTransportError = function() {
  if (!this.transportError) {
    this.transportError = true;

    this.logger.log('transport error occurred, deleting non-INVITE server transaction ' + this.id);

    SIP.Timers.clearTimeout(this.J);
    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

NonInviteServerTransaction.prototype.receiveResponse = function(status_code, response) {
  var tr = this;
  var deferred = SIP.Utils.defer();

  if(status_code === 100) {
    /* RFC 4320 4.1
     * 'A SIP element MUST NOT
     * send any provisional response with a
     * Status-Code other than 100 to a non-INVITE request.'
     */
    switch(this.state) {
      case C.STATUS_TRYING:
        this.stateChanged(C.STATUS_PROCEEDING);
        if(!this.transport.send(response))  {
          this.onTransportError();
        }
        break;
      case C.STATUS_PROCEEDING:
        this.last_response = response;
        if(!this.transport.send(response)) {
          this.onTransportError();
          deferred.reject();
        } else {
          deferred.resolve();
        }
        break;
    }
  } else if(status_code >= 200 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        this.last_response = response;
        this.J = SIP.Timers.setTimeout(tr.timer_J.bind(tr), SIP.Timers.TIMER_J);
        if(!this.transport.send(response)) {
          this.onTransportError();
          deferred.reject();
        } else {
          deferred.resolve();
        }
        break;
      case C.STATUS_COMPLETED:
        break;
    }
  }

  return deferred.promise;
};

/**
* @augments SIP.Transactions
* @class Invite Server Transaction
* @param {SIP.IncomingRequest} request
* @param {SIP.UA} ua
*/
var InviteServerTransaction = function(request, ua) {
  this.type = C.INVITE_SERVER;
  this.id = request.via_branch;
  this.request = request;
  this.transport = request.transport;
  this.ua = ua;
  this.last_response = '';
  request.server_transaction = this;

  this.logger = ua.getLogger('sip.transaction.ist', this.id);

  this.state = C.STATUS_PROCEEDING;

  ua.newTransaction(this);

  this.resendProvisionalTimer = null;

  request.reply(100);
};
InviteServerTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

InviteServerTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

InviteServerTransaction.prototype.timer_H = function() {
  this.logger.log('Timer H expired for INVITE server transaction ' + this.id);

  if(this.state === C.STATUS_COMPLETED) {
    this.logger.warn('transactions', 'ACK for INVITE server transaction was never received, call will be terminated');
  }

  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

InviteServerTransaction.prototype.timer_I = function() {
  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

// RFC 6026 7.1
InviteServerTransaction.prototype.timer_L = function() {
  this.logger.log('Timer L expired for INVITE server transaction ' + this.id);

  if(this.state === C.STATUS_ACCEPTED) {
    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

InviteServerTransaction.prototype.onTransportError = function() {
  if (!this.transportError) {
    this.transportError = true;

    this.logger.log('transport error occurred, deleting INVITE server transaction ' + this.id);

    if (this.resendProvisionalTimer !== null) {
      SIP.Timers.clearInterval(this.resendProvisionalTimer);
      this.resendProvisionalTimer = null;
    }

    SIP.Timers.clearTimeout(this.L);
    SIP.Timers.clearTimeout(this.H);
    SIP.Timers.clearTimeout(this.I);

    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

InviteServerTransaction.prototype.resend_provisional = function() {
  if(!this.transport.send(this.last_response)) {
    this.onTransportError();
  }
};

// INVITE Server Transaction RFC 3261 17.2.1
InviteServerTransaction.prototype.receiveResponse = function(status_code, response) {
  var tr = this;
  var deferred = SIP.Utils.defer();

  if(status_code >= 100 && status_code <= 199) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        if(!this.transport.send(response)) {
          this.onTransportError();
        }
        this.last_response = response;
        break;
    }
  }

  if(status_code > 100 && status_code <= 199 && this.state === C.STATUS_PROCEEDING) {
    // Trigger the resendProvisionalTimer only for the first non 100 provisional response.
    if(this.resendProvisionalTimer === null) {
      this.resendProvisionalTimer = SIP.Timers.setInterval(tr.resend_provisional.bind(tr),
        SIP.Timers.PROVISIONAL_RESPONSE_INTERVAL);
    }
  } else if(status_code >= 200 && status_code <= 299) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_ACCEPTED);
        this.last_response = response;
        this.L = SIP.Timers.setTimeout(tr.timer_L.bind(tr), SIP.Timers.TIMER_L);

        if (this.resendProvisionalTimer !== null) {
          SIP.Timers.clearInterval(this.resendProvisionalTimer);
          this.resendProvisionalTimer = null;
        }
        /* falls through */
        case C.STATUS_ACCEPTED:
          // Note that this point will be reached for proceeding tr.state also.
          if(!this.transport.send(response)) {
            this.onTransportError();
            deferred.reject();
          } else {
            deferred.resolve();
          }
          break;
    }
  } else if(status_code >= 300 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        if (this.resendProvisionalTimer !== null) {
          SIP.Timers.clearInterval(this.resendProvisionalTimer);
          this.resendProvisionalTimer = null;
        }

        if(!this.transport.send(response)) {
          this.onTransportError();
          deferred.reject();
        } else {
          this.stateChanged(C.STATUS_COMPLETED);
          this.H = SIP.Timers.setTimeout(tr.timer_H.bind(tr), SIP.Timers.TIMER_H);
          deferred.resolve();
        }
        break;
    }
  }

  return deferred.promise;
};

/**
 * @function
 * @param {SIP.UA} ua
 * @param {SIP.IncomingRequest} request
 *
 * @return {boolean}
 * INVITE:
 *  _true_ if retransmission
 *  _false_ new request
 *
 * ACK:
 *  _true_  ACK to non2xx response
 *  _false_ ACK must be passed to TU (accepted state)
 *          ACK to 2xx response
 *
 * CANCEL:
 *  _true_  no matching invite transaction
 *  _false_ matching invite transaction and no final response sent
 *
 * OTHER:
 *  _true_  retransmission
 *  _false_ new request
 */
var checkTransaction = function(ua, request) {
  var tr;

  switch(request.method) {
    case SIP.C.INVITE:
      tr = ua.transactions.ist[request.via_branch];
      if(tr) {
        switch(tr.state) {
          case C.STATUS_PROCEEDING:
            tr.transport.send(tr.last_response);
            break;

            // RFC 6026 7.1 Invite retransmission
            //received while in C.STATUS_ACCEPTED state. Absorb it.
          case C.STATUS_ACCEPTED:
            break;
        }
        return true;
      }
      break;
    case SIP.C.ACK:
      tr = ua.transactions.ist[request.via_branch];

      // RFC 6026 7.1
      if(tr) {
        if(tr.state === C.STATUS_ACCEPTED) {
          return false;
        } else if(tr.state === C.STATUS_COMPLETED) {
          tr.state = C.STATUS_CONFIRMED;
          tr.I = SIP.Timers.setTimeout(tr.timer_I.bind(tr), SIP.Timers.TIMER_I);
          return true;
        }
      }

      // ACK to 2XX Response.
      else {
        return false;
      }
      break;
    case SIP.C.CANCEL:
      tr = ua.transactions.ist[request.via_branch];
      if(tr) {
        request.reply_sl(200);
        if(tr.state === C.STATUS_PROCEEDING) {
          return false;
        } else {
          return true;
        }
      } else {
        request.reply_sl(481);
        return true;
      }
      break;
    default:

      // Non-INVITE Server Transaction RFC 3261 17.2.2
      tr = ua.transactions.nist[request.via_branch];
      if(tr) {
        switch(tr.state) {
          case C.STATUS_TRYING:
            break;
          case C.STATUS_PROCEEDING:
          case C.STATUS_COMPLETED:
            tr.transport.send(tr.last_response);
            break;
        }
        return true;
      }
      break;
  }
};

SIP.Transactions = {
  C: C,
  checkTransaction: checkTransaction,
  NonInviteClientTransaction: NonInviteClientTransaction,
  InviteClientTransaction: InviteClientTransaction,
  AckClientTransaction: AckClientTransaction,
  NonInviteServerTransaction: NonInviteServerTransaction,
  InviteServerTransaction: InviteServerTransaction
};

};

},{}],80:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Transport
 */

/**
 * @augments SIP
 * @class Transport
 * @param {SIP.UA} ua
 * @param {Object} server ws_server Object
 */
module.exports = function (SIP, WebSocket) {
var Transport,
  C = {
    // Transport status codes
    STATUS_READY:        0,
    STATUS_DISCONNECTED: 1,
    STATUS_ERROR:        2
  };

Transport = function(ua, server) {

  this.logger = ua.getLogger('sip.transport');
  this.ua = ua;
  this.ws = null;
  this.server = server;
  this.reconnection_attempts = 0;
  this.closed = false;
  this.connected = false;
  this.reconnectTimer = null;
  this.lastTransportError = {};

  this.keepAliveInterval = ua.configuration.keepAliveInterval;
  this.keepAliveTimeout = null;
  this.keepAliveTimer = null;

  this.ua.transport = this;

  // Connect
  this.connect();
};

Transport.prototype = {
  /**
   * Send a message.
   * @param {SIP.OutgoingRequest|String} msg
   * @returns {Boolean}
   */
  send: function(msg) {
    var message = msg.toString();

    if(this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.ua.configuration.traceSip === true) {
        this.logger.log('sending WebSocket message:\n\n' + message + '\n');
      }
      this.ws.send(message);
      return true;
    } else {
      this.logger.warn('unable to send message, WebSocket is not open');
      return false;
    }
  },

  /**
   * Send a keep-alive (a double-CRLF sequence).
   * @private
   * @returns {Boolean}
   */
  sendKeepAlive: function() {
    if(this.keepAliveTimeout) { return; }

    this.keepAliveTimeout = SIP.Timers.setTimeout(function() {
      this.ua.emit('keepAliveTimeout');
    }.bind(this), 10000);

    return this.send('\r\n\r\n');
  },

  /**
   * Start sending keep-alives.
   * @private
   */
  startSendingKeepAlives: function() {
    if (this.keepAliveInterval && !this.keepAliveTimer) {
      this.keepAliveTimer = SIP.Timers.setTimeout(function() {
        this.sendKeepAlive();
        this.keepAliveTimer = null;
        this.startSendingKeepAlives();
      }.bind(this), computeKeepAliveTimeout(this.keepAliveInterval));
    }
  },

  /**
   * Stop sending keep-alives.
   * @private
   */
  stopSendingKeepAlives: function() {
    SIP.Timers.clearTimeout(this.keepAliveTimer);
    SIP.Timers.clearTimeout(this.keepAliveTimeout);
    this.keepAliveTimer = null;
    this.keepAliveTimeout = null;
  },

  /**
  * Disconnect socket.
  */
  disconnect: function() {
    if(this.ws) {
      // Clear reconnectTimer
      SIP.Timers.clearTimeout(this.reconnectTimer);

      this.stopSendingKeepAlives();

      this.closed = true;
      this.logger.log('closing WebSocket ' + this.server.ws_uri);
      this.ws.close();
    }

    if (this.reconnectTimer !== null) {
      SIP.Timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.ua.emit('disconnected', {
        transport: this,
        code: this.lastTransportError.code,
        reason: this.lastTransportError.reason
      });
    }
  },

  /**
  * Connect socket.
  */
  connect: function() {
    var transport = this;

    if(this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.logger.log('WebSocket ' + this.server.ws_uri + ' is already connected');
      return false;
    }

    if(this.ws) {
      this.ws.close();
    }

    this.logger.log('connecting to WebSocket ' + this.server.ws_uri);
    this.ua.onTransportConnecting(this,
      (this.reconnection_attempts === 0)?1:this.reconnection_attempts);

    try {
      this.ws = new WebSocket(this.server.ws_uri, 'sip');
    } catch(e) {
      this.logger.warn('error connecting to WebSocket ' + this.server.ws_uri + ': ' + e);
    }

    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = function() {
      transport.onOpen();
    };

    this.ws.onclose = function(e) {
      transport.onClose(e);
    };

    this.ws.onmessage = function(e) {
      transport.onMessage(e);
    };

    this.ws.onerror = function(e) {
      transport.onError(e);
    };
  },

  // Transport Event Handlers

  /**
  * @event
  * @param {event} e
  */
  onOpen: function() {
    this.connected = true;

    this.logger.log('WebSocket ' + this.server.ws_uri + ' connected');
    // Clear reconnectTimer since we are not disconnected
    if (this.reconnectTimer !== null) {
      SIP.Timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Reset reconnection_attempts
    this.reconnection_attempts = 0;
    // Disable closed
    this.closed = false;
    // Trigger onTransportConnected callback
    this.ua.onTransportConnected(this);
    // Start sending keep-alives
    this.startSendingKeepAlives();
  },

  /**
  * @event
  * @param {event} e
  */
  onClose: function(e) {
    var connected_before = this.connected;

    this.lastTransportError.code = e.code;
    this.lastTransportError.reason = e.reason;

    this.stopSendingKeepAlives();

    if (this.reconnection_attempts > 0) {
      this.logger.log('Reconnection attempt ' + this.reconnection_attempts + ' failed (code: ' + e.code + (e.reason? '| reason: ' + e.reason : '') +')');
      this.reconnect();
    } else {
      this.connected = false;
      this.logger.log('WebSocket disconnected (code: ' + e.code + (e.reason? '| reason: ' + e.reason : '') +')');

      if(e.wasClean === false) {
        this.logger.warn('WebSocket abrupt disconnection');
      }
      // Transport was connected
      if(connected_before === true) {
        this.ua.onTransportClosed(this);
        // Check whether the user requested to close.
        if(!this.closed) {
          this.reconnect();
        } else {
          this.ua.emit('disconnected', {
            transport: this,
            code: this.lastTransportError.code,
            reason: this.lastTransportError.reason
          });

        }
      } else {
        // This is the first connection attempt
        //Network error
        this.ua.onTransportError(this);
      }
    }
  },

  /**
  * @event
  * @param {event} e
  */
  onMessage: function(e) {
    var message, transaction,
      data = e.data;

    // CRLF Keep Alive response from server. Ignore it.
    if(data === '\r\n') {
      SIP.Timers.clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = null;

      if (this.ua.configuration.traceSip === true) {
        this.logger.log('received WebSocket message with CRLF Keep Alive response');
      }

      return;
    }

    // WebSocket binary message.
    else if (typeof data !== 'string') {
      try {
        data = String.fromCharCode.apply(null, new Uint8Array(data));
      } catch(evt) {
        this.logger.warn('received WebSocket binary message failed to be converted into string, message discarded');
        return;
      }

      if (this.ua.configuration.traceSip === true) {
        this.logger.log('received WebSocket binary message:\n\n' + data + '\n');
      }
    }

    // WebSocket text message.
    else {
      if (this.ua.configuration.traceSip === true) {
        this.logger.log('received WebSocket text message:\n\n' + data + '\n');
      }
    }

    message = SIP.Parser.parseMessage(data, this.ua);

    if (!message) {
      return;
    }

    if(this.ua.status === SIP.UA.C.STATUS_USER_CLOSED && message instanceof SIP.IncomingRequest) {
      return;
    }

    // Do some sanity check
    if(SIP.sanityCheck(message, this.ua, this)) {
      if(message instanceof SIP.IncomingRequest) {
        message.transport = this;
        this.ua.receiveRequest(message);
      } else if(message instanceof SIP.IncomingResponse) {
        /* Unike stated in 18.1.2, if a response does not match
        * any transaction, it is discarded here and no passed to the core
        * in order to be discarded there.
        */
        switch(message.method) {
          case SIP.C.INVITE:
            transaction = this.ua.transactions.ict[message.via_branch];
            if(transaction) {
              transaction.receiveResponse(message);
            }
            break;
          case SIP.C.ACK:
            // Just in case ;-)
            break;
          default:
            transaction = this.ua.transactions.nict[message.via_branch];
            if(transaction) {
              transaction.receiveResponse(message);
            }
            break;
        }
      }
    }
  },

  /**
  * @event
  * @param {event} e
  */
  onError: function(e) {
    this.logger.warn('WebSocket connection error: ' + JSON.stringify(e));
  },

  /**
  * Reconnection attempt logic.
  * @private
  */
  reconnect: function() {
    var transport = this;

    this.reconnection_attempts += 1;

    if(this.reconnection_attempts > this.ua.configuration.wsServerMaxReconnection) {
      this.logger.warn('maximum reconnection attempts for WebSocket ' + this.server.ws_uri);
      this.ua.onTransportError(this);
    } else if (this.reconnection_attempts === 1) {
      this.logger.log('Connection to WebSocket ' + this.server.ws_uri + ' severed, attempting first reconnect');
      transport.connect();
    } else {
      this.logger.log('trying to reconnect to WebSocket ' + this.server.ws_uri + ' (reconnection attempt ' + this.reconnection_attempts + ')');

      this.reconnectTimer = SIP.Timers.setTimeout(function() {
        transport.connect();
        transport.reconnectTimer = null;
      }, this.ua.configuration.wsServerReconnectionTimeout * 1000);
    }
  }
};

/**
 * Compute an amount of time in seconds to wait before sending another
 * keep-alive.
 * @returns {Number}
 */
function computeKeepAliveTimeout(upperBound) {
  var lowerBound = upperBound * 0.8;
  return 1000 * (Math.random() * (upperBound - lowerBound) + lowerBound);
}

Transport.C = C;
return Transport;
};

},{}],81:[function(require,module,exports){
(function (global){
"use strict";
/**
 * @augments SIP
 * @class Class creating a SIP User Agent.
 * @param {function returning SIP.MediaHandler} [configuration.mediaHandlerFactory]
 *        A function will be invoked by each of the UA's Sessions to build the MediaHandler for that Session.
 *        If no (or a falsy) value is provided, each Session will use a default (WebRTC) MediaHandler.
 *
 * @param {Object} [configuration.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
 */
module.exports = function (SIP, environment) {
var UA,
  C = {
    // UA status codes
    STATUS_INIT:                0,
    STATUS_STARTING:            1,
    STATUS_READY:               2,
    STATUS_USER_CLOSED:         3,
    STATUS_NOT_READY:           4,

    // UA error codes
    CONFIGURATION_ERROR:  1,
    NETWORK_ERROR:        2,

    /* UA events and corresponding SIP Methods.
     * Dynamically added to 'Allow' header field if the
     * corresponding event handler is set.
     */
    EVENT_METHODS: {
      'invite': 'INVITE',
      'message': 'MESSAGE'
    },

    ALLOWED_METHODS: [
      'ACK',
      'CANCEL',
      'BYE',
      'OPTIONS',
      'INFO',
      'NOTIFY'
    ],

    ACCEPTED_BODY_TYPES: [
      'application/sdp',
      'application/dtmf-relay'
    ],

    MAX_FORWARDS: 70,
    TAG_LENGTH: 10
  };

UA = function(configuration) {
  var self = this;

  // Helper function for forwarding events
  function selfEmit(type) {
    //registrationFailed handler is invoked with two arguments. Allow event handlers to be invoked with a variable no. of arguments
    return self.emit.bind(self, type);
  }

  // Set Accepted Body Types
  C.ACCEPTED_BODY_TYPES = C.ACCEPTED_BODY_TYPES.toString();

  this.log = new SIP.LoggerFactory();
  this.logger = this.getLogger('sip.ua');

  this.cache = {
    credentials: {}
  };

  this.configuration = {};
  this.dialogs = {};

  //User actions outside any session/dialog (MESSAGE)
  this.applicants = {};

  this.data = {};
  this.sessions = {};
  this.subscriptions = {};
  this.transport = null;
  this.contact = null;
  this.status = C.STATUS_INIT;
  this.error = null;
  this.transactions = {
    nist: {},
    nict: {},
    ist: {},
    ict: {}
  };

  this.transportRecoverAttempts = 0;
  this.transportRecoveryTimer = null;

  Object.defineProperties(this, {
    transactionsCount: {
      get: function() {
        var type,
          transactions = ['nist','nict','ist','ict'],
          count = 0;

        for (type in transactions) {
          count += Object.keys(this.transactions[transactions[type]]).length;
        }

        return count;
      }
    },

    nictTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['nict']).length;
      }
    },

    nistTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['nist']).length;
      }
    },

    ictTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['ict']).length;
      }
    },

    istTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['ist']).length;
      }
    }
  });

  /**
   * Load configuration
   *
   * @throws {SIP.Exceptions.ConfigurationError}
   * @throws {TypeError}
   */

  if(configuration === undefined) {
    configuration = {};
  } else if (typeof configuration === 'string' || configuration instanceof String) {
    configuration = {
      uri: configuration
    };
  }

  // Apply log configuration if present
  if (configuration.log) {
    if (configuration.log.hasOwnProperty('builtinEnabled')) {
      this.log.builtinEnabled = configuration.log.builtinEnabled;
    }

    if (configuration.log.hasOwnProperty('level')) {
      this.log.level = configuration.log.level;
    }

    if (configuration.log.hasOwnProperty('connector')) {
      this.log.connector = configuration.log.connector;
    }
  }

  try {
    this.loadConfig(configuration);
  } catch(e) {
    this.status = C.STATUS_NOT_READY;
    this.error = C.CONFIGURATION_ERROR;
    throw e;
  }

  // Initialize registerContext
  this.registerContext = new SIP.RegisterContext(this);
  this.registerContext.on('failed', selfEmit('registrationFailed'));
  this.registerContext.on('registered', selfEmit('registered'));
  this.registerContext.on('unregistered', selfEmit('unregistered'));

  if(this.configuration.autostart) {
    this.start();
  }

  if (typeof environment.addEventListener === 'function') {
    // Google Chrome Packaged Apps don't allow 'unload' listeners:
    // unload is not available in packaged apps
    if (!(global.chrome && global.chrome.app && global.chrome.app.runtime)) {
      environment.addEventListener('unload', this.stop.bind(this));
    }
  }
};
UA.prototype = Object.create(SIP.EventEmitter.prototype);

//=================
//  High Level API
//=================

UA.prototype.register = function(options) {
  this.configuration.register = true;
  this.registerContext.register(options);

  return this;
};

/**
 * Unregister.
 *
 * @param {Boolean} [all] unregister all user bindings.
 *
 */
UA.prototype.unregister = function(options) {
  this.configuration.register = false;

  var context = this.registerContext;
  this.afterConnected(context.unregister.bind(context, options));

  return this;
};

UA.prototype.isRegistered = function() {
  return this.registerContext.registered;
};

/**
 * Connection state.
 * @param {Boolean}
 */
UA.prototype.isConnected = function() {
  return this.transport ? this.transport.connected : false;
};

UA.prototype.afterConnected = function afterConnected (callback) {
  if (this.isConnected()) {
    callback();
  } else {
    this.once('connected', callback);
  }
};

/**
 * Make an outgoing call.
 *
 * @param {String} target
 * @param {Object} views
 * @param {Object} [options.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
 *
 * @throws {TypeError}
 *
 */
UA.prototype.invite = function(target, options) {
  var context = new SIP.InviteClientContext(this, target, options);

  this.afterConnected(context.invite.bind(context));
  return context;
};

UA.prototype.subscribe = function(target, event, options) {
  var sub = new SIP.Subscription(this, target, event, options);

  this.afterConnected(sub.subscribe.bind(sub));
  return sub;
};

/**
 * Send a message.
 *
 * @param {String} target
 * @param {String} body
 * @param {Object} [options]
 *
 * @throws {TypeError}
 *
 */
UA.prototype.message = function(target, body, options) {
  if (body === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // There is no Message module, so it is okay that the UA handles defaults here.
  options = Object.create(options || Object.prototype);
  options.contentType || (options.contentType = 'text/plain');
  options.body = body;

  return this.request(SIP.C.MESSAGE, target, options);
};

UA.prototype.request = function (method, target, options) {
  var req = new SIP.ClientContext(this, method, target, options);

  this.afterConnected(req.send.bind(req));
  return req;
};

/**
 * Gracefully close.
 *
 */
UA.prototype.stop = function() {
  var session, subscription, applicant,
    ua = this;

  function transactionsListener() {
    if (ua.nistTransactionsCount === 0 && ua.nictTransactionsCount === 0) {
        ua.removeListener('transactionDestroyed', transactionsListener);
        ua.transport.disconnect();
    }
  }

  this.logger.log('user requested closure...');

  if(this.status === C.STATUS_USER_CLOSED) {
    this.logger.warn('UA already closed');
    return this;
  }

  // Clear transportRecoveryTimer
  SIP.Timers.clearTimeout(this.transportRecoveryTimer);

  // Close registerContext
  this.logger.log('closing registerContext');
  this.registerContext.close();

  // Run  _terminate_ on every Session
  for(session in this.sessions) {
    this.logger.log('closing session ' + session);
    this.sessions[session].terminate();
  }

  //Run _close_ on every Subscription
  for(subscription in this.subscriptions) {
    this.logger.log('unsubscribing from subscription ' + subscription);
    this.subscriptions[subscription].close();
  }

  // Run  _close_ on every applicant
  for(applicant in this.applicants) {
    this.applicants[applicant].close();
  }

  this.status = C.STATUS_USER_CLOSED;

  /*
   * If the remaining transactions are all INVITE transactions, there is no need to
   * wait anymore because every session has already been closed by this method.
   * - locally originated sessions where terminated (CANCEL or BYE)
   * - remotely originated sessions where rejected (4XX) or terminated (BYE)
   * Remaining INVITE transactions belong tho sessions that where answered. This are in
   * 'accepted' state due to timers 'L' and 'M' defined in [RFC 6026]
   */
  if (this.nistTransactionsCount === 0 && this.nictTransactionsCount === 0) {
    this.transport.disconnect();
  } else {
    this.on('transactionDestroyed', transactionsListener);
  }

  return this;
};

/**
 * Connect to the WS server if status = STATUS_INIT.
 * Resume UA after being closed.
 *
 */
UA.prototype.start = function() {
  var server;

  this.logger.log('user requested startup...');
  if (this.status === C.STATUS_INIT) {
    server = this.getNextWsServer();
    this.status = C.STATUS_STARTING;
    new SIP.Transport(this, server);
  } else if(this.status === C.STATUS_USER_CLOSED) {
    this.logger.log('resuming');
    this.status = C.STATUS_READY;
    this.transport.connect();
  } else if (this.status === C.STATUS_STARTING) {
    this.logger.log('UA is in STARTING status, not opening new connection');
  } else if (this.status === C.STATUS_READY) {
    this.logger.log('UA is in READY status, not resuming');
  } else {
    this.logger.error('Connection is down. Auto-Recovery system is trying to connect');
  }

  return this;
};

/**
 * Normalize a string into a valid SIP request URI
 *
 * @param {String} target
 *
 * @returns {SIP.URI|undefined}
 */
UA.prototype.normalizeTarget = function(target) {
  return SIP.Utils.normalizeTarget(target, this.configuration.hostportParams);
};


//===============================
//  Private (For internal use)
//===============================

UA.prototype.saveCredentials = function(credentials) {
  this.cache.credentials[credentials.realm] = this.cache.credentials[credentials.realm] || {};
  this.cache.credentials[credentials.realm][credentials.uri] = credentials;

  return this;
};

UA.prototype.getCredentials = function(request) {
  var realm, credentials;

  realm = request.ruri.host;

  if (this.cache.credentials[realm] && this.cache.credentials[realm][request.ruri]) {
    credentials = this.cache.credentials[realm][request.ruri];
    credentials.method = request.method;
  }

  return credentials;
};

UA.prototype.getLogger = function(category, label) {
  return this.log.getLogger(category, label);
};


//==============================
// Event Handlers
//==============================

/**
 * Transport Close event
 * @private
 * @event
 * @param {SIP.Transport} transport.
 */
UA.prototype.onTransportClosed = function(transport) {
  // Run _onTransportError_ callback on every client transaction using _transport_
  var type, idx, length,
    client_transactions = ['nict', 'ict', 'nist', 'ist'];

  transport.server.status = SIP.Transport.C.STATUS_DISCONNECTED;
  this.logger.log('connection state set to '+ SIP.Transport.C.STATUS_DISCONNECTED);

  length = client_transactions.length;
  for (type = 0; type < length; type++) {
    for(idx in this.transactions[client_transactions[type]]) {
      this.transactions[client_transactions[type]][idx].onTransportError();
    }
  }

  // Close sessions if GRUU is not being used
  if (!this.contact.pub_gruu) {
    this.closeSessionsOnTransportError();
  }

};

/**
 * Unrecoverable transport event.
 * Connection reattempt logic has been done and didn't success.
 * @private
 * @event
 * @param {SIP.Transport} transport.
 */
UA.prototype.onTransportError = function(transport) {
  var server;

  this.logger.log('transport ' + transport.server.ws_uri + ' failed | connection state set to '+ SIP.Transport.C.STATUS_ERROR);

  // Close sessions.
  //Mark this transport as 'down'
  transport.server.status = SIP.Transport.C.STATUS_ERROR;

  this.emit('disconnected', {
    transport: transport
  });

  // try the next transport if the UA isn't closed
  if(this.status === C.STATUS_USER_CLOSED) {
    return;
  }

  server = this.getNextWsServer();

  if(server) {
    new SIP.Transport(this, server);
  }else {
    this.closeSessionsOnTransportError();
    if (!this.error || this.error !== C.NETWORK_ERROR) {
      this.status = C.STATUS_NOT_READY;
      this.error = C.NETWORK_ERROR;
    }
    // Transport Recovery process
    this.recoverTransport();
  }
};

/**
 * Transport connection event.
 * @private
 * @event
 * @param {SIP.Transport} transport.
 */
UA.prototype.onTransportConnected = function(transport) {
  this.transport = transport;

  // Reset transport recovery counter
  this.transportRecoverAttempts = 0;

  transport.server.status = SIP.Transport.C.STATUS_READY;
  this.logger.log('connection state set to '+ SIP.Transport.C.STATUS_READY);

  if(this.status === C.STATUS_USER_CLOSED) {
    return;
  }

  this.status = C.STATUS_READY;
  this.error = null;

  if(this.configuration.register) {
    this.configuration.authenticationFactory.initialize().then(function () {
      this.registerContext.onTransportConnected();
    }.bind(this));
  }

  this.emit('connected', {
    transport: transport
  });
};


/**
 * Transport connecting event
 * @private
 * @param {SIP.Transport} transport.
 * #param {Integer} attempts.
 */
  UA.prototype.onTransportConnecting = function(transport, attempts) {
    this.emit('connecting', {
      transport: transport,
      attempts: attempts
    });
  };


/**
 * new Transaction
 * @private
 * @param {SIP.Transaction} transaction.
 */
UA.prototype.newTransaction = function(transaction) {
  this.transactions[transaction.type][transaction.id] = transaction;
  this.emit('newTransaction', {transaction: transaction});
};


/**
 * destroy Transaction
 * @private
 * @param {SIP.Transaction} transaction.
 */
UA.prototype.destroyTransaction = function(transaction) {
  delete this.transactions[transaction.type][transaction.id];
  this.emit('transactionDestroyed', {
    transaction: transaction
  });
};


//=========================
// receiveRequest
//=========================

/**
 * Request reception
 * @private
 * @param {SIP.IncomingRequest} request.
 */
UA.prototype.receiveRequest = function(request) {
  var dialog, session, message,
    method = request.method,
    transaction,
    replaces,
    replacedDialog,
    methodLower = request.method.toLowerCase(),
    self = this;

  function ruriMatches (uri) {
    return uri && uri.user === request.ruri.user;
  }

  // Check that request URI points to us
  if(!(ruriMatches(this.configuration.uri) ||
       ruriMatches(this.contact.uri) ||
       ruriMatches(this.contact.pub_gruu) ||
       ruriMatches(this.contact.temp_gruu))) {
    this.logger.warn('Request-URI does not point to us');
    if (request.method !== SIP.C.ACK) {
      request.reply_sl(404);
    }
    return;
  }

  // Check request URI scheme
  if(request.ruri.scheme === SIP.C.SIPS) {
    request.reply_sl(416);
    return;
  }

  // Check transaction
  if(SIP.Transactions.checkTransaction(this, request)) {
    return;
  }

  /* RFC3261 12.2.2
   * Requests that do not change in any way the state of a dialog may be
   * received within a dialog (for example, an OPTIONS request).
   * They are processed as if they had been received outside the dialog.
   */
  if(method === SIP.C.OPTIONS) {
    new SIP.Transactions.NonInviteServerTransaction(request, this);
    request.reply(200, null, [
      'Allow: '+ SIP.Utils.getAllowedMethods(this),
      'Accept: '+ C.ACCEPTED_BODY_TYPES
    ]);
  } else if (method === SIP.C.MESSAGE) {
    if (!this.listeners(methodLower).length) {
      // UA is not listening for this.  Reject immediately.
      new SIP.Transactions.NonInviteServerTransaction(request, this);
      request.reply(405, null, ['Allow: '+ SIP.Utils.getAllowedMethods(this)]);
      return;
    }
    message = new SIP.ServerContext(this, request);
    message.body = request.body;
    message.content_type = request.getHeader('Content-Type') || 'text/plain';

    request.reply(200, null);
    this.emit('message', message);
  } else if (method !== SIP.C.INVITE &&
             method !== SIP.C.ACK) {
    // Let those methods pass through to normal processing for now.
    transaction = new SIP.ServerContext(this, request);
  }

  // Initial Request
  if(!request.to_tag) {
    switch(method) {
      case SIP.C.INVITE:
        replaces =
          this.configuration.replaces !== SIP.C.supported.UNSUPPORTED &&
          request.parseHeader('replaces');

        if (replaces) {
          replacedDialog = this.dialogs[replaces.call_id + replaces.replaces_to_tag + replaces.replaces_from_tag];

          if (!replacedDialog) {
            //Replaced header without a matching dialog, reject
            request.reply_sl(481, null);
            return;
          } else if (replacedDialog.owner.status === SIP.Session.C.STATUS_TERMINATED) {
            request.reply_sl(603, null);
            return;
          } else if (replacedDialog.state === SIP.Dialog.C.STATUS_CONFIRMED && replaces.early_only) {
            request.reply_sl(486, null);
            return;
          }
        }

        var isMediaSupported = this.configuration.mediaHandlerFactory.isSupported;
        if(!isMediaSupported || isMediaSupported()) {
          session = new SIP.InviteServerContext(this, request);
          session.replacee = replacedDialog && replacedDialog.owner;
          session.on('invite', function() {
            self.emit('invite', this);
          });
        } else {
          this.logger.warn('INVITE received but WebRTC is not supported');
          request.reply(488);
        }
        break;
      case SIP.C.BYE:
        // Out of dialog BYE received
        request.reply(481);
        break;
      case SIP.C.CANCEL:
        session = this.findSession(request);
        if(session) {
          session.receiveRequest(request);
        } else {
          this.logger.warn('received CANCEL request for a non existent session');
        }
        break;
      case SIP.C.ACK:
        /* Absorb it.
         * ACK request without a corresponding Invite Transaction
         * and without To tag.
         */
        break;
      default:
        request.reply(405);
        break;
    }
  }
  // In-dialog request
  else {
    dialog = this.findDialog(request);

    if(dialog) {
      if (method === SIP.C.INVITE) {
        new SIP.Transactions.InviteServerTransaction(request, this);
      }
      dialog.receiveRequest(request);
    } else if (method === SIP.C.NOTIFY) {
      session = this.findSession(request);
      if(session) {
        session.receiveRequest(request);
      } else {
        this.logger.warn('received NOTIFY request for a non existent session');
        request.reply(481, 'Subscription does not exist');
      }
    }
    /* RFC3261 12.2.2
     * Request with to tag, but no matching dialog found.
     * Exception: ACK for an Invite request for which a dialog has not
     * been created.
     */
    else {
      if(method !== SIP.C.ACK) {
        request.reply(481);
      }
    }
  }
};

//=================
// Utils
//=================

/**
 * Get the session to which the request belongs to, if any.
 * @private
 * @param {SIP.IncomingRequest} request.
 * @returns {SIP.OutgoingSession|SIP.IncomingSession|null}
 */
UA.prototype.findSession = function(request) {
  return this.sessions[request.call_id + request.from_tag] ||
          this.sessions[request.call_id + request.to_tag] ||
          null;
};

/**
 * Get the dialog to which the request belongs to, if any.
 * @private
 * @param {SIP.IncomingRequest}
 * @returns {SIP.Dialog|null}
 */
UA.prototype.findDialog = function(request) {
  return this.dialogs[request.call_id + request.from_tag + request.to_tag] ||
          this.dialogs[request.call_id + request.to_tag + request.from_tag] ||
          null;
};

/**
 * Retrieve the next server to which connect.
 * @private
 * @returns {Object} ws_server
 */
UA.prototype.getNextWsServer = function() {
  // Order servers by weight
  var idx, length, ws_server,
    candidates = [];

  length = this.configuration.wsServers.length;
  for (idx = 0; idx < length; idx++) {
    ws_server = this.configuration.wsServers[idx];

    if (ws_server.status === SIP.Transport.C.STATUS_ERROR) {
      continue;
    } else if (candidates.length === 0) {
      candidates.push(ws_server);
    } else if (ws_server.weight > candidates[0].weight) {
      candidates = [ws_server];
    } else if (ws_server.weight === candidates[0].weight) {
      candidates.push(ws_server);
    }
  }

  idx = Math.floor(Math.random() * candidates.length);

  return candidates[idx];
};

/**
 * Close all sessions on transport error.
 * @private
 */
UA.prototype.closeSessionsOnTransportError = function() {
  var idx;

  // Run _transportError_ for every Session
  for(idx in this.sessions) {
    this.sessions[idx].onTransportError();
  }
  // Call registerContext _onTransportClosed_
  this.registerContext.onTransportClosed();
};

UA.prototype.recoverTransport = function(ua) {
  var idx, length, k, nextRetry, count, server;

  ua = ua || this;
  count = ua.transportRecoverAttempts;

  length = ua.configuration.wsServers.length;
  for (idx = 0; idx < length; idx++) {
    ua.configuration.wsServers[idx].status = 0;
  }

  server = ua.getNextWsServer();

  k = Math.floor((Math.random() * Math.pow(2,count)) +1);
  nextRetry = k * ua.configuration.connectionRecoveryMinInterval;

  if (nextRetry > ua.configuration.connectionRecoveryMaxInterval) {
    this.logger.log('time for next connection attempt exceeds connectionRecoveryMaxInterval, resetting counter');
    nextRetry = ua.configuration.connectionRecoveryMinInterval;
    count = 0;
  }

  this.logger.log('next connection attempt in '+ nextRetry +' seconds');

  this.transportRecoveryTimer = SIP.Timers.setTimeout(
    function(){
      ua.transportRecoverAttempts = count + 1;
      new SIP.Transport(ua, server);
    }, nextRetry * 1000);
};

function checkAuthenticationFactory (authenticationFactory) {
  if (!(authenticationFactory instanceof Function)) {
    return;
  }
  if (!authenticationFactory.initialize) {
    authenticationFactory.initialize = function initialize () {
      return SIP.Utils.Promise.resolve();
    };
  }
  return authenticationFactory;
}

/**
 * Configuration load.
 * @private
 * returns {Boolean}
 */
UA.prototype.loadConfig = function(configuration) {
  // Settings and default values
  var parameter, value, checked_value, hostportParams, registrarServer,
    settings = {
      /* Host address
      * Value to be set in Via sent_by and host part of Contact FQDN
      */
      viaHost: SIP.Utils.createRandomToken(12) + '.invalid',

      uri: new SIP.URI('sip', 'anonymous.' + SIP.Utils.createRandomToken(6), 'anonymous.invalid', null, null),
      wsServers: [{
        scheme: 'WSS',
        sip_uri: '<sip:edge.sip.onsip.com;transport=ws;lr>',
        status: 0,
        weight: 0,
        ws_uri: 'wss://edge.sip.onsip.com'
      }],

      // Password
      password: null,

      // Registration parameters
      registerExpires: 600,
      register: true,
      registrarServer: null,

      // Transport related parameters
      wsServerMaxReconnection: 3,
      wsServerReconnectionTimeout: 4,

      connectionRecoveryMinInterval: 2,
      connectionRecoveryMaxInterval: 30,

      keepAliveInterval: 0,

      extraSupported: [],

      usePreloadedRoute: false,

      //string to be inserted into User-Agent request header
      userAgentString: SIP.C.USER_AGENT,

      // Session parameters
      iceCheckingTimeout: 5000,
      noAnswerTimeout: 60,
      stunServers: ['stun:stun.l.google.com:19302'],
      turnServers: [],

      // Logging parameters
      traceSip: false,

      // Hacks
      hackViaTcp: false,
      hackIpInContact: false,
      hackWssInTransport: false,
      hackAllowUnregisteredOptionTags: false,

      contactTransport: 'ws',
      forceRport: false,

      //autostarting
      autostart: true,

      //Reliable Provisional Responses
      rel100: SIP.C.supported.UNSUPPORTED,

      // Replaces header (RFC 3891)
      // http://tools.ietf.org/html/rfc3891
      replaces: SIP.C.supported.UNSUPPORTED,

      mediaHandlerFactory: SIP.WebRTC.MediaHandler.defaultFactory,

      authenticationFactory: checkAuthenticationFactory(function authenticationFactory (ua) {
        return new SIP.DigestAuthentication(ua);
      })
    };

  // Pre-Configuration
  function aliasUnderscored (parameter, logger) {
    var underscored = parameter.replace(/([a-z][A-Z])/g, function (m) {
      return m[0] + '_' + m[1].toLowerCase();
    });

    if (parameter === underscored) {
      return;
    }

    var hasParameter = configuration.hasOwnProperty(parameter);
    if (configuration.hasOwnProperty(underscored)) {
      logger.warn(underscored + ' is deprecated, please use ' + parameter);
      if (hasParameter) {
        logger.warn(parameter + ' overriding ' + underscored);
      }
    }

    configuration[parameter] = hasParameter ? configuration[parameter] : configuration[underscored];
  }

  // Check Mandatory parameters
  for(parameter in UA.configuration_check.mandatory) {
    aliasUnderscored(parameter, this.logger);
    if(!configuration.hasOwnProperty(parameter)) {
      throw new SIP.Exceptions.ConfigurationError(parameter);
    } else {
      value = configuration[parameter];
      checked_value = UA.configuration_check.mandatory[parameter](value);
      if (checked_value !== undefined) {
        settings[parameter] = checked_value;
      } else {
        throw new SIP.Exceptions.ConfigurationError(parameter, value);
      }
    }
  }

  SIP.Utils.optionsOverride(configuration, 'rel100', 'reliable', true, this.logger, SIP.C.supported.UNSUPPORTED);

  var emptyArraysAllowed = ['stunServers', 'turnServers'];

  // Check Optional parameters
  for(parameter in UA.configuration_check.optional) {
    aliasUnderscored(parameter, this.logger);
    if(configuration.hasOwnProperty(parameter)) {
      value = configuration[parameter];

      // If the parameter value is an empty array, but shouldn't be, apply its default value.
      if (value instanceof Array && value.length === 0 && emptyArraysAllowed.indexOf(parameter) < 0) { continue; }

      // If the parameter value is null, empty string, or undefined then apply its default value.
      if(value === null || value === "" || value === undefined) { continue; }
      // If it's a number with NaN value then also apply its default value.
      // NOTE: JS does not allow "value === NaN", the following does the work:
      else if(typeof(value) === 'number' && isNaN(value)) { continue; }

      checked_value = UA.configuration_check.optional[parameter](value);
      if (checked_value !== undefined) {
        settings[parameter] = checked_value;
      } else {
        throw new SIP.Exceptions.ConfigurationError(parameter, value);
      }
    }
  }

  // Sanity Checks

  // Connection recovery intervals
  if(settings.connectionRecoveryMaxInterval < settings.connectionRecoveryMinInterval) {
    throw new SIP.Exceptions.ConfigurationError('connectionRecoveryMaxInterval', settings.connectionRecoveryMaxInterval);
  }

  // Post Configuration Process

  // Allow passing 0 number as displayName.
  if (settings.displayName === 0) {
    settings.displayName = '0';
  }

  // Instance-id for GRUU
  if (!settings.instanceId) {
    settings.instanceId = SIP.Utils.newUUID();
  }

  // sipjsId instance parameter. Static random tag of length 5
  settings.sipjsId = SIP.Utils.createRandomToken(5);

  // String containing settings.uri without scheme and user.
  hostportParams = settings.uri.clone();
  hostportParams.user = null;
  settings.hostportParams = hostportParams.toRaw().replace(/^sip:/i, '');

  /* Check whether authorizationUser is explicitly defined.
   * Take 'settings.uri.user' value if not.
   */
  if (!settings.authorizationUser) {
    settings.authorizationUser = settings.uri.user;
  }

  /* If no 'registrarServer' is set use the 'uri' value without user portion. */
  if (!settings.registrarServer) {
    registrarServer = settings.uri.clone();
    registrarServer.user = null;
    settings.registrarServer = registrarServer;
  }

  // User noAnswerTimeout
  settings.noAnswerTimeout = settings.noAnswerTimeout * 1000;

  // Via Host
  if (settings.hackIpInContact) {
    if (typeof settings.hackIpInContact === 'boolean') {
      settings.viaHost = SIP.Utils.getRandomTestNetIP();
    }
    else if (typeof settings.hackIpInContact === 'string') {
      settings.viaHost = settings.hackIpInContact;
    }
  }

  // Contact transport parameter
  if (settings.hackWssInTransport) {
    settings.contactTransport = 'wss';
  }

  this.contact = {
    pub_gruu: null,
    temp_gruu: null,
    uri: new SIP.URI('sip', SIP.Utils.createRandomToken(8), settings.viaHost, null, {transport: settings.contactTransport}),
    toString: function(options){
      options = options || {};

      var
        anonymous = options.anonymous || null,
        outbound = options.outbound || null,
        contact = '<';

      if (anonymous) {
        contact += (this.temp_gruu || ('sip:anonymous@anonymous.invalid;transport='+settings.contactTransport)).toString();
      } else {
        contact += (this.pub_gruu || this.uri).toString();
      }

      if (outbound) {
        contact += ';ob';
      }

      contact += '>';

      return contact;
    }
  };

  // media overrides mediaConstraints
  SIP.Utils.optionsOverride(settings, 'media', 'mediaConstraints', true, this.logger);

  // Fill the value of the configuration_skeleton
  for(parameter in settings) {
    UA.configuration_skeleton[parameter].value = settings[parameter];
  }

  Object.defineProperties(this.configuration, UA.configuration_skeleton);

  // Clean UA.configuration_skeleton
  for(parameter in settings) {
    UA.configuration_skeleton[parameter].value = '';
  }

  this.logger.log('configuration parameters after validation:');
  for(parameter in settings) {
    switch(parameter) {
      case 'uri':
      case 'registrarServer':
      case 'mediaHandlerFactory':
        this.logger.log('· ' + parameter + ': ' + settings[parameter]);
        break;
      case 'password':
        this.logger.log('· ' + parameter + ': ' + 'NOT SHOWN');
        break;
      default:
        this.logger.log('· ' + parameter + ': ' + JSON.stringify(settings[parameter]));
    }
  }

  return;
};

/**
 * Configuration Object skeleton.
 * @private
 */
UA.configuration_skeleton = (function() {
  var idx,  parameter,
    skeleton = {},
    parameters = [
      // Internal parameters
      "sipjsId",
      "hostportParams",

      // Optional user configurable parameters
      "uri",
      "wsServers",
      "authorizationUser",
      "connectionRecoveryMaxInterval",
      "connectionRecoveryMinInterval",
      "keepAliveInterval",
      "extraSupported",
      "displayName",
      "hackViaTcp", // false.
      "hackIpInContact", //false
      "hackWssInTransport", //false
      "hackAllowUnregisteredOptionTags", //false
      "contactTransport", // 'ws'
      "forceRport", // false
      "iceCheckingTimeout",
      "instanceId",
      "noAnswerTimeout", // 30 seconds.
      "password",
      "registerExpires", // 600 seconds.
      "registrarServer",
      "reliable",
      "rel100",
      "replaces",
      "userAgentString", //SIP.C.USER_AGENT
      "autostart",
      "stunServers",
      "traceSip",
      "turnServers",
      "usePreloadedRoute",
      "wsServerMaxReconnection",
      "wsServerReconnectionTimeout",
      "mediaHandlerFactory",
      "media",
      "mediaConstraints",
      "authenticationFactory",

      // Post-configuration generated parameters
      "via_core_value",
      "viaHost"
    ];

  for(idx in parameters) {
    parameter = parameters[idx];
    skeleton[parameter] = {
      value: '',
      writable: false,
      configurable: false
    };
  }

  skeleton['register'] = {
    value: '',
    writable: true,
    configurable: false
  };

  return skeleton;
}());

/**
 * Configuration checker.
 * @private
 * @return {Boolean}
 */
UA.configuration_check = {
  mandatory: {
  },

  optional: {

    uri: function(uri) {
      var parsed;

      if (!(/^sip:/i).test(uri)) {
        uri = SIP.C.SIP + ':' + uri;
      }
      parsed = SIP.URI.parse(uri);

      if(!parsed) {
        return;
      } else if(!parsed.user) {
        return;
      } else {
        return parsed;
      }
    },

    //Note: this function used to call 'this.logger.error' but calling 'this' with anything here is invalid
    wsServers: function(wsServers) {
      var idx, length, url;

      /* Allow defining wsServers parameter as:
       *  String: "host"
       *  Array of Strings: ["host1", "host2"]
       *  Array of Objects: [{ws_uri:"host1", weight:1}, {ws_uri:"host2", weight:0}]
       *  Array of Objects and Strings: [{ws_uri:"host1"}, "host2"]
       */
      if (typeof wsServers === 'string') {
        wsServers = [{ws_uri: wsServers}];
      } else if (wsServers instanceof Array) {
        length = wsServers.length;
        for (idx = 0; idx < length; idx++) {
          if (typeof wsServers[idx] === 'string'){
            wsServers[idx] = {ws_uri: wsServers[idx]};
          }
        }
      } else {
        return;
      }

      if (wsServers.length === 0) {
        return false;
      }

      length = wsServers.length;
      for (idx = 0; idx < length; idx++) {
        if (!wsServers[idx].ws_uri) {
          return;
        }
        if (wsServers[idx].weight && !Number(wsServers[idx].weight)) {
          return;
        }

        url = SIP.Grammar.parse(wsServers[idx].ws_uri, 'absoluteURI');

        if(url === -1) {
          return;
        } else if(['wss', 'ws', 'udp'].indexOf(url.scheme) < 0) {
          return;
        } else {
          wsServers[idx].sip_uri = '<sip:' + url.host + (url.port ? ':' + url.port : '') + ';transport=' + url.scheme.replace(/^wss$/i, 'ws') + ';lr>';

          if (!wsServers[idx].weight) {
            wsServers[idx].weight = 0;
          }

          wsServers[idx].status = 0;
          wsServers[idx].scheme = url.scheme.toUpperCase();
        }
      }
      return wsServers;
    },

    authorizationUser: function(authorizationUser) {
      if(SIP.Grammar.parse('"'+ authorizationUser +'"', 'quoted_string') === -1) {
        return;
      } else {
        return authorizationUser;
      }
    },

    connectionRecoveryMaxInterval: function(connectionRecoveryMaxInterval) {
      var value;
      if(SIP.Utils.isDecimal(connectionRecoveryMaxInterval)) {
        value = Number(connectionRecoveryMaxInterval);
        if(value > 0) {
          return value;
        }
      }
    },

    connectionRecoveryMinInterval: function(connectionRecoveryMinInterval) {
      var value;
      if(SIP.Utils.isDecimal(connectionRecoveryMinInterval)) {
        value = Number(connectionRecoveryMinInterval);
        if(value > 0) {
          return value;
        }
      }
    },

    displayName: function(displayName) {
      if(SIP.Grammar.parse('"' + displayName + '"', 'displayName') === -1) {
        return;
      } else {
        return displayName;
      }
    },

    hackViaTcp: function(hackViaTcp) {
      if (typeof hackViaTcp === 'boolean') {
        return hackViaTcp;
      }
    },

    hackIpInContact: function(hackIpInContact) {
      if (typeof hackIpInContact === 'boolean') {
        return hackIpInContact;
      }
      else if (typeof hackIpInContact === 'string' && SIP.Grammar.parse(hackIpInContact, 'host') !== -1) {
        return hackIpInContact;
      }
    },

    iceCheckingTimeout: function(iceCheckingTimeout) {
      if(SIP.Utils.isDecimal(iceCheckingTimeout)) {
        return Math.max(500, iceCheckingTimeout);
      }
    },

    hackWssInTransport: function(hackWssInTransport) {
      if (typeof hackWssInTransport === 'boolean') {
        return hackWssInTransport;
      }
    },

    hackAllowUnregisteredOptionTags: function(hackAllowUnregisteredOptionTags) {
      if (typeof hackAllowUnregisteredOptionTags === 'boolean') {
        return hackAllowUnregisteredOptionTags;
      }
    },

    contactTransport: function(contactTransport) {
      if (typeof contactTransport === 'string') {
        return contactTransport;
      }
    },

    forceRport: function(forceRport) {
      if (typeof forceRport === 'boolean') {
        return forceRport;
      }
    },

    instanceId: function(instanceId) {
      if(typeof instanceId !== 'string') {
        return;
      }

      if ((/^uuid:/i.test(instanceId))) {
        instanceId = instanceId.substr(5);
      }

      if(SIP.Grammar.parse(instanceId, 'uuid') === -1) {
        return;
      } else {
        return instanceId;
      }
    },

    keepAliveInterval: function(keepAliveInterval) {
      var value;
      if (SIP.Utils.isDecimal(keepAliveInterval)) {
        value = Number(keepAliveInterval);
        if (value > 0) {
          return value;
        }
      }
    },

    extraSupported: function(optionTags) {
      var idx, length;

      if (!(optionTags instanceof Array)) {
        return;
      }

      length = optionTags.length;
      for (idx = 0; idx < length; idx++) {
        if (typeof optionTags[idx] !== 'string') {
          return;
        }
      }

      return optionTags;
    },

    noAnswerTimeout: function(noAnswerTimeout) {
      var value;
      if (SIP.Utils.isDecimal(noAnswerTimeout)) {
        value = Number(noAnswerTimeout);
        if (value > 0) {
          return value;
        }
      }
    },

    password: function(password) {
      return String(password);
    },

    rel100: function(rel100) {
      if(rel100 === SIP.C.supported.REQUIRED) {
        return SIP.C.supported.REQUIRED;
      } else if (rel100 === SIP.C.supported.SUPPORTED) {
        return SIP.C.supported.SUPPORTED;
      } else  {
        return SIP.C.supported.UNSUPPORTED;
      }
    },

    replaces: function(replaces) {
      if(replaces === SIP.C.supported.REQUIRED) {
        return SIP.C.supported.REQUIRED;
      } else if (replaces === SIP.C.supported.SUPPORTED) {
        return SIP.C.supported.SUPPORTED;
      } else  {
        return SIP.C.supported.UNSUPPORTED;
      }
    },

    register: function(register) {
      if (typeof register === 'boolean') {
        return register;
      }
    },

    registerExpires: function(registerExpires) {
      var value;
      if (SIP.Utils.isDecimal(registerExpires)) {
        value = Number(registerExpires);
        if (value > 0) {
          return value;
        }
      }
    },

    registrarServer: function(registrarServer) {
      var parsed;

      if(typeof registrarServer !== 'string') {
        return;
      }

      if (!/^sip:/i.test(registrarServer)) {
        registrarServer = SIP.C.SIP + ':' + registrarServer;
      }
      parsed = SIP.URI.parse(registrarServer);

      if(!parsed) {
        return;
      } else if(parsed.user) {
        return;
      } else {
        return parsed;
      }
    },

    stunServers: function(stunServers) {
      var idx, length, stun_server;

      if (typeof stunServers === 'string') {
        stunServers = [stunServers];
      } else if (!(stunServers instanceof Array)) {
        return;
      }

      length = stunServers.length;
      for (idx = 0; idx < length; idx++) {
        stun_server = stunServers[idx];
        if (!(/^stuns?:/.test(stun_server))) {
          stun_server = 'stun:' + stun_server;
        }

        if(SIP.Grammar.parse(stun_server, 'stun_URI') === -1) {
          return;
        } else {
          stunServers[idx] = stun_server;
        }
      }
      return stunServers;
    },

    traceSip: function(traceSip) {
      if (typeof traceSip === 'boolean') {
        return traceSip;
      }
    },

    turnServers: function(turnServers) {
      var idx, jdx, length, turn_server, num_turn_server_urls, url;

      if (turnServers instanceof Array) {
        // Do nothing
      } else {
        turnServers = [turnServers];
      }

      length = turnServers.length;
      for (idx = 0; idx < length; idx++) {
        turn_server = turnServers[idx];
        //Backwards compatibility: Allow defining the turn_server url with the 'server' property.
        if (turn_server.server) {
          turn_server.urls = [turn_server.server];
        }

        if (!turn_server.urls || !turn_server.username || !turn_server.password) {
          return;
        }

        if (turn_server.urls instanceof Array) {
          num_turn_server_urls = turn_server.urls.length;
        } else {
          turn_server.urls = [turn_server.urls];
          num_turn_server_urls = 1;
        }

        for (jdx = 0; jdx < num_turn_server_urls; jdx++) {
          url = turn_server.urls[jdx];

          if (!(/^turns?:/.test(url))) {
            url = 'turn:' + url;
          }

          if(SIP.Grammar.parse(url, 'turn_URI') === -1) {
            return;
          }
        }
      }
      return turnServers;
    },

    userAgentString: function(userAgentString) {
      if (typeof userAgentString === 'string') {
        return userAgentString;
      }
    },

    usePreloadedRoute: function(usePreloadedRoute) {
      if (typeof usePreloadedRoute === 'boolean') {
        return usePreloadedRoute;
      }
    },

    wsServerMaxReconnection: function(wsServerMaxReconnection) {
      var value;
      if (SIP.Utils.isDecimal(wsServerMaxReconnection)) {
        value = Number(wsServerMaxReconnection);
        if (value > 0) {
          return value;
        }
      }
    },

    wsServerReconnectionTimeout: function(wsServerReconnectionTimeout) {
      var value;
      if (SIP.Utils.isDecimal(wsServerReconnectionTimeout)) {
        value = Number(wsServerReconnectionTimeout);
        if (value > 0) {
          return value;
        }
      }
    },

    autostart: function(autostart) {
      if (typeof autostart === 'boolean') {
        return autostart;
      }
    },

    mediaHandlerFactory: function(mediaHandlerFactory) {
      if (mediaHandlerFactory instanceof Function) {
        var promisifiedFactory = function promisifiedFactory () {
          var mediaHandler = mediaHandlerFactory.apply(this, arguments);

          function patchMethod (methodName) {
            var method = mediaHandler[methodName];
            if (method.length > 1) {
              var callbacksFirst = methodName === 'getDescription';
              mediaHandler[methodName] = SIP.Utils.promisify(mediaHandler, methodName, callbacksFirst);
            }
          }

          patchMethod('getDescription');
          patchMethod('setDescription');

          return mediaHandler;
        };

        promisifiedFactory.isSupported = mediaHandlerFactory.isSupported;
        return promisifiedFactory;
      }
    },

    authenticationFactory: checkAuthenticationFactory
  }
};

UA.C = C;
SIP.UA = UA;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],82:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP URI
 */

/**
 * @augments SIP
 * @class Class creating a SIP URI.
 *
 * @param {String} [scheme]
 * @param {String} [user]
 * @param {String} host
 * @param {String} [port]
 * @param {Object} [parameters]
 * @param {Object} [headers]
 *
 */
module.exports = function (SIP) {
var URI;

URI = function(scheme, user, host, port, parameters, headers) {
  var param, header, raw, normal;

  // Checks
  if(!host) {
    throw new TypeError('missing or invalid "host" parameter');
  }

  // Initialize parameters
  scheme = scheme || SIP.C.SIP;
  this.parameters = {};
  this.headers = {};

  for (param in parameters) {
    this.setParam(param, parameters[param]);
  }

  for (header in headers) {
    this.setHeader(header, headers[header]);
  }

  // Raw URI
  raw = {
    scheme: scheme,
    user: user,
    host: host,
    port: port
  };

  // Normalized URI
  normal = {
    scheme: scheme.toLowerCase(),
    user: user,
    host: host.toLowerCase(),
    port: port
  };

  Object.defineProperties(this, {
    _normal: {
      get: function() { return normal; }
    },

    _raw: {
      get: function() { return raw; }
    },

    scheme: {
      get: function() { return normal.scheme; },
      set: function(value) {
        raw.scheme = value;
        normal.scheme = value.toLowerCase();
      }
    },

    user: {
      get: function() { return normal.user; },
      set: function(value) {
        normal.user = raw.user = value;
      }
    },

    host: {
      get: function() { return normal.host; },
      set: function(value) {
        raw.host = value;
        normal.host = value.toLowerCase();
      }
    },

    aor: {
      get: function() { return normal.user + '@' + normal.host; }
    },

    port: {
      get: function() { return normal.port; },
      set: function(value) {
        normal.port = raw.port = value === 0 ? value : (parseInt(value,10) || null);
      }
    }
  });
};

URI.prototype = {
  setParam: function(key, value) {
    if(key) {
      this.parameters[key.toLowerCase()] = (typeof value === 'undefined' || value === null) ? null : value.toString().toLowerCase();
    }
  },

  getParam: function(key) {
    if(key) {
      return this.parameters[key.toLowerCase()];
    }
  },

  hasParam: function(key) {
    if(key) {
      return (this.parameters.hasOwnProperty(key.toLowerCase()) && true) || false;
    }
  },

  deleteParam: function(parameter) {
    var value;
    parameter = parameter.toLowerCase();
    if (this.parameters.hasOwnProperty(parameter)) {
      value = this.parameters[parameter];
      delete this.parameters[parameter];
      return value;
    }
  },

  clearParams: function() {
    this.parameters = {};
  },

  setHeader: function(name, value) {
    this.headers[SIP.Utils.headerize(name)] = (value instanceof Array) ? value : [value];
  },

  getHeader: function(name) {
    if(name) {
      return this.headers[SIP.Utils.headerize(name)];
    }
  },

  hasHeader: function(name) {
    if(name) {
      return (this.headers.hasOwnProperty(SIP.Utils.headerize(name)) && true) || false;
    }
  },

  deleteHeader: function(header) {
    var value;
    header = SIP.Utils.headerize(header);
    if(this.headers.hasOwnProperty(header)) {
      value = this.headers[header];
      delete this.headers[header];
      return value;
    }
  },

  clearHeaders: function() {
    this.headers = {};
  },

  clone: function() {
    return new URI(
      this._raw.scheme,
      this._raw.user,
      this._raw.host,
      this._raw.port,
      JSON.parse(JSON.stringify(this.parameters)),
      JSON.parse(JSON.stringify(this.headers)));
  },

  toRaw: function() {
    return this._toString(this._raw);
  },

  toString: function() {
    return this._toString(this._normal);
  },

  _toString: function(uri) {
    var header, parameter, idx, uriString, headers = [];

    uriString  = uri.scheme + ':';
    // add slashes if it's not a sip(s) URI
    if (!uri.scheme.toLowerCase().match("^sips?$")) {
      uriString += "//";
    }
    if (uri.user) {
      uriString += SIP.Utils.escapeUser(uri.user) + '@';
    }
    uriString += uri.host;
    if (uri.port || uri.port === 0) {
      uriString += ':' + uri.port;
    }

    for (parameter in this.parameters) {
      uriString += ';' + parameter;

      if (this.parameters[parameter] !== null) {
        uriString += '='+ this.parameters[parameter];
      }
    }

    for(header in this.headers) {
      for(idx in this.headers[header]) {
        headers.push(header + '=' + this.headers[header][idx]);
      }
    }

    if (headers.length > 0) {
      uriString += '?' + headers.join('&');
    }

    return uriString;
  }
};


/**
  * Parse the given string and returns a SIP.URI instance or undefined if
  * it is an invalid URI.
  * @public
  * @param {String} uri
  */
URI.parse = function(uri) {
  uri = SIP.Grammar.parse(uri,'SIP_URI');

  if (uri !== -1) {
    return uri;
  } else {
    return undefined;
  }
};

SIP.URI = URI;
};

},{}],83:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Utils
 */

module.exports = function (SIP, environment) {
var Utils;

Utils= {

  Promise: environment.Promise,

  defer: function defer () {
    var deferred = {};
    deferred.promise = new Utils.Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  },

  promisify: function promisify (object, methodName, callbacksFirst) {
    var oldMethod = object[methodName];
    return function promisifiedMethod (arg, onSuccess, onFailure) {
      return new Utils.Promise(function (resolve, reject) {
        var oldArgs = [arg, resolve, reject];
        if (callbacksFirst) {
          oldArgs = [resolve, reject, arg];
        }
        oldMethod.apply(object, oldArgs);
      }).then(onSuccess, onFailure);
    };
  },

  augment: function (object, constructor, args, override) {
    var idx, proto;

    // Add public properties from constructor's prototype onto object
    proto = constructor.prototype;
    for (idx in proto) {
      if (override || object[idx] === undefined) {
        object[idx] = proto[idx];
      }
    }

    // Construct the object as though it were just created by constructor
    constructor.apply(object, args);
  },

  optionsOverride: function (options, winner, loser, isDeprecated, logger, defaultValue) {
    if (isDeprecated && options[loser]) {
      logger.warn(loser + ' is deprecated, please use ' + winner + ' instead');
    }

    if (options[winner] && options[loser]) {
      logger.warn(winner + ' overriding ' + loser);
    }

    options[winner] = options[winner] || options[loser] || defaultValue;
  },

  str_utf8_length: function(string) {
    return encodeURIComponent(string).replace(/%[A-F\d]{2}/g, 'U').length;
  },

  generateFakeSDP: function(body) {
    if (!body) {
      return;
    }

    var start = body.indexOf('o=');
    var end = body.indexOf('\r\n', start);

    return 'v=0\r\n' + body.slice(start, end) + '\r\ns=-\r\nt=0 0\r\nc=IN IP4 0.0.0.0';
  },

  isFunction: function(fn) {
    if (fn !== undefined) {
      return Object.prototype.toString.call(fn) === '[object Function]';
    } else {
      return false;
    }
  },

  isDecimal: function (num) {
    return !isNaN(num) && (parseFloat(num) === parseInt(num,10));
  },

  createRandomToken: function(size, base) {
    var i, r,
      token = '';

    base = base || 32;

    for( i=0; i < size; i++ ) {
      r = Math.random() * base|0;
      token += r.toString(base);
    }

    return token;
  },

  newTag: function() {
    return SIP.Utils.createRandomToken(SIP.UA.C.TAG_LENGTH);
  },

  // http://stackoverflow.com/users/109538/broofa
  newUUID: function() {
    var UUID =  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });

    return UUID;
  },

  hostType: function(host) {
    if (!host) {
      return;
    } else {
      host = SIP.Grammar.parse(host,'host');
      if (host !== -1) {
        return host.host_type;
      }
    }
  },

  /**
  * Normalize SIP URI.
  * NOTE: It does not allow a SIP URI without username.
  * Accepts 'sip', 'sips' and 'tel' URIs and convert them into 'sip'.
  * Detects the domain part (if given) and properly hex-escapes the user portion.
  * If the user portion has only 'tel' number symbols the user portion is clean of 'tel' visual separators.
  * @private
  * @param {String} target
  * @param {String} [domain]
  */
  normalizeTarget: function(target, domain) {
    var uri, target_array, target_user, target_domain;

    // If no target is given then raise an error.
    if (!target) {
      return;
    // If a SIP.URI instance is given then return it.
    } else if (target instanceof SIP.URI) {
      return target;

    // If a string is given split it by '@':
    // - Last fragment is the desired domain.
    // - Otherwise append the given domain argument.
    } else if (typeof target === 'string') {
      target_array = target.split('@');

      switch(target_array.length) {
        case 1:
          if (!domain) {
            return;
          }
          target_user = target;
          target_domain = domain;
          break;
        case 2:
          target_user = target_array[0];
          target_domain = target_array[1];
          break;
        default:
          target_user = target_array.slice(0, target_array.length-1).join('@');
          target_domain = target_array[target_array.length-1];
      }

      // Remove the URI scheme (if present).
      target_user = target_user.replace(/^(sips?|tel):/i, '');

      // Remove 'tel' visual separators if the user portion just contains 'tel' number symbols.
      if (/^[\-\.\(\)]*\+?[0-9\-\.\(\)]+$/.test(target_user)) {
        target_user = target_user.replace(/[\-\.\(\)]/g, '');
      }

      // Build the complete SIP URI.
      target = SIP.C.SIP + ':' + SIP.Utils.escapeUser(target_user) + '@' + target_domain;

      // Finally parse the resulting URI.
      if (uri = SIP.URI.parse(target)) {
        return uri;
      } else {
        return;
      }
    } else {
      return;
    }
  },

  /**
  * Hex-escape a SIP URI user.
  * @private
  * @param {String} user
  */
  escapeUser: function(user) {
    // Don't hex-escape ':' (%3A), '+' (%2B), '?' (%3F"), '/' (%2F).
    return encodeURIComponent(decodeURIComponent(user)).replace(/%3A/ig, ':').replace(/%2B/ig, '+').replace(/%3F/ig, '?').replace(/%2F/ig, '/');
  },

  headerize: function(string) {
    var exceptions = {
      'Call-Id': 'Call-ID',
      'Cseq': 'CSeq',
      'Min-Se': 'Min-SE',
      'Rack': 'RAck',
      'Rseq': 'RSeq',
      'Www-Authenticate': 'WWW-Authenticate'
      },
      name = string.toLowerCase().replace(/_/g,'-').split('-'),
      hname = '',
      parts = name.length, part;

    for (part = 0; part < parts; part++) {
      if (part !== 0) {
        hname +='-';
      }
      hname += name[part].charAt(0).toUpperCase()+name[part].substring(1);
    }
    if (exceptions[hname]) {
      hname = exceptions[hname];
    }
    return hname;
  },

  sipErrorCause: function(status_code) {
    var cause;

    for (cause in SIP.C.SIP_ERROR_CAUSES) {
      if (SIP.C.SIP_ERROR_CAUSES[cause].indexOf(status_code) !== -1) {
        return SIP.C.causes[cause];
      }
    }

    return SIP.C.causes.SIP_FAILURE_CODE;
  },

  getReasonPhrase: function getReasonPhrase (code, specific) {
    return specific || SIP.C.REASON_PHRASE[code] || '';
  },

  getReasonHeaderValue: function getReasonHeaderValue (code, reason) {
    reason = SIP.Utils.getReasonPhrase(code, reason);
    return 'SIP ;cause=' + code + ' ;text="' + reason + '"';
  },

  getCancelReason: function getCancelReason (code, reason) {
    if (code && code < 200 || code > 699) {
      throw new TypeError('Invalid status_code: ' + code);
    } else if (code) {
      return SIP.Utils.getReasonHeaderValue(code, reason);
    }
  },

  buildStatusLine: function buildStatusLine (code, reason) {
    code = code || null;
    reason = reason || null;

    // Validate code and reason values
    if (!code || (code < 100 || code > 699)) {
      throw new TypeError('Invalid status_code: '+ code);
    } else if (reason && typeof reason !== 'string' && !(reason instanceof String)) {
      throw new TypeError('Invalid reason_phrase: '+ reason);
    }

    reason = Utils.getReasonPhrase(code, reason);

    return 'SIP/2.0 ' + code + ' ' + reason + '\r\n';
  },

  /**
  * Generate a random Test-Net IP (http://tools.ietf.org/html/rfc5735)
  * @private
  */
  getRandomTestNetIP: function() {
    function getOctet(from,to) {
      return Math.floor(Math.random()*(to-from+1)+from);
    }
    return '192.0.2.' + getOctet(1, 254);
  },

  getAllowedMethods: function(ua) {
    var event,
      allowed = SIP.UA.C.ALLOWED_METHODS.toString();

    for (event in SIP.UA.C.EVENT_METHODS) {
      if (ua.listeners(event).length) {
        allowed += ','+ SIP.UA.C.EVENT_METHODS[event];
      }
    }

    return allowed;
  },

  // MD5 (Message-Digest Algorithm) http://www.webtoolkit.info
  calculateMD5: function(string) {
    function RotateLeft(lValue, iShiftBits) {
      return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }

    function AddUnsigned(lX,lY) {
      var lX4,lY4,lX8,lY8,lResult;
      lX8 = (lX & 0x80000000);
      lY8 = (lY & 0x80000000);
      lX4 = (lX & 0x40000000);
      lY4 = (lY & 0x40000000);
      lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
      if (lX4 & lY4) {
        return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      }
      if (lX4 | lY4) {
        if (lResult & 0x40000000) {
          return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        } else {
          return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        }
      } else {
        return (lResult ^ lX8 ^ lY8);
      }
    }

    function F(x,y,z) {
      return (x & y) | ((~x) & z);
    }

    function G(x,y,z) {
      return (x & z) | (y & (~z));
    }

    function H(x,y,z) {
      return (x ^ y ^ z);
    }

    function I(x,y,z) {
      return (y ^ (x | (~z)));
    }

    function FF(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function GG(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function HH(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function II(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function ConvertToWordArray(string) {
      var lWordCount;
      var lMessageLength = string.length;
      var lNumberOfWords_temp1=lMessageLength + 8;
      var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
      var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
      var lWordArray=Array(lNumberOfWords-1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while ( lByteCount < lMessageLength ) {
        lWordCount = (lByteCount-(lByteCount % 4))/4;
        lBytePosition = (lByteCount % 4)*8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
      lWordArray[lNumberOfWords-2] = lMessageLength<<3;
      lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
      return lWordArray;
    }

    function WordToHex(lValue) {
      var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
      for (lCount = 0;lCount<=3;lCount++) {
        lByte = (lValue>>>(lCount*8)) & 255;
        WordToHexValue_temp = "0" + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
      }
      return WordToHexValue;
    }

    function Utf8Encode(string) {
      string = string.replace(/\r\n/g,"\n");
      var utftext = "";

      for (var n = 0; n < string.length; n++) {
        var c = string.charCodeAt(n);

        if (c < 128) {
          utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    }

    var x=[];
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;

    string = Utf8Encode(string);

    x = ConvertToWordArray(string);

    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

    for (k=0;k<x.length;k+=16) {
      AA=a; BB=b; CC=c; DD=d;
      a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
      d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
      c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
      b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
      a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
      d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
      c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
      b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
      a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
      d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
      c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
      b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
      a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
      d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
      c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
      b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
      a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
      d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
      c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
      b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
      a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
      d=GG(d,a,b,c,x[k+10],S22,0x2441453);
      c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
      b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
      a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
      d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
      c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
      b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
      a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
      d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
      c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
      b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
      a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
      d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
      c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
      b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
      a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
      d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
      c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
      b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
      a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
      d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
      c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
      b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
      a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
      d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
      c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
      b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
      a=II(a,b,c,d,x[k+0], S41,0xF4292244);
      d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
      c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
      b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
      a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
      d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
      c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
      b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
      a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
      d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
      c=II(c,d,a,b,x[k+6], S43,0xA3014314);
      b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
      a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
      d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
      c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
      b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
      a=AddUnsigned(a,AA);
      b=AddUnsigned(b,BB);
      c=AddUnsigned(c,CC);
      d=AddUnsigned(d,DD);
    }

    var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);

    return temp.toLowerCase();
  }
};

SIP.Utils = Utils;
};

},{}],84:[function(require,module,exports){
"use strict";
/**
 * @fileoverview WebRTC
 */

module.exports = function (SIP, environment) {
var WebRTC;

WebRTC = {};

WebRTC.MediaHandler = require('./WebRTC/MediaHandler')(SIP);
WebRTC.MediaStreamManager = require('./WebRTC/MediaStreamManager')(SIP, environment);

var _isSupported;

WebRTC.isSupported = function () {
  if (_isSupported !== undefined) {
    return _isSupported;
  }

  WebRTC.MediaStream = environment.MediaStream;
  WebRTC.getUserMedia = environment.getUserMedia;
  WebRTC.RTCPeerConnection = environment.RTCPeerConnection;
  WebRTC.RTCSessionDescription = environment.RTCSessionDescription;

  if (WebRTC.RTCPeerConnection && WebRTC.RTCSessionDescription) {
    if (WebRTC.getUserMedia) {
      WebRTC.getUserMedia = SIP.Utils.promisify(environment, 'getUserMedia');
    }
    _isSupported = true;
  }
  else {
    _isSupported = false;
  }
  return _isSupported;
};

return WebRTC;
};

},{"./WebRTC/MediaHandler":85,"./WebRTC/MediaStreamManager":86}],85:[function(require,module,exports){
"use strict";
/**
 * @fileoverview MediaHandler
 */

/* MediaHandler
 * @class PeerConnection helper Class.
 * @param {SIP.Session} session
 * @param {Object} [options]
 * @param {SIP.WebRTC.MediaStreamManager} [options.mediaStreamManager]
 *        The MediaStreamManager to acquire/release streams from/to.
 *        If not provided, a default MediaStreamManager will be used.
 */
module.exports = function (SIP) {

var MediaHandler = function(session, options) {
  options = options || {};

  this.logger = session.ua.getLogger('sip.invitecontext.mediahandler', session.id);
  this.session = session;
  this.localMedia = null;
  this.ready = true;
  this.mediaStreamManager = options.mediaStreamManager || new SIP.WebRTC.MediaStreamManager(this.logger);
  this.audioMuted = false;
  this.videoMuted = false;
  this.onhold = false;

  // old init() from here on
  var idx, jdx, length, server,
    self = this,
    servers = [],
    stunServers = options.stunServers || null,
    turnServers = options.turnServers || null,
    config = this.session.ua.configuration;
  this.RTCConstraints = options.RTCConstraints || {};

  if (!stunServers) {
    stunServers = config.stunServers;
  }

  if(!turnServers) {
    turnServers = config.turnServers;
  }

  /* Change 'url' to 'urls' whenever this issue is solved:
   * https://code.google.com/p/webrtc/issues/detail?id=2096
   */
  [].concat(stunServers).forEach(function (server) {
    servers.push({'url': server});
  });

  length = turnServers.length;
  for (idx = 0; idx < length; idx++) {
    server = turnServers[idx];
    for (jdx = 0; jdx < server.urls.length; jdx++) {
      servers.push({
        'url': server.urls[jdx],
        'username': server.username,
        'credential': server.password
      });
    }
  }

  this.onIceCompleted = SIP.Utils.defer();
  this.onIceCompleted.promise.then(function(pc) {
    self.emit('iceGatheringComplete', pc);
    if (self.iceCheckingTimer) {
      SIP.Timers.clearTimeout(self.iceCheckingTimer);
      self.iceCheckingTimer = null;
    }
  });

  this.peerConnection = new SIP.WebRTC.RTCPeerConnection({'iceServers': servers}, this.RTCConstraints);

  // Firefox (35.0.1) sometimes throws on calls to peerConnection.getRemoteStreams
  // even if peerConnection.onaddstream was just called. In order to make
  // MediaHandler.prototype.getRemoteStreams work, keep track of them manually
  this._remoteStreams = [];

  this.peerConnection.onaddstream = function(e) {
    self.logger.log('stream added: '+ e.stream.id);
    self._remoteStreams.push(e.stream);
    self.render();
    self.emit('addStream', e);
  };

  this.peerConnection.onremovestream = function(e) {
    self.logger.log('stream removed: '+ e.stream.id);
  };

  this.startIceCheckingTimer = function () {
    if (!self.iceCheckingTimer) {
      self.iceCheckingTimer = SIP.Timers.setTimeout(function() {
        self.logger.log('RTCIceChecking Timeout Triggered after '+config.iceCheckingTimeout+' milliseconds');
        self.onIceCompleted.resolve(this);
      }.bind(this.peerConnection), config.iceCheckingTimeout);
    }
  };

  this.peerConnection.onicecandidate = function(e) {
    self.emit('iceCandidate', e);
    if (e.candidate) {
      self.logger.log('ICE candidate received: '+ (e.candidate.candidate === null ? null : e.candidate.candidate.trim()));
      self.startIceCheckingTimer();
    } else {
      self.onIceCompleted.resolve(this);
    }
  };

  this.peerConnection.onicegatheringstatechange = function () {
    self.logger.log('RTCIceGatheringState changed: ' + this.iceGatheringState);
    if (this.iceGatheringState === 'gathering') {
      self.emit('iceGathering', this);
    }
    if (this.iceGatheringState === 'complete') {
      self.onIceCompleted.resolve(this);
    }
  };

  this.peerConnection.oniceconnectionstatechange = function() {  //need e for commented out case
    var stateEvent;

    if (this.iceConnectionState === 'checking') {
      self.startIceCheckingTimer();
    }


    switch (this.iceConnectionState) {
    case 'new':
      stateEvent = 'iceConnection';
      break;
    case 'checking':
      stateEvent = 'iceConnectionChecking';
      break;
    case 'connected':
      stateEvent = 'iceConnectionConnected';
      break;
    case 'completed':
      stateEvent = 'iceConnectionCompleted';
      break;
    case 'failed':
      stateEvent = 'iceConnectionFailed';
      break;
    case 'disconnected':
      stateEvent = 'iceConnectionDisconnected';
      break;
    case 'closed':
      stateEvent = 'iceConnectionClosed';
      break;
    default:
      self.logger.warn('Unknown iceConnection state:', this.iceConnectionState);
      return;
    }
    self.emit(stateEvent, this);

    //Bria state changes are always connected -> disconnected -> connected on accept, so session gets terminated
    //normal calls switch from failed to connected in some cases, so checking for failed and terminated
    /*if (this.iceConnectionState === 'failed') {
      self.session.terminate({
        cause: SIP.C.causes.RTP_TIMEOUT,
        status_code: 200,
        reason_phrase: SIP.C.causes.RTP_TIMEOUT
      });
    } else if (e.currentTarget.iceGatheringState === 'complete' && this.iceConnectionState !== 'closed') {
      self.onIceCompleted(this);
    }*/
  };

  this.peerConnection.onstatechange = function() {
    self.logger.log('PeerConnection state changed to "'+ this.readyState +'"');
  };

  function selfEmit(mh, event) {
    if (mh.mediaStreamManager.on) {
      mh.mediaStreamManager.on(event, function () {
        mh.emit.apply(mh, [event].concat(Array.prototype.slice.call(arguments)));
      });
    }
  }

  selfEmit(this, 'userMediaRequest');
  selfEmit(this, 'userMedia');
  selfEmit(this, 'userMediaFailed');
};

MediaHandler.defaultFactory = function defaultFactory (session, options) {
  return new MediaHandler(session, options);
};
MediaHandler.defaultFactory.isSupported = function () {
  return SIP.WebRTC.isSupported();
};

MediaHandler.prototype = Object.create(SIP.MediaHandler.prototype, {
// Functions the session can use
  isReady: {writable: true, value: function isReady () {
    return this.ready;
  }},

  close: {writable: true, value: function close () {
    this.logger.log('closing PeerConnection');
    this._remoteStreams = [];
    // have to check signalingState since this.close() gets called multiple times
    // TODO figure out why that happens
    if(this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      this.peerConnection.close();

      if(this.localMedia) {
        this.mediaStreamManager.release(this.localMedia);
      }
    }
  }},

  /**
   * @param {SIP.WebRTC.MediaStream | (getUserMedia constraints)} [mediaHint]
   *        the MediaStream (or the constraints describing it) to be used for the session
   */
  getDescription: {writable: true, value: function getDescription (mediaHint) {
    var self = this;
    var acquire = self.mediaStreamManager.acquire;
    if (acquire.length > 1) {
      acquire = SIP.Utils.promisify(this.mediaStreamManager, 'acquire', true);
    }
    mediaHint = mediaHint || {};
    if (mediaHint.dataChannel === true) {
      mediaHint.dataChannel = {};
    }
    this.mediaHint = mediaHint;

    /*
     * 1. acquire streams (skip if MediaStreams passed in)
     * 2. addStreams
     * 3. createOffer/createAnswer
     */

    var streamPromise;
    if (self.localMedia) {
      self.logger.log('already have local media');
      streamPromise = SIP.Utils.Promise.resolve(self.localMedia);
    }
    else {
      self.logger.log('acquiring local media');
      streamPromise = acquire.call(self.mediaStreamManager, mediaHint)
        .then(function acquireSucceeded(streams) {
          self.logger.log('acquired local media streams');
          self.localMedia = streams;
          self.session.connecting();
          return streams;
        }, function acquireFailed(err) {
          self.logger.error('unable to acquire streams');
          self.logger.error(err);
          self.session.connecting();
          throw err;
        })
        .then(this.addStreams.bind(this))
      ;
    }

    return streamPromise
      .then(function streamAdditionSucceeded() {
        if (self.hasOffer('remote')) {
          self.peerConnection.ondatachannel = function (evt) {
            self.dataChannel = evt.channel;
            self.emit('dataChannel', self.dataChannel);
          };
        } else if (mediaHint.dataChannel &&
                   self.peerConnection.createDataChannel) {
          self.dataChannel = self.peerConnection.createDataChannel(
            'sipjs',
            mediaHint.dataChannel
          );
          self.emit('dataChannel', self.dataChannel);
        }

        self.render();
        return self.createOfferOrAnswer(self.RTCConstraints);
      })
      .then(function(sdp) {
        sdp = SIP.Hacks.Firefox.hasMissingCLineInSDP(sdp);

        if (self.onhold) {
          // Don't receive media
          // TODO - This will break for media streams with different directions.
          if (!(/a=(sendrecv|sendonly|recvonly|inactive)/).test(sdp)) {
            sdp = sdp.replace(/(m=[^\r]*\r\n)/g, '$1a=sendonly\r\n');
          } else {
            sdp = sdp.replace(/a=sendrecv\r\n/g, 'a=sendonly\r\n');
            sdp = sdp.replace(/a=recvonly\r\n/g, 'a=inactive\r\n');
          }
        }

        return {
          extraHeaders: ['Content-Type: application/sdp'],
          body: sdp,
        };
      })
    ;
  }},

  /**
   * Check if a SIP message contains a session description.
   * @param {SIP.SIPMessage} message
   * @returns {boolean}
   */
  hasDescription: {writeable: true, value: function hasDescription (message) {
    return message.getHeader('Content-Type') === 'application/sdp' && !!message.body;
  }},

  /**
   * Set the session description contained in a SIP message.
   * @param {SIP.SIPMessage} message
   * @returns {Promise}
   */
  setDescription: {writable: true, value: function setDescription (message) {
    var sdp = message.body;

    sdp = SIP.Hacks.Firefox.cannotHandleExtraWhitespace(sdp);
    sdp = SIP.Hacks.AllBrowsers.maskDtls(sdp);

    var rawDescription = {
      type: this.hasOffer('local') ? 'answer' : 'offer',
      sdp: sdp
    };

    this.emit('setDescription', rawDescription);

    var description = new SIP.WebRTC.RTCSessionDescription(rawDescription);
    return SIP.Utils.promisify(this.peerConnection, 'setRemoteDescription')(description);
  }},

  /**
   * If the Session associated with this MediaHandler were to be referred,
   * what mediaHint should be provided to the UA's invite method?
   */
  getReferMedia: {writable: true, value: function getReferMedia () {
    function hasTracks (trackGetter, stream) {
      return stream[trackGetter]().length > 0;
    }

    function bothHaveTracks (trackGetter) {
      /* jshint validthis:true */
      return this.getLocalStreams().some(hasTracks.bind(null, trackGetter)) &&
             this.getRemoteStreams().some(hasTracks.bind(null, trackGetter));
    }

    return {
      constraints: {
        audio: bothHaveTracks.call(this, 'getAudioTracks'),
        video: bothHaveTracks.call(this, 'getVideoTracks')
      }
    };
  }},

// Functions the session can use, but only because it's convenient for the application
  isMuted: {writable: true, value: function isMuted () {
    return {
      audio: this.audioMuted,
      video: this.videoMuted
    };
  }},

  mute: {writable: true, value: function mute (options) {
    if (this.getLocalStreams().length === 0) {
      return;
    }

    options = options || {
      audio: this.getLocalStreams()[0].getAudioTracks().length > 0,
      video: this.getLocalStreams()[0].getVideoTracks().length > 0
    };

    var audioMuted = false,
        videoMuted = false;

    if (options.audio && !this.audioMuted) {
      audioMuted = true;
      this.audioMuted = true;
      this.toggleMuteAudio(true);
    }

    if (options.video && !this.videoMuted) {
      videoMuted = true;
      this.videoMuted = true;
      this.toggleMuteVideo(true);
    }

    //REVISIT
    if (audioMuted || videoMuted) {
      return {
        audio: audioMuted,
        video: videoMuted
      };
      /*this.session.onmute({
        audio: audioMuted,
        video: videoMuted
      });*/
    }
  }},

  unmute: {writable: true, value: function unmute (options) {
    if (this.getLocalStreams().length === 0) {
      return;
    }

    options = options || {
      audio: this.getLocalStreams()[0].getAudioTracks().length > 0,
      video: this.getLocalStreams()[0].getVideoTracks().length > 0
    };

    var audioUnMuted = false,
        videoUnMuted = false;

    if (options.audio && this.audioMuted) {
      audioUnMuted = true;
      this.audioMuted = false;
      this.toggleMuteAudio(false);
    }

    if (options.video && this.videoMuted) {
      videoUnMuted = true;
      this.videoMuted = false;
      this.toggleMuteVideo(false);
    }

    //REVISIT
    if (audioUnMuted || videoUnMuted) {
      return {
        audio: audioUnMuted,
        video: videoUnMuted
      };
      /*this.session.onunmute({
        audio: audioUnMuted,
        video: videoUnMuted
      });*/
    }
  }},

  hold: {writable: true, value: function hold () {
    this.onhold = true;
    this.toggleMuteAudio(true);
    this.toggleMuteVideo(true);
  }},

  unhold: {writable: true, value: function unhold () {
    this.onhold = false;

    if (!this.audioMuted) {
      this.toggleMuteAudio(false);
    }

    if (!this.videoMuted) {
      this.toggleMuteVideo(false);
    }
  }},

// Functions the application can use, but not the session
  getLocalStreams: {writable: true, value: function getLocalStreams () {
    var pc = this.peerConnection;
    if (pc && pc.signalingState === 'closed') {
      this.logger.warn('peerConnection is closed, getLocalStreams returning []');
      return [];
    }
    return (pc.getLocalStreams && pc.getLocalStreams()) ||
      pc.localStreams || [];
  }},

  getRemoteStreams: {writable: true, value: function getRemoteStreams () {
    var pc = this.peerConnection;
    if (pc && pc.signalingState === 'closed') {
      this.logger.warn('peerConnection is closed, getRemoteStreams returning this._remoteStreams');
      return this._remoteStreams;
    }
    return(pc.getRemoteStreams && pc.getRemoteStreams()) ||
      pc.remoteStreams || [];
  }},

  render: {writable: true, value: function render (renderHint) {
    renderHint = renderHint || (this.mediaHint && this.mediaHint.render);
    if (!renderHint) {
      return false;
    }
    var streamGetters = {
      local: 'getLocalStreams',
      remote: 'getRemoteStreams'
    };
    Object.keys(streamGetters).forEach(function (loc) {
      var streamGetter = streamGetters[loc];
      var streams = this[streamGetter]();
      SIP.WebRTC.MediaStreamManager.render(streams, renderHint[loc]);
    }.bind(this));
  }},

// Internal functions
  hasOffer: {writable: true, value: function hasOffer (where) {
    var offerState = 'have-' + where + '-offer';
    return this.peerConnection.signalingState === offerState;
    // TODO consider signalingStates with 'pranswer'?
  }},

  createOfferOrAnswer: {writable: true, value: function createOfferOrAnswer (constraints) {
    var self = this;
    var methodName;
    var pc = self.peerConnection;

    self.ready = false;
    methodName = self.hasOffer('remote') ? 'createAnswer' : 'createOffer';

    return SIP.Utils.promisify(pc, methodName, true)(constraints)
      .then(SIP.Utils.promisify(pc, 'setLocalDescription'))
      .then(function onSetLocalDescriptionSuccess() {
        var deferred = SIP.Utils.defer();
        if (pc.iceConnectionState === 'complete' || pc.iceConnectionState === 'completed') {
          deferred.resolve();
        } else {
          self.onIceCompleted.promise.then(deferred.resolve);
        }
        return deferred.promise;
      })
      .then(function readySuccess () {
        var sdp = pc.localDescription.sdp;

        sdp = SIP.Hacks.Chrome.needsExplicitlyInactiveSDP(sdp);
        sdp = SIP.Hacks.AllBrowsers.unmaskDtls(sdp);
        sdp = SIP.Hacks.Firefox.hasIncompatibleCLineWithSomeSIPEndpoints(sdp);

        var sdpWrapper = {
          type: methodName === 'createOffer' ? 'offer' : 'answer',
          sdp: sdp
        };

        self.emit('getDescription', sdpWrapper);

        self.ready = true;
        return sdpWrapper.sdp;
      })
      .catch(function methodFailed (e) {
        self.logger.error(e);
        self.ready = true;
        throw new SIP.Exceptions.GetDescriptionError(e);
      })
    ;
  }},

  addStreams: {writable: true, value: function addStreams (streams) {
    try {
      streams = [].concat(streams);
      streams.forEach(function (stream) {
        this.peerConnection.addStream(stream);
      }, this);
    } catch(e) {
      this.logger.error('error adding stream');
      this.logger.error(e);
      return SIP.Utils.Promise.reject(e);
    }

    return SIP.Utils.Promise.resolve();
  }},

  toggleMuteHelper: {writable: true, value: function toggleMuteHelper (trackGetter, mute) {
    this.getLocalStreams().forEach(function (stream) {
      stream[trackGetter]().forEach(function (track) {
        track.enabled = !mute;
      });
    });
  }},

  toggleMuteAudio: {writable: true, value: function toggleMuteAudio (mute) {
    this.toggleMuteHelper('getAudioTracks', mute);
  }},

  toggleMuteVideo: {writable: true, value: function toggleMuteVideo (mute) {
    this.toggleMuteHelper('getVideoTracks', mute);
  }}
});

// Return since it will be assigned to a variable.
return MediaHandler;
};

},{}],86:[function(require,module,exports){
"use strict";
/**
 * @fileoverview MediaStreamManager
 */

/* MediaStreamManager
 * @class Manages the acquisition and release of MediaStreams.
 * @param {mediaHint} [defaultMediaHint] The mediaHint to use if none is provided to acquire()
 */
module.exports = function (SIP, environment) {

// Default MediaStreamManager provides single-use streams created with getUserMedia
var MediaStreamManager = function MediaStreamManager (logger, defaultMediaHint) {
  if (!SIP.WebRTC.isSupported()) {
    throw new SIP.Exceptions.NotSupportedError('Media not supported');
  }

  this.mediaHint = defaultMediaHint || {
    constraints: {audio: true, video: true}
  };

  // map of streams to acquisition manner:
  // true -> passed in as mediaHint.stream
  // false -> getUserMedia
  this.acquisitions = {};
};
MediaStreamManager.streamId = function (stream) {
  return stream.getAudioTracks().concat(stream.getVideoTracks())
    .map(function trackId (track) {
      return track.id;
    })
    .join('');
};

/**
 * @param {(Array of) MediaStream} streams - The streams to render
 *
 * @param {(Array of) HTMLMediaElement} elements
 *        - The <audio>/<video> element(s) that should render the streams
 *
 * Each stream in streams renders to the corresponding element in elements,
 * wrapping around elements if needed.
 */
MediaStreamManager.render = function render (streams, elements) {
  if (!elements) {
    return false;
  }
  if (Array.isArray(elements) && !elements.length) {
    throw new TypeError('elements must not be empty');
  }

  function attachAndPlay (elements, stream, index) {
    if (typeof elements === 'function') {
      elements = elements();
    }
    var element = elements[index % elements.length];
    (environment.attachMediaStream || attachMediaStream)(element, stream);
    ensureMediaPlaying(element);
  }

  function attachMediaStream(element, stream) {
    if (typeof element.src !== 'undefined') {
      environment.revokeObjectURL(element.src);
      element.src = environment.createObjectURL(stream);
    } else if (typeof (element.srcObject || element.mozSrcObject) !== 'undefined') {
      element.srcObject = element.mozSrcObject = stream;
    } else {
      return false;
    }

    return true;
  }

  function ensureMediaPlaying (mediaElement) {
    var interval = 100;
    mediaElement.ensurePlayingIntervalId = SIP.Timers.setInterval(function () {
      if (mediaElement.paused) {
        mediaElement.play();
      }
      else {
        SIP.Timers.clearInterval(mediaElement.ensurePlayingIntervalId);
      }
    }, interval);
  }

  // [].concat "casts" `elements` into an array
  // so forEach works even if `elements` was a single element
  elements = [].concat(elements);
  [].concat(streams).forEach(attachAndPlay.bind(null, elements));
};

MediaStreamManager.prototype = Object.create(SIP.EventEmitter.prototype, {
  'acquire': {writable: true, value: function acquire (mediaHint) {
    mediaHint = Object.keys(mediaHint || {}).length ? mediaHint : this.mediaHint;

    var saveSuccess = function (isHintStream, streams) {
      streams = [].concat(streams);
      streams.forEach(function (stream) {
        var streamId = MediaStreamManager.streamId(stream);
        this.acquisitions[streamId] = !!isHintStream;
      }, this);
      return SIP.Utils.Promise.resolve(streams);
    }.bind(this);

    if (mediaHint.stream) {
      return saveSuccess(true, mediaHint.stream);
    } else {
      // Fallback to audio/video enabled if no mediaHint can be found.
      var constraints = mediaHint.constraints ||
        (this.mediaHint && this.mediaHint.constraints) ||
        {audio: true, video: true};

      var deferred = SIP.Utils.defer();

      /*
       * Make the call asynchronous, so that ICCs have a chance
       * to define callbacks to `userMediaRequest`
       */
      SIP.Timers.setTimeout(function () {
        this.emit('userMediaRequest', constraints);

        var emitThenCall = function (eventName, callback) {
          var callbackArgs = Array.prototype.slice.call(arguments, 2);
          // Emit with all of the arguments from the real callback.
          var newArgs = [eventName].concat(callbackArgs);

          this.emit.apply(this, newArgs);

          return callback.apply(null, callbackArgs);
        }.bind(this);

        deferred.resolve(
          SIP.WebRTC.getUserMedia(constraints)
          .then(
            emitThenCall.bind(this, 'userMedia', saveSuccess.bind(null, false)),
            emitThenCall.bind(this, 'userMediaFailed', function(e){throw e;})
          )
        );
      }.bind(this), 0);

      return deferred.promise;
    }
  }},

  'release': {writable: true, value: function release (streams) {
    streams = [].concat(streams);
    streams.forEach(function (stream) {
      var streamId = MediaStreamManager.streamId(stream);
      if (this.acquisitions[streamId] === false) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
      }
      delete this.acquisitions[streamId];
    }, this);
  }},
});

// Return since it will be assigned to a variable.
return MediaStreamManager;
};

},{}],87:[function(require,module,exports){
(function (global){
"use strict";

var toplevel = global.window || global;

function getPrefixedProperty (object, name) {
  if (object == null) {
    return;
  }
  var capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
  var prefixedNames = [name, 'webkit' + capitalizedName, 'moz' + capitalizedName];
  for (var i in prefixedNames) {
    var property = object[prefixedNames[i]];
    if (property) {
      return property.bind(object);
    }
  }
}

module.exports = {
  WebSocket: toplevel.WebSocket,
  Transport: require('./Transport'),
  open: toplevel.open,
  Promise: toplevel.Promise,
  timers: toplevel,

  // Console is not defined in ECMAScript, so just in case...
  console: toplevel.console || {
    debug: function () {},
    log: function () {},
    warn: function () {},
    error: function () {}
  },

  MediaStream: getPrefixedProperty(toplevel, 'MediaStream'),
  getUserMedia: getPrefixedProperty(toplevel.navigator, 'getUserMedia'),
  RTCPeerConnection: getPrefixedProperty(toplevel, 'RTCPeerConnection'),
  RTCSessionDescription: getPrefixedProperty(toplevel, 'RTCSessionDescription'),

  addEventListener: getPrefixedProperty(toplevel, 'addEventListener'),
  HTMLMediaElement: toplevel.HTMLMediaElement,

  attachMediaStream: toplevel.attachMediaStream,
  createObjectURL: toplevel.URL && toplevel.URL.createObjectURL,
  revokeObjectURL: toplevel.URL && toplevel.URL.revokeObjectURL
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Transport":80}],88:[function(require,module,exports){
"use strict";
module.exports = require('./SIP')(require('./environment'));

},{"./SIP":71,"./environment":87}],89:[function(require,module,exports){
module.exports={
  "name": "twilio-conversations",
  "title": "Twilio Conversations",
  "description": "Twilio Conversations JavaScript library",
  "version": "0.13.2",
  "homepage": "https://twilio.com",
  "author": "Mark Andrus Roberts <mroberts@twilio.com>",
  "contributors": [
    "Ryan Rowland <rrowland@twilio.com>"
  ],
  "keywords": [
    "twilio",
    "webrtc",
    "library",
    "javascript",
    "conversations"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/twilio/twilio-conversations.git"
  },
  "devDependencies": {
    "browserify": "^9.0.3",
    "cheerio": "^0.18.0",
    "del": "^2.0.2",
    "eslint": "^1.8.0",
    "gulp": "^3.9.0",
    "gulp-insert": "^0.5.0",
    "gulp-newer": "^1.0.0",
    "gulp-rename": "^1.2.2",
    "gulp-replace": "^0.5.4",
    "gulp-uglify": "^1.4.2",
    "gulp-util": "^3.0.7",
    "istanbul": "^0.3.15",
    "jsdoc": "https://github.com/jsdoc3/jsdoc.git#e2fd9e75de9617aadfc3120331f020b2d66cff86",
    "jshint": "^2.6.3",
    "jshint-stylish": "^1.0.0",
    "jsonwebtoken": "^5.0.0",
    "mkdirp": "^0.5.1",
    "mocha": "^2.2.5",
    "promptly": "^0.2.0",
    "release-tool": "^0.2.2",
    "run-sequence": "^1.1.4",
    "sinon": "^1.15.3",
    "stream-from-promise": "^0.1.0",
    "through2": "^2.0.0",
    "twilio": "^2.3.0",
    "vinyl-source-stream": "^1.1.0"
  },
  "engines": {
    "node": ">=0.12"
  },
  "license": "BSD-3-Clause",
  "main": "./lib/index.js",
  "scripts": {
    "test": "gulp test",
    "postinstall": "node scripts/postinstall.js"
  },
  "dependencies": {
    "sip.js": "https://github.com/twilio/SIP.js.git#4e74f060191cdc8657737fdc7947af5eff871a4b",
    "twilio-common": "^0.1.4",
    "ws": "^0.6.3",
    "xmlhttprequest": "^1.8.0"
  },
  "browser": {
    "twilio-common": "./src/twilio-common.js",
    "xmlhttprequest": "./src/xmlhttprequest.js"
  }
}

},{}],90:[function(require,module,exports){
module.exports = window.Twilio;

},{}],91:[function(require,module,exports){
exports.XMLHttpRequest = window.XMLHttpRequest;

},{}]},{},[1]);
return bundle(id)})();
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Conversations; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Conversations = Twilio.Conversations || Conversations;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
