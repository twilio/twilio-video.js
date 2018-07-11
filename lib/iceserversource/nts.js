'use strict';

const constants = require('../util/constants');
const ECS = require('../ecs');
const EventEmitter = require('events').EventEmitter;
const Log = require('../util/log');
const TimeoutPromise = require('../util/timeoutpromise');
const util = require('../util');
const { ConfigurationAcquireFailedError } = require('../util/twilio-video-errors');
const version = require('../../package.json').version;

let instances = 0;

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
 * A Network Traversal Service (NTS)-backed implementation of
 * {@link IceServerSource}; useful for getting fresh TURN servers from Twilio.
 * @extends EventEmitter
 * @implements {IceServerSource}
 */
class NTSIceServerSource extends EventEmitter {
  /**
   * Construct an {@link NTSIceServerSource}.
   * @param {string} token - Access Token
   * @param {NTSIceServerSourceOptions} [options]
   */
  constructor(token, options) {
    super();

    options = Object.assign({
      abortOnTimeout: false,
      defaultTTL: constants.ICE_SERVERS_DEFAULT_TTL,
      environment: constants.DEFAULT_ENVIRONMENT,
      getConfiguration: ECS.getConfiguration,
      realm: constants.DEFAULT_REALM,
      timeout: constants.ICE_SERVERS_TIMEOUT_MS
    }, options);

    /* eslint-disable new-cap */
    const defaultIceServers = constants.DEFAULT_ICE_SERVERS(options.environment);
    const ecsServer = options.ecsServer || constants.ECS_SERVER(options.environment, options.realm);
    /* eslint-enable new-cap */

    const log = options.log
      ? options.log.createLog('default', this)
      : new Log('default', this, util.buildLogLevels('off'));

    Object.defineProperties(this, {
      _abortOnTimeout: {
        value: options.abortOnTimeout
      },
      // This Promise represents the current invocation of `poll`. `start` sets it
      // and `stop` clears it out.
      _currentPoll: {
        value: null,
        writable: true
      },
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
      _status: {
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

  get isStarted() {
    return !!this._currentPoll;
  }

  get status() {
    return this._status;
  }

  start() {
    if (!this.isStarted) {
      this._log.info('Starting');
      this._currentPoll = poll(this);
    } else {
      this._log.warn('Already started');
    }
    return this._currentPoll;
  }

  stop() {
    if (!this.isStarted) {
      this._log.warn('Already stopped');
      return;
    }
    this._log.info('Stopping');
    this._currentPoll = null;
    clearTimeout(this._nextPoll);
    this._stopped.resolve();
    this._stopped = util.defer();
    this._log.debug('Stopped');
  }

  toString() {
    return `[NTSIceServerSource #${this._instance}]`;
  }
}

/**
 * Parse an ECS configuration value, log any warnings, and return a tuple of
 * ICE servers and TTL.
 * @param {NTSIceServerSource} client
 * @param {object} config
 * @returns {Array<Array<RTCIceServerInit>|Number>} iceServersAndTTL
 * @throws {Error}
 */
function parseECSConfig(client, config) {
  const nts = util.getOrNull(config, 'video.network_traversal_service');
  if (!nts) {
    throw new Error('network_traversal_service not available');
  } else if (nts.warning) {
    client._log.warn(nts.warning);
  }

  const iceServers = nts.ice_servers;
  if (!iceServers) {
    throw new Error('ice_servers not available');
  }
  client._log.info(`Got ICE servers: ${JSON.stringify(iceServers)}`);

  const ttl = nts.ttl || client._defaultTTL;
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

  const options = {
    configUrl: `${client._ecsServer}/v2/Configuration`,
    body: {
      service: 'video',
      /* eslint-disable camelcase */
      sdk_version: version
      /* eslint-enable camelcase */
    }
  };

  const alreadyStopped = new Error('Already stopped');
  const config = client._getConfiguration(client._token, options);
  const configWithTimeout = new TimeoutPromise(config, client._timeout);

  return Promise.race([
    configWithTimeout,
    client._stopped.promise
  ]).then(config => {
    if (!config) {
      throw alreadyStopped;
    }
    const iceServersAndTTL = parseECSConfig(client, config);
    client._status = 'success';
    return iceServersAndTTL;
  }).catch(error => {
    client._status = 'failure';
    if (!client.isStarted) {
      throw alreadyStopped;
    } else if (configWithTimeout.isTimedOut) {
      if (client._abortOnTimeout) {
        client._log.warn('Getting ICE servers took too long');
        throw new ConfigurationAcquireFailedError();
      }
      client._log.warn('Getting ICE servers took too long (using defaults)');
    } else {
      // NOTE(mroberts): Stop if we get an Access Token error (2xxxx)
      if (error.code && Math.floor(error.code / 10000) === 2) {
        client.stop();
      }
      client._log.warn('Failed to get ICE servers (using defaults):', error);
    }
    return [client._defaultIceServers, client._defaultTTL];
  }).then(iceServersAndTTL => {
    const iceServers = iceServersAndTTL[0];
    const ttl = iceServersAndTTL[1];

    if (client.isStarted) {
      client._log.info(`Getting ICE servers again in ${ttl} seconds`);
      client._nextPoll = setTimeout(function nextPoll() {
        if (client.isStarted) {
          client._currentPoll = poll(client);
        }
      }, (ttl - constants.ECS_TIMEOUT) * 1000);
    }

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
