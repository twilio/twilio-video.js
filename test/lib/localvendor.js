/* eslint no-process-env:0 */
'use strict';

// Node-only (loaded by karma/makeconf.js), so credentials stay out of the browser.

const { AccessToken } = require('twilio').jwt;
const { stringifyFormData } = require('./post');

const REQUIRED_CREDENTIALS = ['ACCOUNT_SID', 'API_KEY_SID', 'API_KEY_SECRET'];

/**
 * Handle a vending request with the credentials in process.env, mirroring the
 * VENDOR_URL service's responses: REST resources as-is, errors as { error }.
 * @param {string} action
 * @param {object} params
 * @returns {Promise<{ status: number, body: object }>|{ status: number, body: object }}
 */
function vendLocally(action, params) {
  const missing = REQUIRED_CREDENTIALS.filter(name => !process.env[name]);
  if (missing.length) {
    return errorResponse(500, `localVendor: set ${missing.join(', ')}, or set VENDOR_URL `
      + 'to use the e2e credential vendor');
  }

  switch (action) {
    case 'mint-token':
      return mintToken(params);
    case 'create-room':
      return rest('POST', '/v1/Rooms', Object.assign({
        Type: params.type,
        UniqueName: params.name
      }, params.roomOptions));
    case 'complete-room':
      return rest('POST', `/v1/Rooms/${encodeURIComponent(params.nameOrSid)}`, { Status: 'completed' });
    case 'get-room':
      return rest('GET', `/v1/Rooms/${encodeURIComponent(params.roomSid)}`);
    case 'subscribe-track':
    case 'unsubscribe-track':
      return rest('POST', `/v1/Rooms/${encodeURIComponent(params.roomSid)}/Participants/${encodeURIComponent(params.participantSid)}/SubscribedTracks`, {
        Status: action.split('-')[0],
        Track: params.trackSid
      });
    case 'start-recording':
      return rest('POST', `/v1/Rooms/${encodeURIComponent(params.roomSid)}/RecordingRules`, {
        Rules: '[{ "type": "include", "all": "true" }]'
      });
    case 'stop-recording':
      return rest('POST', `/v1/Rooms/${encodeURIComponent(params.roomSid)}/RecordingRules`, {
        Rules: '[{ "type": "exclude", "all": "true" }]'
      });
    default:
      return errorResponse(400, `localVendor: unsupported action "${action}"`);
  }
}

function mintToken({ identity, grant, room, ttl }) {
  if (grant !== 'video' && grant !== null) {
    return errorResponse(400, `localVendor: unsupported grant "${grant}"`);
  }

  const accessToken = new AccessToken(
    process.env.ACCOUNT_SID,
    process.env.API_KEY_SID,
    process.env.API_KEY_SECRET,
    { identity, ttl });

  if (grant === 'video') {
    accessToken.addGrant(new AccessToken.VideoGrant({ room }));
  }

  return { status: 200, body: { token: accessToken.toJwt('HS256') } };
}

async function rest(method, path, data) {
  const environment = process.env.ENVIRONMENT || 'prod';
  const hostname = environment === 'prod' ? 'video.twilio.com' : `video.${environment}.twilio.com`;
  const auth = Buffer.from(`${process.env.API_KEY_SID}:${process.env.API_KEY_SECRET}`).toString('base64');

  const response = await fetch(`https://${hostname}${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: data ? stringifyFormData(data) : undefined
  });

  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch (e) {
    return errorResponse(502, `localVendor: non-JSON response from ${hostname} (${response.status}): ${text}`);
  }
}

function errorResponse(status, error) {
  return { status, body: { error } };
}

module.exports = vendLocally;
