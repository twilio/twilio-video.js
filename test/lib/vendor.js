'use strict';

const https = require('https');
const { URL } = require('url');

/**
 * Call the e2e credential-vending Function.
 * @param {string} action
 * @param {object} params
 * @returns {Promise<*>} the parsed JSON response body
 */
function callVendor(action, params) {
  return new Promise((resolve, reject) => {
    const vendorUrl = process.env.VENDOR_URL;
    const vendorToken = process.env.VENDOR_TOKEN;

    if (!vendorUrl) {
      reject(new Error('callVendor: VENDOR_URL is not set'));
      return;
    }
    if (!vendorToken) {
      reject(new Error('callVendor: VENDOR_TOKEN is not set'));
      return;
    }

    const url = new URL(vendorUrl);
    const body = JSON.stringify(Object.assign({ action }, params));

    const request = https.request({
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${vendorToken}`
      }
    }, response => {
      response.setEncoding('utf8');
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(chunks.join(''));
        } catch (e) {
          reject(new Error(`callVendor: non-JSON response from vendor: ${chunks.join('')}`));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`callVendor: ${action} failed (${response.statusCode}): ${parsed.error || JSON.stringify(parsed)}`));
        }
      });
    });

    request.once('error', reject);
    request.write(body);
    request.end();
  });
}

module.exports = callVendor;
