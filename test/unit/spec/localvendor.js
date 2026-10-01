'use strict';

const assert = require('assert');
const sinon = require('sinon');

const vendLocally = require('../../lib/localvendor');

const ACCOUNT_SID = 'AC' + '0'.repeat(32);
const API_KEY_SID = 'SK' + '1'.repeat(32);
const API_KEY_SECRET = 'api-key-secret';
const ENV_KEYS = ['ACCOUNT_SID', 'API_KEY_SID', 'API_KEY_SECRET', 'ENVIRONMENT'];

function decodePayload(jwt) {
  return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
}

describe('vendLocally', () => {
  let fetchStub;
  let saved;

  beforeEach(() => {
    saved = {};
    ENV_KEYS.forEach(key => {
      saved[key] = process.env[key];
      delete process.env[key];
    });
    process.env.ACCOUNT_SID = ACCOUNT_SID;
    process.env.API_KEY_SID = API_KEY_SID;
    process.env.API_KEY_SECRET = API_KEY_SECRET;
    fetchStub = sinon.stub(global, 'fetch').resolves({
      status: 201,
      text: () => Promise.resolve(JSON.stringify({ sid: 'RMxxx', status: 'in-progress' }))
    });
  });

  afterEach(() => {
    fetchStub.restore();
    ENV_KEYS.forEach(key => {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    });
  });

  describe('mint-token', () => {
    it('mints a video Access Token signed by the local API key', async () => {
      const { status, body } = await vendLocally('mint-token', { identity: 'Alice', grant: 'video', room: 'my-room', ttl: 123 });
      const payload = decodePayload(body.token);

      assert.equal(status, 200);
      assert.equal(payload.iss, API_KEY_SID);
      assert.equal(payload.sub, ACCOUNT_SID);
      assert.equal(payload.grants.identity, 'Alice');
      assert.deepStrictEqual(payload.grants.video, { room: 'my-room' });
      assert.equal(payload.exp - payload.iat, 123);
      assert(fetchStub.notCalled);
    });

    it('omits the video grant when grant is null', async () => {
      const { body } = await vendLocally('mint-token', { identity: 'Alice', grant: null, ttl: 60 });
      assert.equal(decodePayload(body.token).grants.video, undefined);
    });

    it('rejects an unsupported grant', async () => {
      const { status, body } = await vendLocally('mint-token', { identity: 'Alice', grant: 'conversations' });
      assert.equal(status, 400);
      assert.match(body.error, /unsupported grant "conversations"/);
    });
  });

  describe('REST actions', () => {
    it('creates a Room with the type, name, and REST room options, using Basic auth', async () => {
      const { status, body } = await vendLocally('create-room', {
        name: 'my-room',
        type: 'group',
        roomOptions: { MaxParticipants: 51, TranscriptionsConfiguration: { languageCode: 'en-US' } }
      });

      assert.equal(status, 201);
      assert.deepStrictEqual(body, { sid: 'RMxxx', status: 'in-progress' });

      const [url, config] = fetchStub.firstCall.args;
      assert.equal(url, 'https://video.twilio.com/v1/Rooms');
      assert.equal(config.method, 'POST');
      assert.equal(config.headers.Authorization, `Basic ${Buffer.from(`${API_KEY_SID}:${API_KEY_SECRET}`).toString('base64')}`);
      assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(config.body)), {
        Type: 'group',
        UniqueName: 'my-room',
        MaxParticipants: '51',
        TranscriptionsConfiguration: '{"languageCode":"en-US"}'
      });
    });

    it('targets the ENVIRONMENT-specific REST host', async () => {
      process.env.ENVIRONMENT = 'stage';
      await vendLocally('get-room', { roomSid: 'RMxxx' });

      const [url, config] = fetchStub.firstCall.args;
      assert.equal(url, 'https://video.stage.twilio.com/v1/Rooms/RMxxx');
      assert.equal(config.method, 'GET');
      assert.equal(config.body, undefined);
    });

    it('encodes Room names so they stay within the Room resource path', async () => {
      await vendLocally('complete-room', { nameOrSid: '../Compositions/CJxxx' });

      const [url] = fetchStub.firstCall.args;
      assert.equal(url, 'https://video.twilio.com/v1/Rooms/..%2FCompositions%2FCJxxx');
    });

    it('passes a non-2xx REST response through with its status', async () => {
      fetchStub.resolves({ status: 404, text: () => Promise.resolve(JSON.stringify({ message: 'not found' })) });
      const { status, body } = await vendLocally('complete-room', { nameOrSid: 'RMxxx' });
      assert.equal(status, 404);
      assert.deepStrictEqual(body, { message: 'not found' });
    });

    [
      ['subscribe-track', 'subscribe'],
      ['unsubscribe-track', 'unsubscribe']
    ].forEach(([action, expectedStatus]) => {
      it(`${action} updates the participant's SubscribedTracks`, async () => {
        await vendLocally(action, { roomSid: 'RMxxx', participantSid: 'PAxxx', trackSid: 'MTxxx' });

        const [url, config] = fetchStub.firstCall.args;
        assert.equal(url, 'https://video.twilio.com/v1/Rooms/RMxxx/Participants/PAxxx/SubscribedTracks');
        assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(config.body)), { Status: expectedStatus, Track: 'MTxxx' });
      });
    });

    [
      ['start-recording', 'include'],
      ['stop-recording', 'exclude']
    ].forEach(([action, ruleType]) => {
      it(`${action} sets an "${ruleType}" all RecordingRule`, async () => {
        await vendLocally(action, { roomSid: 'RMxxx' });

        const [url, config] = fetchStub.firstCall.args;
        assert.equal(url, 'https://video.twilio.com/v1/Rooms/RMxxx/RecordingRules');
        const rules = JSON.parse(new URLSearchParams(config.body).get('Rules'));
        assert.deepStrictEqual(rules, [{ type: ruleType, all: 'true' }]);
      });
    });
  });

  it('names every missing credential and the VENDOR_URL alternative', async () => {
    delete process.env.API_KEY_SID;
    delete process.env.API_KEY_SECRET;

    const { status, body } = await vendLocally('mint-token', { identity: 'Alice', grant: 'video' });

    assert.equal(status, 500);
    assert.equal(body.error, 'localVendor: set API_KEY_SID, API_KEY_SECRET, or set VENDOR_URL to use the e2e credential vendor');
    assert(fetchStub.notCalled);
  });

  it('rejects an unsupported action', async () => {
    const { status, body } = await vendLocally('delete-room', {});
    assert.equal(status, 400);
    assert.match(body.error, /unsupported action "delete-room"/);
  });
});
