'use strict';

var constants = require('../util/constants');
var ECS = require('../ecs');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('../util/log');
var TimeoutPromise = require('../util/timeoutpromise');
var util = require('../util');
var version = require('../../package.json').version;

var instances = 0;

/**
 * @typedef {ECS.getConfigurationOptions} NTSIceServerSourceOptions
 * @property {Array<RTCIceServerInit>} [defaultIceServers]
 * @property {number} [defaultTTL]
 * @property {string} [ecsServer]
 * @property {string} [environment="prod"]
 * @property {function(string, ECS.getConfigurationOptions): Promise<object>} [getConfiguration]
 * @property {string} [realm="us1"]
 * @property {Log} [log]
 * @property {number} [timeout]
 */

/**
 * Construct an {@link NTSIceServerSource}.
 * @class
 * @classdesc A Network Traversal Service (NTS)-backed implementation of
 *   {@link IceServerSource}; useful for getting fresh TURN servers from Twilio
 * @implements {IceServerSource}
 * @param {string} token - Access Token
 * @param {NTSIceServerSourceOptions} [options]
 */
function NTSIceServerSource(token, options) {
  EventEmitter.call(this);

  options = Object.assign({
    defaultTTL: constants.ICE_SERVERS_DEFAULT_TTL,
    environment: constants.DEFAULT_ENVIRONMENT,
    getConfiguration: ECS.getConfiguration,
    realm: constants.DEFAULT_REALM,
    timeout: constants.ICE_SERVERS_TIMEOUT_MS
  }, options);

  /* eslint-disable new-cap */
  var defaultIceServers = constants.DEFAULT_ICE_SERVERS(options.environment);
  var ecsServer = options.ecsServer || constants.ECS_SERVER(options.environment, options.realm);
  /* eslint-enable new-cap */

  var log = options.log
    ? options.log.createLog('default', this)
    : new Log('default', this, util.buildLogLevels('off'));

  Object.defineProperties(this, {
    // In the event that ECS or NTS fail to return ICE servers in a timely
    // manner, NTSIceServerSource falls back to these servers.
    _defaultIceServers: {
      value: defaultIceServers
    },
    _defaultTTL: {
      value: options.defaultTTL
    },
    // This is the ECS server NTSIceServerSource communicates with.
    _ecsServer: {
      value: ecsServer
    },
    _getConfiguration: {
      value: options.getConfiguration
    },
    _instance: {
      value: ++instances
    },
    // This timer ID represents the next invocation of `poll`.
    _nextPoll: {
      value: null,
      writable: true
    },
    _log: {
      value: log
    },
    // This Promise represents the current invocation of `poll`. `start` sets it
    // and `stop` clears it out.
    _started: {
      value: null,
      writable: true
    },
    // This Deferred remains unresolved until `stop` is called. We use it to
    // short-circuit in `poll`.
    _stopped: {
      value: util.defer(),
      writable: true
    },
    // This value configures the amount of time NTSIceServerSource will wait
    // when fetching ICE servers.
    _timeout: {
      value: options.timeout
    },
    // This is the Access Token NTSIceServerSource makes requests to ECS with.
    _token: {
      value: token
    }
  });

  this._log.info('Created a new NTSIceServerSource');
  this._log.debug('ECS server:', this._ecsServer);
}

inherits(NTSIceServerSource, EventEmitter);

NTSIceServerSource.prototype.start = function start() {
  if (!this._started) {
    this._log.info('Starting');
    this._started = poll(this);
  } else {
    this._log.warn('Already started');
  }
  return this._started;
};

NTSIceServerSource.prototype.stop = function stop() {
  if (!this._started) {
    this._log.warn('Already stopped');
    return;
  }
  this._log.info('Stopping');
  this._started = null;
  clearTimeout(this._nextPoll);
  this._stopped.resolve();
  this._stopped = util.defer();
  this._log.debug('Stopped');
};

NTSIceServerSource.prototype.toString = function toString() {
  return '[NTSIceServerSource #' + this._instance + ']';
};

/**
 * Parse an ECS configuration value, log any warnings, and return a tuple of
 * ICE servers and TTL.
 * @param {NTSIceServerSource} client
 * @param {object} config
 * @returns {Array<Array<RTCIceServerInit>|Number>} iceServersAndTTL
 * @throws {Error}
 */
function parseECSConfig(client, config) {
  var nts = util.getOrNull(config, 'video.network_traversal_service');
  if (!nts) {
    throw new Error('network_traversal_service not available');
  } else if (nts.warning) {
    client._log.warn(nts.warning);
  }

  var iceServers = nts.ice_servers;
  if (!iceServers) {
    throw new Error('ice_servers not available');
  }
  client._log.info('Got ICE servers: ' + JSON.stringify(iceServers));

  var ttl = nts.ttl || client._defaultTTL;
  return [iceServers, ttl];
}

/**
 * Get ICE servers and their TTL.
 * @private
 * @param {NTSIceServerSource} nts
 * @returns {Promise<Array<RTCIceServerInit>>} iceServers
 */
function poll(client) {
  // We race `getConfiguration` against the `_stopped` Promise so that, when
  // `stop` is called on the NTSIceServerSource, we can immediately proceed
  // without waiting on `getConfiguration`.
  client._log.debug('Getting ECS configuration');

  var options = {
    configUrl: client._ecsServer + '/v1/Configuration',
    body: {
      service: 'video',
      /* eslint-disable camelcase */
      sdk_version: version
      /* eslint-enable camelcase */
    }
  };

  var alreadyStopped = new Error('Already stopped');
  var config = client._getConfiguration(client._token, options);
  var configWithTimeout = new TimeoutPromise(config, client._timeout);

  return Promise.race([
    configWithTimeout,
    client._stopped.promise
  ]).then(function(config) {
    if (!config) {
      throw alreadyStopped;
    }
    return parseECSConfig(client, config);
  }).catch(function(error) {
    if (!client._started) {
      throw alreadyStopped;
    } else if (configWithTimeout.isTimedOut) {
      client._log.warn('Getting ICE servers took too long (using defaults)');
    } else {
      client._log.warn('Failed to get ICE servers (using defaults):', error);
    }
    return [client._defaultIceServers, client._defaultTTL];
  }).then(function(iceServersAndTTL) {
    var iceServers = iceServersAndTTL[0];
    var ttl = iceServersAndTTL[1];

    client._log.info('Getting ICE servers again in ' + ttl + ' seconds');
    client._nextPoll = setTimeout(function nextPoll() {
      if (client._started) {
        client._started = poll(client);
      }
    }, (ttl - constants.ECS_TIMEOUT) * 1000);

    client._iceServers = iceServers;
    try {
      client.emit('iceServers', iceServers);
    } catch (error) {
      // Do nothing.
    }
    return iceServers;
  });
}

module.exports = NTSIceServerSource;
