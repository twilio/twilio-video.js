'use strict';

const assert = require('assert');
const sinon = require('sinon');
const https = require('https');
const { EventEmitter } = require('events');

describe('callVendor', () => {
  let callVendor;
  let requestStub;
  let fakeRequest;
  let fakeResponse;

  beforeEach(() => {
    fakeRequest = new EventEmitter();
    fakeRequest.write = sinon.stub();
    fakeRequest.end = sinon.stub();

    fakeResponse = new EventEmitter();
    fakeResponse.setEncoding = sinon.stub();

    requestStub = sinon.stub(https, 'request').callsFake((config, callback) => {
      callback(fakeResponse);
      return fakeRequest;
    });

    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../env')];
    process.env.VENDOR_URL = 'https://vendor.example.test/vend';
    process.env.VENDOR_TOKEN = 'fake-oidc-token';
    process.env.ACCOUNT_SID = 'ACxxx';
    process.env.API_KEY_SID = 'SKxxx';
    // eslint-disable-next-line global-require
    callVendor = require('../../lib/vendor');
  });

  afterEach(() => {
    requestStub.restore();
    delete process.env.VENDOR_URL;
    delete process.env.VENDOR_TOKEN;
    delete process.env.ACCOUNT_SID;
    delete process.env.API_KEY_SID;
  });

  it('POSTs the action and params as a JSON body to VENDOR_URL with a Bearer Authorization header', async () => {
    fakeResponse.statusCode = 200;
    const promise = callVendor('mint-token', { identity: 'Alice' });
    fakeResponse.emit('data', JSON.stringify({ token: 'fake-jwt' }));
    fakeResponse.emit('end');

    const result = await promise;
    assert.equal(result.token, 'fake-jwt');

    assert.equal(requestStub.callCount, 1);
    const [config] = requestStub.firstCall.args;
    assert.equal(config.method, 'POST');
    assert.equal(config.hostname, 'vendor.example.test');
    assert.equal(config.path, '/vend');
    assert.equal(config.headers.Authorization, 'Bearer fake-oidc-token');
    assert.equal(config.headers['Content-Type'], 'application/json');

    const body = JSON.parse(fakeRequest.write.firstCall.args[0]);
    assert.deepStrictEqual(body, { action: 'mint-token', identity: 'Alice' });
  });

  it('rejects when the Function returns a non-2xx status', async () => {
    fakeResponse.statusCode = 401;
    const promise = callVendor('mint-token', { identity: 'Alice' });
    fakeResponse.emit('data', JSON.stringify({ error: 'invalid OIDC claim' }));
    fakeResponse.emit('end');

    await assert.rejects(promise, /invalid OIDC claim/);
  });

  it('rejects when VENDOR_URL is not set', async () => {
    delete process.env.VENDOR_URL;
    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../env')];
    // eslint-disable-next-line global-require
    const callVendorNoUrl = require('../../lib/vendor');
    await assert.rejects(callVendorNoUrl('mint-token', {}), /VENDOR_URL/);
  });
});
