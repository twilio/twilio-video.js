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
          resolve({ status: 'ok' });
        }
      });
    });
    request.once('error', reject);
    request.write(Object.keys(data).map(key => `${key}=${data[key]}`).join('&'));
    request.end();
  });
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

exports.ecs = postECS;
exports.rest = postREST;
