'use strict';

const defaults = require('./defaults');

// GitHub Actions OIDC tokens are valid for only ~5 minutes; re-mint if the cached
// one is older than this so a multi-minute test run never signs requests with a
// stale token.
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;

let cachedToken = process.env.VENDOR_TOKEN;
let cachedTokenMintedAt = cachedToken ? Date.now() : 0;

/**
 * Fetch a fresh vendor OIDC token from the local karma middleware, which mints
 * it server-side (where the runner's OIDC request credentials are available).
 * @returns {Promise<string>}
 */
async function mintVendorToken() {
  const response = await fetch('/mint-vendor-token');
  const { token, error } = await response.json();
  if (error) {
    throw new Error(`callVendor: failed to mint a fresh vendor token: ${error}`);
  }
  return token;
}

/**
 * @returns {Promise<string>} a vendor OIDC token no older than TOKEN_MAX_AGE_MS
 */
async function getVendorToken() {
  if (!cachedToken || Date.now() - cachedTokenMintedAt > TOKEN_MAX_AGE_MS) {
    cachedToken = await mintVendorToken();
    cachedTokenMintedAt = Date.now();
  }
  return cachedToken;
}

/**
 * Call the e2e credential-vending Function.
 * @param {string} action
 * @param {object} params
 * @returns {Promise<*>} the parsed JSON response body
 */
async function callVendor(action, params) {
  const vendorUrl = process.env.VENDOR_URL;

  if (!vendorUrl) {
    throw new Error('callVendor: VENDOR_URL is not set');
  }

  const vendorToken = await getVendorToken();
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
