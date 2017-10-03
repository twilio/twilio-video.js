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
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {Track.Kind} kind - "data"
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
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);

  var DataTrackSender = options.DataTrackSender;
  var dataTrackSender = new DataTrackSender();

  Track.call(this, dataTrackSender.id, 'data', options);

  Object.defineProperties(this, {
    _dataTrackSender: {
      value: dataTrackSender
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
  this._dataTrackSender.send(data);
};

module.exports = LocalDataTrack;
