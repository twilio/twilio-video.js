'use strict';

const AccessToken = require('twilio').jwt.AccessToken;
const credentials = require('../env');

const defaults = Object.assign({
  grant: 'video',
  ttl: 60 * 1000
}, credentials);

/**
 * @typedef {object} CreateTokenOptions
 * @property {string} accountSid
 * @property {string} apiKeySecret
 * @property {string} apiKeySid
 * @property {string} configurationProfileSid
 * @property {?string} [grant="video"] - one of "video", "conversations", or null
 * @property {number} [ttl=60000]
 * @property {?string} room
 */

/**
 * Create an Access Token. Options specified in {@link CreateTokenOptions} take
 * precedence over environment variables, which take precedence over hard-coded
 * defaults. If any option is unspecified which lacks a default value, this
 * function throws.
 * @param {string} identity
 * @param {CreateTokenOptions} [options]
 * @throws Error
 */
function createToken(identity, options) {
  options = Object.assign({}, defaults, options);

  const {
    accountSid,
    apiKeySecret,
    apiKeySid,
    configurationProfileSid,
    ttl
  } = options;

  const accessToken = new AccessToken(
    accountSid,
    apiKeySid,
    apiKeySecret,
    { ttl });

  accessToken.identity = identity;

  let grant = options.grant;
  const room = options.room;
  switch (grant) {
    case 'conversations':
      grant = new AccessToken.ConversationsGrant({
        identity,
        configurationProfileSid
      });
      break;
    case 'video':
      grant = new AccessToken.VideoGrant({
        identity, room
      });
      break;
    default:
      // Do nothing.
  }

  if (grant) {
    accessToken.addGrant(grant);
  }

  return accessToken.toJwt('HS256');
}

module.exports = createToken;
