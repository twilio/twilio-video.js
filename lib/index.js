'use strict';

var Endpoint = require('./endpoint');

/**
 * Creates a new Signal {@link Endpoint}.
 * @param {string|CapabilityToken} - A capability token you've generated for
 *   this user.
 * @param {object} options
 * @returns {Endpoint}
 */
function createEndpointWithToken(token, options) {
  return new Endpoint(options);
}

/**
 * Creates an anonymous Signal {@link Endpoint}. The endpoint's capabilities
 * and TTL will be governed by the permissions you configure in the Anonymous
 * Endpoints configuration in the Signal account portal.
 * @param {object} options
 * @returns {Endpoint}
 */
function createEndpointAnonymously(options) {
  return new Endpoint(options);
}

/**
 * @param {object} options
 * @returns {Endpoint}
 */
function createEndpointWithOAuth(options) {
  return new Endpoint(options);
}

module.exports.createEndpointWithToken = createEndpointWithToken;
module.exports.createEndpointAnonymously = createEndpointAnonymously;
module.exports.createEndpointWithOAuth = createEndpointWithOAuth;
