/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const testPreflight = require('../../../lib/preflight/preflight');
const getToken = require('../../lib/token');
const defaults = require('../../lib/defaults');
const { createRoom, completeRoom } = require('../../lib/rest');
const { randomName } = require('../../lib/util');


function assertTimeMeasurement(measurement) {
  assert.equal(typeof measurement.duration, 'number');
}

function assertStat(stat, statName) {
  if (!stat) {
    // eslint-disable-next-line no-console
    console.log(`${statName} is ${stat}`);
  } else {
    assert.equal(typeof stat.min, 'number');
    assert.equal(typeof stat.max, 'number');
    assert.equal(typeof stat.average, 'number');
  }
}

function assertIceCandidate(candidate) {
  assert.equal(typeof candidate.ip, 'string');
  assert.equal(typeof candidate.port, 'number');
  assert.equal(typeof candidate.candidateType, 'string');
}

function validateReport(report)  {
  // eslint-disable-next-line no-console
  console.log('report: ', JSON.stringify(report, null, 4));
  assert.equal(typeof report.signalingRegion, 'string');
  assertTimeMeasurement(report.testTiming);
  assertTimeMeasurement(report.networkTiming.connect);
  assertTimeMeasurement(report.networkTiming.media);
  assertStat(report.stats.jitter, 'jitter');
  assertStat(report.stats.rtt, 'rtt');
  assertStat(report.stats.outgoingBitrate, 'outgoingBitrate');
  assertStat(report.stats.incomingBitrate, 'incomingBitrate');
  assertStat(report.stats.packetLoss);
  assertIceCandidate(report.selectedIceCandidatePairStats.localCandidate);
  assertIceCandidate(report.selectedIceCandidatePairStats.remoteCandidate);
  assert.equal(typeof report.isTurnRequired, 'boolean');
  if (defaults.topology === 'peer-to-peer') {
    assert.equal(report.stats.networkQuality, null);
    assert.equal(report.mediaRegion, null);

  } else {
    assert.equal(typeof report.mediaRegion, 'string');
    assertStat(report.stats.networkQuality);
  }
}

describe('preflight', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  let aliceToken;
  let bobToken;
  let roomSid;
  beforeEach(async () => {
    const roomName = 'preflight_' + randomName();
    roomSid = await createRoom(roomName, defaults.topology);
    ([aliceToken, bobToken] = ['alice', 'bob'].map(identity => getToken(identity, { room: roomSid })));
  });
  afterEach(async () => {
    await completeRoom(roomSid);
  });

  it('completes and generates test report', async () => {
    const environment = defaults.environment;
    const options = { environment };
    const preflight = testPreflight(aliceToken, bobToken, options);
    const deferred = {};
    const progressReceived = [];
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    preflight.on('completed', report => {
      assert.equal(report.roomSid, roomSid);
      validateReport(report);
      assert.deepEqual(progressReceived, [
        'mediaAcquired',
        'connected',
        'remoteConnected',
        'mediaPublished',
        'mediaSubscribed',
        'mediaStarted'
      ]);
      deferred.resolve();
    });

    preflight.on('progress', progress => {
      // eslint-disable-next-line no-console
      console.log('progress:', progress);
      progressReceived.push(progress);
    });

    preflight.on('failed', error => {
      // eslint-disable-next-line no-console
      console.log('failed:', error);
      deferred.reject(error);
    });

    preflight.on('warning', (name, text) => {
      // eslint-disable-next-line no-console
      console.log('warning:', name, text);
    });

    await deferred.promise;
  });

  it('fails when same token is supplied for subscriber and publisher', async () => {
    const preflight = testPreflight(aliceToken, aliceToken);
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    preflight.on('completed', () => {
      deferred.reject('preflight completed unexpectedly');
    });

    preflight.on('failed', error => {
      // eslint-disable-next-line no-console
      console.log('preflight failed as expected:', error);
      deferred.resolve();
    });

    await deferred.promise;
  });

  it('fails when bad token is supplied', async () => {
    const preflight = testPreflight(aliceToken, 'badToken');
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    preflight.on('completed', () => {
      deferred.reject('preflight completed unexpectedly');
    });

    preflight.on('failed', error => {
      // eslint-disable-next-line no-console
      console.log('preflight failed as expected:', error);
      deferred.resolve();
    });

    await deferred.promise;
  });
});

