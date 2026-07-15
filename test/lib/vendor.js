'use strict';

const defaults = require('./defaults');

/**
 * Call the e2e credential-vending Function.
 * @param {string} action
 * @param {object} params
 * @returns {Promise<*>} the parsed JSON response body
 */
async function callVendor(action, params) {
  const vendorUrl = process.env.VENDOR_URL;
  const vendorToken = process.env.VENDOR_TOKEN;

  if (!vendorUrl) {
    throw new Error('callVendor: VENDOR_URL is not set');
  }
  if (!vendorToken) {
    throw new Error('callVendor: VENDOR_TOKEN is not set');
  }

  const body = JSON.stringify(Object.assign({ action, environment: defaults.environment }, params));

  const response = await fetch(vendorUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vendorToken}`
    },
    body
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`callVendor: non-JSON response from vendor: ${text}`);
  }

  if (!response.ok) {
    throw new Error(`callVendor: ${action} failed (${response.status}): ${parsed.error || JSON.stringify(parsed)}`);
  }
  return parsed;
}

module.exports = callVendor;
