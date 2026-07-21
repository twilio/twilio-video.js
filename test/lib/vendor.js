'use strict';

// Browser-only: the relative fetch URL below requires a page origin, so this
// throws under Node's own fetch.

// GitHub Actions OIDC tokens are valid for only ~5 minutes; re-mint if the cached
// one is older than this so a multi-minute test run never signs requests with a
// stale token. 4 min leaves a 1-min margin before that ~5-min expiry.
const TOKEN_MAX_AGE_MS = 4 * 60 * 1000;

// Each spec file gets a fresh page (scripts/karma.js), re-evaluating this module,
// so a cached token can't be trusted as fresh on load -- always mint on first use.
let cachedToken = null;
let cachedTokenMintedAt = 0;
let cachedTokenPromise = null;

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
  if (!token) {
    throw new Error('callVendor: /mint-vendor-token returned no token');
  }
  return token;
}

/**
 * @returns {Promise<string>} a vendor OIDC token no older than TOKEN_MAX_AGE_MS
 */
function getVendorToken() {
  if (cachedTokenPromise) {
    return cachedTokenPromise;
  }
  if (cachedToken && Date.now() - cachedTokenMintedAt <= TOKEN_MAX_AGE_MS) {
    return Promise.resolve(cachedToken);
  }
  // Cache the in-flight promise (not just the eventual token) so concurrent
  // callers awaiting a stale/missing token share one mint instead of racing
  // to mint their own.
  cachedTokenPromise = mintVendorToken().then(token => {
    cachedToken = token;
    cachedTokenMintedAt = Date.now();
    cachedTokenPromise = null;
    return token;
  }, error => {
    cachedTokenPromise = null;
    throw error;
  });
  return cachedTokenPromise;
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

  const body = JSON.stringify(Object.assign({ action }, params));

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
