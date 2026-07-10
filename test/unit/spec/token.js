'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');

describe('getToken', () => {
  let getToken;
  let vendorStub;

  beforeEach(() => {
    vendorStub = sinon.stub().resolves({ token: 'fake-jwt' });
    mock('../../lib/vendor', vendorStub);
    delete require.cache[require.resolve('../../lib/token')];
    // eslint-disable-next-line global-require
    getToken = require('../../lib/token');
  });

  afterEach(() => {
    mock.stopAll();
    delete require.cache[require.resolve('../../lib/token')];
  });

  it('resolves with the Access Token returned by the vendor Function', async () => {
    const token = await getToken('Alice');
    assert.equal(token, 'fake-jwt');
  });

  it('passes identity, grant, room, and ttl through to the vendor call', async () => {
    await getToken('Alice', { room: 'my-room', grant: 'video', ttl: 5000 });
    const [action, params] = vendorStub.firstCall.args;
    assert.equal(action, 'mint-token');
    assert.deepStrictEqual(params, {
      identity: 'Alice',
      room: 'my-room',
      grant: 'video',
      ttl: 5000
    });
  });

  it('applies default grant "video" and ttl 60000 when not specified', async () => {
    await getToken('Alice');
    const [, params] = vendorStub.firstCall.args;
    assert.equal(params.grant, 'video');
    assert.equal(params.ttl, 60000);
  });
});
