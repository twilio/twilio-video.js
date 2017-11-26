'use strict';

var inherits = require('util').inherits;
var Track = require('./');
var DefaultDataTrackSender = require('../../data/sender');
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

/**
 * Construct a {@link LocalDataTrack}.
 * @class
 * @classdesc A {@link LocalDataTrack} is a {@link Track} representing data
 *   that your {@link LocalParticipant} can publish to a {@link Room}.
 * @extends {Track}
 * @param {LocalDataTrackOptions} [options] - {@link LocalDataTrack} options
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which the {@link LocalDataTrack} will send
 *   or re-send data if not acknowledged on the underlying RTCDataChannel(s).
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the {@link LocalDataTrack} will resend data if not successfully
 *   delivered on the underlying RTCDataChannel(s).
 * @property {boolean} ordered - true if data on the {@link LocalDataTrack} is
 *   guaranteed to be sent in order.
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of times the {@link LocalDataTrack} will attempt to send
 *   data, ensuring "reliable" transmission.
 * @example
 * var Video = require('twilio-video');
 *
 * var localDataTrack = new Video.LocalDataTrack();
 * window.addEventListener('mousemove', function(event) {
 *   localDataTrack.send({
 *     x: e.clientX,
 *     y: e.clientY
 *   });
 * });
 *
 * var token1 = getAccessToken();
 * Video.connect(token1, {
 *   name: 'my-cool-room',
 *   tracks: [localDataTrack]
 * });
 *
 * var token2 = getAccessToken();
 * Video.connect(token2, {
 *   name: 'my-cool-room',
 *   tracks: []
 * }).then(function(room) {
 *   room.on('trackSubscribed', function(track) {
 *     track.on('message', function(message) {
 *       console.log(message); // { x: <number>, y: <number> }
 *     });
 *   });
 * });
 */
function LocalDataTrack(options) {
  if (!(this instanceof LocalDataTrack)) {
    return new LocalDataTrack(options);
  }

  options = Object.assign({
    DataTrackSender: DefaultDataTrackSender,
    logLevel: DEFAULT_LOG_LEVEL,
    maxPacketLifeTime: null,
    maxRetransmits: null,
    ordered: true
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);

  var DataTrackSender = options.DataTrackSender;
  var dataTrackSender = new DataTrackSender(
    options.maxPacketLifeTime,
    options.maxRetransmits,
    options.ordered);

  Track.call(this, dataTrackSender.id, 'data', options);

  Object.defineProperties(this, {
    _trackSender: {
      value: dataTrackSender
    },
    maxPacketLifeTime: {
      enumerable: true,
      value: options.maxPacketLifeTime
    },
    maxRetransmits: {
      enumerable: true,
      value: options.maxRetransmits
    },
    ordered: {
      enumerable: true,
      value: options.ordered
    },
    reliable: {
      enumerable: true,
      value: options.maxPacketLifeTime === null
        && options.maxRetransmits === null
    }
  });
}

inherits(LocalDataTrack, Track);

/**
 * Send a message over the {@link LocalDataTrack}.
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
 * @returns {void}
 */
LocalDataTrack.prototype.send = function send(data) {
  this._trackSender.send(data);
};

/**
 * {@link LocalDataTrack} options
 * @typedef {LocalTrackOptions} LocalDataTrackOptions
 * @property {?number} [maxPacketLifeTime=null] - Set this to limit the time
 *   (in milliseconds) during which the LocalDataTrack will send or re-send data
 *   if not successfully delivered on the underlying RTCDataChannel(s). It is an
 *   error to specify both this and <code>maxRetransmits</code>.
 * @property {?number} [maxRetransmits=null] - Set this to limit the number of
 *   times the {@link LocalDataTrack} will send or re-send data if not
 *   acknowledged on the underlying RTCDataChannel(s). It is an error to specify
 *   both this and <code>maxPacketLifeTime</code>.
 * @property {boolean} [ordered=true] - Set this to false to allow data on the
 *   LocalDataTrack to be sent out-of-order.
 */

module.exports = LocalDataTrack;
