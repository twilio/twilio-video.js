import * as assert from 'assert';
import { runPreflight } from '../../../lib/preflight/preflighttest';

describe('Preflight', () => {
  it('should return a Preflight object', () => {
    const preflight = runPreflight('foo', {});
    assert(!!preflight);
  });
});
