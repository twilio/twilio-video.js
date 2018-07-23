'use strict';

const https = require('https');

const {
  apiKeySecret,
  apiKeySid
} = require('../env');

function post(resource, data) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      auth: `${apiKeySid}:${apiKeySecret}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      hostname: 'video.twilio.com',
      method: 'POST',
      path: resource
    }, response => {
      response.on('data', () => {});
      response.on('end', resolve);
    });
    request.once('error', reject);
    request.write(Object.keys(data).map(key => `${key}=${data[key]}`).join('&'));
    request.end();
  });
}

function completeRoom(name) {
  return post(`/v1/Rooms/${name}`, {
    Status: 'completed'
  });
}

function createRoom(name, type) {
  return post('/v1/Rooms', {
    Type: type,
    UniqueName: name
  });
}

function subscribedTracks(publication, room, trackAction) {
  const { localParticipant, sid } = room;
  return post(`/v1/Rooms/${sid}/Participants/${localParticipant.sid}/SubscribedTracks`, {
    Status: trackAction,
    Track: publication.trackSid
  });
}

function unsubscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'unsubscribe');
}

function subscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'subscribe');
}

exports.completeRoom = completeRoom;
exports.createRoom = createRoom;
exports.unsubscribeTrack = unsubscribeTrack;
exports.subscribeTrack = subscribeTrack;
