/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const runPreflight = require('../../../es5/index').runPreflight;
const getToken = require('../../lib/token');
const defaults = require('../../lib/defaults');
const { randomName } = require('../../lib/util');
const { isFirefox, isSafari } = require('../../lib/guessbrowser');

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
  assertTimeMeasurement(report.testTiming);
  assertTimeMeasurement(report.networkTiming.connect);
  assertTimeMeasurement(report.networkTiming.media);
  assertStat(report.stats.jitter, 'jitter');
  assertStat(report.stats.rtt, 'rtt');
  assertStat(report.stats.packetLoss, 'packetLoss');
  assertIceCandidate(report.selectedIceCandidatePairStats.localCandidate);
  assertIceCandidate(report.selectedIceCandidatePairStats.remoteCandidate);
  assert(report.iceCandidateStats.length > 0);
  report.iceCandidateStats.forEach(iceCandidate => assertIceCandidate(iceCandidate));
}

describe('preflight', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  let token;
  beforeEach(() => {
    token = getToken(randomName(), {});
  });

  it('completes and generates test report', () => new Promise((resolve, reject) => {
    const { environment } = defaults;
    const options = { environment };
    const preflight = runPreflight(token, options);
    const progressReceived = [];

    preflight.on('completed', report => {
      validateReport(report);
      const expectedProgress = [
        'mediaAcquired',
        'connected',
        'mediaSubscribed',
        'iceConnected',
        'mediaStarted'
      ];
      if (!isFirefox) {
        expectedProgress.push('peerConnectionConnected');
      }
      if (!isSafari) {
        expectedProgress.push('dtlsConnected');
      }

      assert.deepStrictEqual(expectedProgress.sort(), progressReceived.sort());
      resolve();
    });

    preflight.on('progress', progress => progressReceived.push(progress));
    preflight.on('failed', reject);

    preflight.on('warning', (name, text) => {
      // eslint-disable-next-line no-console
      console.warn('warning:', name, text);
    });
  }));

  it('fails when bad token is supplied', () => new Promise((resolve, reject) => {
    const preflight = runPreflight('badToken');
    preflight.on('completed', () => reject('preflight completed unexpectedly'));
    preflight.on('failed', resolve);
  }));
});

