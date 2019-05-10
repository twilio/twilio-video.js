'use strict';

const https = require('https');

const {
  apiKeySecret,
  apiKeySid,
  environment
} = require('../env');

const hostname = environment && environment !== 'prod'
  ? `video.${environment}.twilio.com`
  : 'video.twilio.com';

function post(resource, data) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      auth: `${apiKeySid}:${apiKeySecret}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      hostname,
      method: 'POST',
      path: resource
    }, response => {
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
 * Complete a Room using the REST API.
 * @param {string} nameOrSid
 * @returns {Promise<void>}
 */
function completeRoom(nameOrSid) {
  return post(`/v1/Rooms/${nameOrSid}`, {
    Status: 'completed'
  });
}

/**
 * Create a Room using the REST API.
 * @param {string} name
 * @param {'group' | 'group-small' | 'peer-to-peer'} type
 * @returns {Promise<Room.SID>}
 */
 async function createRoom(name, type, roomOptions) {
  const { sid, status } = await post('/v1/Rooms', Object.assign({
    Type: type,
    UniqueName: name
  }, roomOptions));
  if (status === 'in-progress') {
    return sid;
  }
  throw new Error(`Could not create ${type} Room: ${name}`);
}

/**
 * Update the subscription status of a RemoteTrack using the REST API.
 * @param {RemoteTrackPublication} publication
 * @param {Room} room
 * @param {'subscribe' | 'unsubscribe'} trackAction
 */
function subscribedTracks(publication, room, trackAction) {
  const { localParticipant, sid } = room;
  return post(`/v1/Rooms/${sid}/Participants/${localParticipant.sid}/SubscribedTracks`, {
    Status: trackAction,
    Track: publication.trackSid
  });
}

/**
 * Unsubscribe from a RemoteTrack using the REST API.
 * @param {RemoteTrackPublication} publication
 * @param {Room} room
 */
function unsubscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'unsubscribe');
}

/**
 * Subscribe to a RemoteTrack using the REST API.
 * @param {RemoteTrackPublication} publication
 * @param {Room} room
 */
function subscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'subscribe');
}

exports.completeRoom = completeRoom;
exports.createRoom = createRoom;
exports.unsubscribeTrack = unsubscribeTrack;
exports.subscribeTrack = subscribeTrack;
