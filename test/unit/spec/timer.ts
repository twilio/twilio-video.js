import assert from 'assert';
import { Timer } from '../../../lib/preflight/timer';

describe('Timer', () => {
  it('should use start time at construction', () => {
    const timer = new Timer();
    timer.stop();
    const timeMeasurement = timer.getTimeMeasurement();
    assert.strictEqual(typeof timeMeasurement.start, 'number');
    assert.strictEqual(typeof timeMeasurement.end, 'number');
    assert.strictEqual(typeof timeMeasurement.duration, 'number');
  });

  it('returns undefined duration if not stopped', () => {
    const timer = new Timer();
    const timeMeasurement = timer.getTimeMeasurement();
    assert.strictEqual(typeof timeMeasurement.start, 'number');
    assert.strictEqual(typeof timeMeasurement.end, 'undefined');
    assert.strictEqual(typeof timeMeasurement.duration, 'undefined');
  });
});
