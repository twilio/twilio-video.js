'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const credentials = require('../../env');
const getToken = require('../../lib/token').getToken.bind(null, credentials);
const logLevel = credentials.logLevel;
const randomName = require('../../lib/util').randomName;
const wsServer = credentials.wsServer;

describe('connect', function() {
  this.timeout(30000);

  let aliceName;
  let aliceToken;
  let bobName;
  let bobToken;
  let charlieName;
  let charlieToken;
  let bobRoom;
  let charlieRoom;
  let options;

  beforeEach(() => {
    aliceName = randomName();
    aliceToken = getToken({ address: aliceName });
    bobName = randomName();
    bobToken = getToken({ address: bobName });
    charlieName = randomName();
    charlieToken = getToken({ address: charlieName });

    options = {
      debug: false
    };

    if (wsServer) {
      options.wsServer = wsServer;
    }

    if (logLevel) {
      options.logLevel = logLevel;
    }
  });

  it('should reject if logLevel is invalid', async () => {
    try {
      await connect(aliceToken, { logLevel: 'foo' });
    } catch (error) {
      assert(error instanceof RangeError);
      assert(/level must be one of/.test(error.message));
      return;
    }
    throw new Error('Unexpectedly resolved!');
  });

  it('should be cancelable', async () => {
    const cancelablePromise = connect(aliceToken, options);
    try {
      await cancelablePromise.cancel();
    } catch (error) {
      return;
    }
    throw new Error('Unexpectedly resolved');
  });

  context('when called without a Room name', () => {
    it('should connect bob and charlie to different Rooms', async () => {
      bobRoom = await connect(bobToken, options);
      charlieRoom = await connect(charlieToken);
      assert.notEqual(charlieRoom.sid, bobRoom.sid);
    });
  });

  context('when called with the same Room name', () => {
    it('should connect bob and charlie to the same Room', async () => {
      const name = randomName();
      bobRoom = await connect(bobToken, Object.assign({ name }, options));
      charlieRoom = await connect(charlieToken, Object.assign({ name }, options));
      assert.equal(charlieRoom.sid, bobRoom.sid);
    });
  });

  afterEach(() => {
    if (bobRoom) {
      bobRoom.disconnect();
    }

    if (charlieRoom) {
      charlieRoom.disconnect();
    }
  });
});
