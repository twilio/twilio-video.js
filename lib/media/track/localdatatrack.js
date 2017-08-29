'use strict';

var inherits = require('util').inherits;
var Track = require('./');
var DefaultLocalDataStreamTrack = require('../../data/localdatastreamtrack');
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

/**
 * Construct a {@link LocalDataTrack}.
 * @class
 * @classdesc A {@link LocalDataTrack} is a {@link DataTrack} representing data
 *   that your {@link LcoalParticipant} sends to a {@link Room}.
 * @extends {Track}
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {Track.Kind} kind - "data"
 */
function LocalDataTrack(options) {
  options = Object.assign({
    LocalDataStreamTrack: DefaultLocalDataStreamTrack,
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);

  var LocalDataStreamTrack = options.LocalDataStreamTrack;
  var dataStreamTrack = new LocalDataStreamTrack();

  Track.call(this, dataStreamTrack.id, 'data', options);

  Object.defineProperties(this, {
    _dataStreamTrack: {
      value: dataStreamTrack
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
  this._dataStreamTrack.send(data);
};

module.exports = LocalDataTrack;
