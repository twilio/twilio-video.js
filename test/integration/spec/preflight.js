'use strict';

const assert = require('assert');
const runPreflight = require('../../../es5/index').runPreflight;
const getToken = require('../../lib/token');
const defaults = require('../../lib/defaults');
const { randomName } = require('../../lib/util');
const { isSafari } = require('../../lib/guessbrowser');

const expectedProgress = [
  'mediaAcquired',
  'connected',
  'mediaSubscribed',
  'iceConnected',
  'mediaStarted',
  'peerConnectionConnected'
];

if (!isSafari) {
  expectedProgress.push('dtlsConnected');
}

function assertProgressEvents(progressEvents) {
  progressEvents.forEach(({ duration, name }) => {
    assert.strictEqual(typeof duration, 'number');
    assert(expectedProgress.includes(name));
  });
}

function assertTimeMeasurement(measurement) {
  assert.equal(typeof measurement.duration, 'number');
}

function assertStat(stat, statName) {
  assert.strictEqual(typeof stat.min, 'number', `wrong typeof stat.min: ${typeof stat.min} for ${statName}`);
  assert.strictEqual(typeof stat.max, 'number', `wrong typeof stat.max: ${typeof stat.max} for ${statName}`);
  assert.strictEqual(typeof stat.average, 'number', `wrong typeof stat.average: ${typeof stat.average} for ${statName}`);
}

function assertIceCandidate(candidate) {
  assert.strictEqual(typeof candidate.address, 'string', `candidate.address=${typeof candidate.address}`);
  assert.strictEqual(typeof candidate.port, 'number', `candidate.port=${typeof candidate.port}`);
  assert.strictEqual(typeof candidate.candidateType, 'string', `candidate.candidateType=${typeof candidate.candidateType}`);
}

function validateReport(report)  {
  console.log('report: ', JSON.stringify(report, null, 4));
  assertTimeMeasurement(report.testTiming);
  assertTimeMeasurement(report.networkTiming.connect);
  assertTimeMeasurement(report.networkTiming.media);
  assertStat(report.stats.jitter, 'jitter');
  assertStat(report.stats.rtt, 'rtt');
  assertStat(report.stats.packetLoss, 'packetLoss');
  assertIceCandidate(report.selectedIceCandidatePairStats.localCandidate);
  assertIceCandidate(report.selectedIceCandidatePairStats.remoteCandidate);
  assert(report.iceCandidateStats.length > 0);
  assertProgressEvents(report.progressEvents);
  report.iceCandidateStats.forEach(iceCandidate => assertIceCandidate(iceCandidate));
}

describe('preflight', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  let token;
  beforeEach(() => {
    token = getToken(randomName(), {});
  });

  it('completes and generates test report', async () => {
    const environment = defaults.environment;
    const options = { environment };
    const preflight = runPreflight(token, options);
    const deferred = {};
    const progressReceived = [];
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    preflight.on('completed', report => {
      validateReport(report);

      assert.deepStrictEqual(expectedProgress.sort(), progressReceived.sort());
      deferred.resolve();
    });

    preflight.on('progress', progress => {
      console.log('progress:', progress);
      progressReceived.push(progress);
    });

    preflight.on('failed', error => {
      console.log('failed:', error);
      deferred.reject(error);
    });

    preflight.on('warning', (name, text) => {
      console.log('warning:', name, text);
    });

    await deferred.promise;
  });

  it('fails when bad token is supplied', async () => {
    let errorResult;
    let reportResult;

    const preflight = runPreflight('badToken');
    const deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    preflight.on('completed', () => {
      deferred.reject('preflight completed unexpectedly');
    });

    preflight.on('failed', (error, report) => {
      console.log('preflight failed as expected:', error);
      errorResult = error;
      reportResult = report;
      deferred.resolve();
    });

    await deferred.promise;

    assert.strictEqual(errorResult.toString(), 'TwilioError 20101: Invalid Access Token');
    assert.strictEqual(typeof reportResult, 'object');
  });
});

