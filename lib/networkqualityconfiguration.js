'use strict';

const { EventEmitter } = require('events');

const {
  DEFAULT_NQ_LEVEL_LOCAL,
  DEFAULT_NQ_LEVEL_REMOTE,
  MAX_NQ_LEVEL
} = require('./util/constants');

const { inRange } = require('./util');

/**
 * {@link NetworkQualityConfigurationImpl} represents an object which notifies its
 * listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements NetworkQualityConfiguration
 * @property {?NetworkQualityVerbosity} local - Verbosity level for {@link LocalParticipant}
 * @property {?NetworkQualityVerbosity} remote - Verbosity level for {@link RemoteParticipant}s
 */
class NetworkQualityConfigurationImpl extends EventEmitter {
  /**
   * Construct an {@link NetworkQualityConfigurationImpl}.
   * @param {NetworkQualityConfiguration} networkQualityConfiguration - Initial {@link NetworkQualityConfiguration}
   */
  constructor(networkQualityConfiguration) {
    super();

    networkQualityConfiguration = Object.assign({
      local: DEFAULT_NQ_LEVEL_LOCAL,
      remote: DEFAULT_NQ_LEVEL_REMOTE
    }, networkQualityConfiguration);

    Object.defineProperties(this, {
      local: {
        value: inRange(networkQualityConfiguration.local, DEFAULT_NQ_LEVEL_LOCAL, MAX_NQ_LEVEL)
          ? networkQualityConfiguration.local
          : DEFAULT_NQ_LEVEL_LOCAL,
        writable: true
      },
      remote: {
        value: inRange(networkQualityConfiguration.remote, DEFAULT_NQ_LEVEL_REMOTE, MAX_NQ_LEVEL)
          ? networkQualityConfiguration.remote
          : DEFAULT_NQ_LEVEL_REMOTE,
        writable: true
      }
    });
  }

  /**
   * Update the verbosity levels for network quality information for
   * {@link LocalParticipant} and {@link RemoteParticipant} with those
   * in the given {@link NetworkQualityConfiguration}.
   * @param {NetworkQualityConfiguration} networkQualityConfiguration - The new {@link NetworkQualityConfiguration}
   */
  update(networkQualityConfiguration) {
    networkQualityConfiguration = Object.assign({
      local: this.local,
      remote: this.remote
    }, networkQualityConfiguration);

    [
      ['local', DEFAULT_NQ_LEVEL_LOCAL, 3],
      ['remote', DEFAULT_NQ_LEVEL_REMOTE, 3]
    ].forEach(([localOrRemote, min, max]) => {
      this[localOrRemote] = typeof networkQualityConfiguration[localOrRemote] === 'number'
        && inRange(networkQualityConfiguration[localOrRemote], min, max)
        ? networkQualityConfiguration[localOrRemote]
        : min;
    });
  }
}

module.exports = NetworkQualityConfigurationImpl;
