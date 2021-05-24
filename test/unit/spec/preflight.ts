import * as assert from 'assert';
import { Preflight } from '../../../lib/preflight';

describe('Preflight', () => {
  it('should return a Preflight object', () => {
    const preflight = new Preflight();
    assert(!!preflight);
  });
});
