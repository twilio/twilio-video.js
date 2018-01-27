'use strict';

const request = require('./request');
const createTwilioError = require('./util/twilio-video-errors').createTwilioError;
const ConfigurationAcquireFailedError = require('./util/twilio-video-errors').ConfigurationAcquireFailedError;

const CONFIG_URL = 'https://ecs.us1.twilio.com/v1/Configuration';

/**
 * Request a configuration setting for the specified JWT.
 * @param {String} token - A JWT String representing a valid AccessToken.
 * @param {?ECS.getConfigurationOptions} [options]
 * @returns {Promise<Object>} configuration - An unformatted map of
 *   configuration settings specific to the specified service.
 * @throws {TwilioError}
*//**
 * @typedef {Object} ECS.getConfigurationOptions
 * @property {?Object} [body] - A valid JSON payload to send to the
 *   ECS endpoint.
 * @property {?String} [configUrl='https://ecs.us1.twilio.com/v1/Configuration'] - A
 *   custom URL to POST ECS configuration requests to.
 */
function getConfiguration(token, options) {
  if (!token) {
    throw new Error('<String>token is a required argument.');
  }

  options = Object.assign({
    configUrl: CONFIG_URL
  }, options);

  const postData = {
    url: options.configUrl,
    headers: {
      'X-Twilio-Token': token,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  if (options.body) {
    postData.body = toQueryString(options.body);
  }

  return request.post(postData).then(responseText => parseJsonTextFromECS(responseText), errorText => {
    const error = parseJsonTextFromECS(errorText);
    throw createTwilioError(error.code, error.message);
  });
}

function parseJsonTextFromECS(jsonText) {
  let json = null;
  try {
    json = JSON.parse(jsonText);
  } catch (error) {
    throw new ConfigurationAcquireFailedError();
  }
  return json;
}

function toQueryString(params) {
  return Object.keys(params || { }).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
}

module.exports.getConfiguration = getConfiguration;
