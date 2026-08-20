'use strict';

const callVendor = require('./vendor');

/**
 * @typedef {object} CreateTokenOptions
 * @property {?string} [grant="video"] - one of "video", "conversations", or null
 * @property {number} [ttl=3600] - in seconds
 * @property {?string} room
 */

const defaultOptions = {
  grant: 'video',
  ttl: 3600
};

/**
 * Request an Access Token from the e2e credential-vending Function. Options
 * specified in {@link CreateTokenOptions} take precedence over hard-coded
 * defaults.
 * @param {string} identity
 * @param {CreateTokenOptions} [options]
 * @returns {Promise<string>} the Access Token JWT
 */
async function createToken(identity, options) {
  options = Object.assign({}, defaultOptions, options);

  const { token } = await callVendor('mint-token', {
    identity,
    grant: options.grant,
    room: options.room,
    ttl: options.ttl
  });
  return token;
}

module.exports = createToken;
