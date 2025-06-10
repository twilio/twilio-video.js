'use strict';

const https = require('https');

const { apiKeySecret, apiKeySid } = require('../env');
const { environment } = require('../lib/defaults');
const { version } = require('../../package.json');

const HOST_NAME_ECS = environment === 'prod'
  ? 'ecs.us1.twilio.com'
  : `ecs.${environment}-us1.twilio.com`;

const HOST_NAME_REST = environment === 'prod'
  ? 'video.twilio.com'
  : `video.${environment}.twilio.com`;

/**
 * Make an HTTP(s) request.
 * @param {*} config
 * @param {*} data
 * @returns {Promise<*>}
 */
function request(config, data) {
  return new Promise((resolve, reject) => {
    const request = https.request(config, response => {
      response.setEncoding('utf8');
      const data = [];
      response.on('data', chunk => data.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(data.join('')));
        } catch (e) {
          resolve({
            e,
            errorMessage: e.message,
            data: data.join(''),
            status: 'not_ok'
          });
        }
      });
    });
    request.once('error', reject);
    if (data) {
      request.write(stringifyFormData(data));
    }
    request.end();
  });
}

/**
 * Serialize the data into a URL-encoded string.
 * @param {Object} data
 * @returns {string}
 */
function stringifyFormData(data) {
  const params = new URLSearchParams();

  Object.entries(data).forEach(([key, value]) => {
    const stringValue = Array.isArray(value)
      ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(',')
      : typeof value === 'object' ? JSON.stringify(value) : String(value);

    params.append(key, stringValue);
  });

  return params.toString();
}

/**
 * Make an HTTP(S) get request.
 * @param {*} config
 * @returns {Promise<*>}
 */
function get(config) {
  return request(Object.assign({
    method: 'GET'
  }, config));
}


/**
 * Make an HTTP(S) post request.
 * @param {*} config
 * @param data
 * @returns {Promise<*>}
 */
function post(config, data) {
  return request(Object.assign({
    method: 'POST'
  }, config), data);
}

/**
 * Make an ECS request.
 * @param {string} token
 * @returns {Promise<*>}
 */
function postECS(token) {
  return post({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Token': token,
    },
    hostname: HOST_NAME_ECS,
    path: '/v2/Configuration'
  }, {
    service: 'video',
    // eslint-disable-next-line camelcase
    sdk_version: version
  });
}

/**
 * Make an REST request.
 * @param {string} path
 * @param {*} data
 * @returns {Promise<*>}
 */
function postREST(path, data) {
  return post({
    auth: `${apiKeySid}:${apiKeySecret}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    hostname: HOST_NAME_REST,
    path
  }, data);
}

/**
 * Make an REST request.
 * @param {string} path
 * @returns {Promise<*>}
 */
function getREST(path) {
  return get({
    auth: `${apiKeySid}:${apiKeySecret}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    hostname: HOST_NAME_REST,
    path
  });
}

exports.ecs = postECS;
exports.rest = postREST;
exports.getREST = getREST;

