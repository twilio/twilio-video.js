'use strict';

var inherits = require('util').inherits;
var Track = require('./');
var DefaultDataTrackSender = require('../../data/sender');
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

var didPrintDataTrackWarning = false;

/**
 * Construct a {@link LocalDataTrack}.
 * @class
 * @classdesc A {@link LocalDataTrack} is a {@link Track} representing data
 *   that your {@link LocalParticipant} can publish to a {@link Room}.
 * @extends {Track}
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {Track.Kind} kind - "data"
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
  var log = options.log = options.log || new Log('default', this, logLevels);

  if (!didPrintDataTrackWarning
    && (log.logLevel !== 'error' && log.logLevel !== 'off')) {
    didPrintDataTrackWarning = true;
    log.warnOnce([
      'This release of twilio-video.js includes experimental support for',
      'DataTracks. Support for DataTracks is "experimental" because, at the',
      'time of writing, DataTracks are only supported in Peer-to-Peer (P2P)',
      'Rooms. Nevertheless, the APIs will remain the same once DataTracks are',
      'supported in Group Rooms. Please test this release and report any',
      'issues to https://github.com/twilio/twilio-video.js'
    ].join(' '));
  }

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
