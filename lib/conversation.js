'use strict';

var constants = require('./util/constants');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('./util/log');
var Participant = require('./participant');

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
 * @param {ConversationImpl} impl
 * @param {?object} [options={}]
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
function Conversation(impl, options) {
  if (!(this instanceof Conversation)) {
    return new Conversation(impl, options);
  }
  EventEmitter.call(this);

  options = Object.assign({
    logLevel: constants.DEFAULT_LOG_LEVEL
  }, options);

  var log = new Log('Conversation', options.logLevel);
  var participants = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _impl: {
      value: impl
    },
    _log: {
      value: log
    },
    _options: {
      value: options
    },
    _participants: {
      value: participants
    },
    localMedia: {
      enumerable: true,
      value: impl.localMedia
    },
    participants: {
      enumerable: true,
      get: function() {
        return new Map(participants);
      }
    },
    sid: {
      enumerable: true,
      value: impl.sid
    }
  });

  handleImplEvents(this, impl);
}

inherits(Conversation, EventEmitter);

/**
 * Disconnect from the {@link Conversation}.
 * @returns {this}
 */
Conversation.prototype.disconnect = function disconnect() {
  if (this._options.shouldStopLocalMedia) {
    this.localMedia.stop();
  }
  this._impl.disconnect();
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
Conversation.prototype.invite = function invite(identityOrIdentities) {
  var identities = identityOrIdentities instanceof Array ?
    identityOrIdentities : [identityOrIdentities];
  identities.forEach(function(identity) {
    this._impl.invite(identity);
  }, this);
  return this;
};

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

function handleImplEvents(conversation, impl) {
  // Reemit Participant events from the ConversationImpl.
  impl.on('participantConnected',
    function participantConnected(participantImpl) {
    var participant = new Participant(participantImpl);
    conversation._participants.set(participant.sid, participant);
    conversation.emit('participantConnected', participant);

    // Reemit Track events from the Participant.
    var eventListeners = [
      'trackAdded',
      'trackDimensionsChanged',
      'trackDisabled',
      'trackEnabled',
      'trackEnded',
      'trackRemoved',
      'trackStarted'
    ].map(function(event) {
      function reemit() {
        var args = [].slice.call(arguments);
        args.unshift(event);
        args.push(participant);
        conversation.emit.apply(conversation, args);
      }
      participant.on(event, reemit);
      return [event, reemit];
    });

    // Reemit state transition events from the Participant.
    participant.once('disconnected', function participantDisconnected() {
      conversation._participants.delete(participant.sid);
      eventListeners.forEach(function(args) {
        participant.removeListener(args[0], args[1]);
      });
      conversation.emit('participantDisconnected', participant);
    });
  });

  impl.on('participantFailed', function participantFailed(participantImpl) {
    var participant = new Participant(participantImpl);
    conversation.emit('participantFailed', participant);
  });

  // Reemit state transition events from the ConversationImpl.
  impl.on('stateChanged', function stateChanged(state) {
    conversation.emit(state, conversation);
  });
}

module.exports = Conversation;
