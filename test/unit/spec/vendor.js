'use strict';

const assert = require('assert');
const sinon = require('sinon');

describe('callVendor', () => {
  let callVendor;
  let fetchStub;

  function fakeResponse(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body)
    };
  }

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');

    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../env')];
    process.env.VENDOR_URL = 'https://vendor.example.test/vend';
    process.env.VENDOR_TOKEN = 'fake-oidc-token';
    process.env.ACCOUNT_SID = 'ACxxx';
    process.env.API_KEY_SID = 'SKxxx';
    callVendor = require('../../lib/vendor');
  });

  afterEach(() => {
    fetchStub.restore();
    delete process.env.VENDOR_URL;
    delete process.env.VENDOR_TOKEN;
    delete process.env.ACCOUNT_SID;
    delete process.env.API_KEY_SID;
  });

  it('POSTs the action and params as a JSON body to VENDOR_URL with a Bearer Authorization header', async () => {
    fetchStub.resolves(fakeResponse(200, JSON.stringify({ token: 'fake-jwt' })));

    const result = await callVendor('mint-token', { identity: 'Alice' });
    assert.equal(result.token, 'fake-jwt');

    assert.equal(fetchStub.callCount, 1);
    const [url, config] = fetchStub.firstCall.args;
    assert.equal(url, 'https://vendor.example.test/vend');
    assert.equal(config.method, 'POST');
    assert.equal(config.headers.Authorization, 'Bearer fake-oidc-token');
    assert.equal(config.headers['Content-Type'], 'application/json');

    const body = JSON.parse(config.body);
    assert.deepStrictEqual(body, { action: 'mint-token', environment: 'prod', identity: 'Alice' });
  });

  it('sends the ENVIRONMENT env var as the environment field', async () => {
    process.env.ENVIRONMENT = 'stage';
    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../lib/defaults')];
    delete require.cache[require.resolve('../../env')];
    const callVendorStage = require('../../lib/vendor');

    fetchStub.resolves(fakeResponse(200, JSON.stringify({ token: 'fake-jwt' })));
    await callVendorStage('mint-token', { identity: 'Alice' });

    const [, config] = fetchStub.firstCall.args;
    const body = JSON.parse(config.body);
    assert.equal(body.environment, 'stage');
    delete process.env.ENVIRONMENT;
  });

  it('rejects when the Function returns a non-2xx status', async () => {
    fetchStub.resolves(fakeResponse(401, JSON.stringify({ error: 'invalid OIDC claim' })));

    await assert.rejects(callVendor('mint-token', { identity: 'Alice' }), /invalid OIDC claim/);
  });

  it('rejects when VENDOR_URL is not set', async () => {
    delete process.env.VENDOR_URL;
    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../env')];
    const callVendorNoUrl = require('../../lib/vendor');
    await assert.rejects(callVendorNoUrl('mint-token', {}), /VENDOR_URL/);
  });
});
