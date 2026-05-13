import * as assert from 'assert';
import { extractEdgeFromIceServers } from '../../../lib/preflight/getturncredentials';

describe('extractEdgeFromIceServers', () => {
  it('returns undefined for empty array', () => {
    assert.strictEqual(extractEdgeFromIceServers([]), undefined);
  });

  it('extracts hostname prefix from a turn: URL string', () => {
    assert.strictEqual(extractEdgeFromIceServers([
      { urls: 'turn:ashburn.turn.twilio.com:3478?transport=udp' }
    ]), 'ashburn');
  });

  it('extracts hostname prefix from a turns: URL string', () => {
    assert.strictEqual(extractEdgeFromIceServers([
      { urls: 'turns:dublin.turn.twilio.com:443?transport=tcp' }
    ]), 'dublin');
  });

  it('uses the first entry when multiple ice servers are provided', () => {
    assert.strictEqual(extractEdgeFromIceServers([
      { urls: 'turn:ashburn.turn.twilio.com:3478?transport=udp' },
      { urls: 'turns:ashburn.turn.twilio.com:443?transport=tcp' }
    ]), 'ashburn');
  });

  it('handles urls as an array', () => {
    assert.strictEqual(extractEdgeFromIceServers([
      { urls: ['turn:singapore.turn.twilio.com:3478?transport=udp', 'turns:singapore.turn.twilio.com:443?transport=tcp'] }
    ]), 'singapore');
  });

  it('returns undefined when urls is an empty array', () => {
    assert.strictEqual(extractEdgeFromIceServers([{ urls: [] }]), undefined);
  });
});
