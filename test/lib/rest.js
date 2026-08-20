'use strict';

const callVendor = require('./vendor');

/**
 * Complete a Room using the REST API, via the vendor Function.
 * @param {string} nameOrSid
 * @returns {Promise<void>}
 */
function completeRoom(nameOrSid) {
  return callVendor('complete-room', { nameOrSid });
}

/**
 * Get a Room using the REST API, via the vendor Function.
 * @param {string} roomSid
 * @returns {Promise<*>}
 */
function getRoom(roomSid) {
  return callVendor('get-room', { roomSid });
}

/**
 * Create a Room using the REST API, via the vendor Function.
 * @param {string} name
 * @param {'group' | 'group-small' | 'peer-to-peer'} type
 * @param {object} roomOptions
 * @returns {Promise<Room.SID>}
 */
async function createRoom(name, type, roomOptions) {
  const roomResult = await callVendor('create-room', { name, type, roomOptions });

  const { sid, status } = roomResult;
  if (status === 'in-progress') {
    return sid;
  }

  console.warn(`Could not create ${type} Room: ${name}: `, roomResult);
  throw new Error(`Could not create ${type} Room: ${name}`);
}

/**
 * Update the subscription status of a RemoteTrack, via the vendor Function.
 * @param {RemoteTrackPublication} publication
 * @param {Room} room
 * @param {'subscribe' | 'unsubscribe'} trackAction
 */
function subscribedTracks(publication, room, trackAction) {
  const { localParticipant, sid } = room;
  return callVendor(`${trackAction}-track`, {
    roomSid: sid,
    participantSid: localParticipant.sid,
    trackSid: publication.trackSid
  });
}

/**
 * Unsubscribe from a RemoteTrack, via the vendor Function.
 * @param {RemoteTrackPublication} publication
 * @param {Room} room
 */
function unsubscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'unsubscribe');
}

/**
 * Subscribe to a RemoteTrack, via the vendor Function.
 * @param {RemoteTrackPublication} publication
 * @param {Room} room
 */
function subscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'subscribe');
}

function startRecording(room) {
  return callVendor('start-recording', { roomSid: room.sid });
}

function stopRecording(room) {
  return callVendor('stop-recording', { roomSid: room.sid });
}

exports.startRecording = startRecording;
exports.stopRecording = stopRecording;
exports.completeRoom = completeRoom;
exports.createRoom = createRoom;
exports.getRoom = getRoom;
exports.unsubscribeTrack = unsubscribeTrack;
exports.subscribeTrack = subscribeTrack;
