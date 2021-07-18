'use strict';

const https = require('https');

const { apiKeySecret, apiKeySid } = require('../env');
const { environment } = require('../lib/defaults');

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
    if (data) {
      request.write(Object.keys(data).map(key => `${key}=${data[key]}`).join('&'));
    }
    request.end();
  });
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

exports.rest = postREST;
exports.getREST = getREST;

