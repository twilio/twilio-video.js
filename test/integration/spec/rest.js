'use strict';

const assert = require('assert');
const https = require('https');

const { apiKeySecret, apiKeySid, enableRestApiTests } = require('../../env');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const { randomName, participantsConnected, tracksAdded } = require('../../lib/util');
const connect = require('../../../lib/connect');

// TODO(mmalavalli): Use twilio-node to call Track Subscription REST APIs.

function subscribedTracks(publication, room, trackAction) {
  const { localParticipant, sid } = room;
  return new Promise((resolve, reject) => {
    const request = https.request({
      auth: `${apiKeySid}:${apiKeySecret}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      hostname: 'video.twilio.com',
      method: 'POST',
      path: `/v1/Rooms/${sid}/Participants/${localParticipant.sid}/SubscribedTracks`
    }, response => {
      response.on('data', () => {});
      response.on('end', resolve);
    });
    request.once('error', reject);
    request.write(`Track=${publication.trackSid}&Status=${trackAction}`);
    request.end();
  });
}

function unsubscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'unsubscribe');
}

function subscribeTrack(publication, room) {
  return subscribedTracks(publication, room, 'subscribe');
}

// NOTE(mmalavalli): A dummy describe() block is declared to prevent
// mocha from erroring out due to all tests being skipped when
// ENABLE_REST_API_TESTS is not present in process.env.
describe('', () => {
  it('', () => {});
});

(enableRestApiTests ? describe : describe.skip)('REST APIs', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  describe('Track Subscription', () => {
    let rooms;

    before(async () => {
      const options = Object.assign({ name: randomName() }, defaults);
      const tokens = [1, 2].map(randomName).map(getToken);
      rooms = await Promise.all(tokens.map(token => connect(token, options)));
      await Promise.all(rooms.map(room => participantsConnected(room, 1)));
      await Promise.all(rooms.map(({ participants }) => [...participants.values()][0]).map(participant => tracksAdded(participant, 2)));
    });

    ['subscribe', 'unsubscribe'].forEach(trackAction => {
      const event = { subscribe: 'trackSubscribed', unsubscribe: 'trackUnsubscribed' }[trackAction];
      const subscribesToOrUnsubscribesFrom = { subscribe: 'subscribes to', unsubscribe: 'unsubscribes from' }[trackAction];

      context(`when a Participant ${subscribesToOrUnsubscribesFrom} a RemoteTrack of another RemoteParticipant`, () => {
        let participant;
        let publication;
        let room;
        let subscribedOrUnsubscribedTrack;
        let track;
        let trackSubscribedOrUnsubscribed;

        before(async () => {
          room = rooms[1];
          participant = [...room.participants.values()][0];
          publication = [...participant.videoTrackPublications.values()][0];
          track = publication.track;

          trackSubscribedOrUnsubscribed = new Promise(resolve => participant.once(event, resolve));
          await unsubscribeTrack(publication, room);

          if (trackAction === 'subscribe') {
            await subscribeTrack(publication, room);
          }
          subscribedOrUnsubscribedTrack = await trackSubscribedOrUnsubscribed;
        });

        it(`should emit "${event}" on the RemoteParticipant`, () => {
          if (trackAction === 'unsubscribe') {
            assert.equal(publication.track, null);
          }
          assert.equal(subscribedOrUnsubscribedTrack, trackAction === 'subscribe' ? publication.track : track);
          assert.equal(participant.tracks.has(track.id), trackAction === 'subscribe');
          assert.equal(participant[`${track.kind}Tracks`].has(track.id), trackAction === 'subscribe');
          assert(participant.trackPublications.has(publication.trackSid));
          assert(participant[`${track.kind}TrackPublications`].has(publication.trackSid));
        });
      });
    });

    after(() => {
      if (Array.isArray(rooms)) {
        rooms.forEach(room => room.disconnect());
      }
      rooms = null;
    });
  });
});
