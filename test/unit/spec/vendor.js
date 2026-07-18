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
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(JSON.parse(body))
    };
  }

  beforeEach(() => {
    fetchStub = sinon.stub(global, 'fetch');
    fetchStub.withArgs('/mint-vendor-token').resolves(fakeResponse(200, JSON.stringify({ token: 'fake-oidc-token' })));

    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../env')];
    process.env.VENDOR_URL = 'https://vendor.example.test/vend';
    process.env.ACCOUNT_SID = 'ACxxx';
    process.env.API_KEY_SID = 'SKxxx';
    callVendor = require('../../lib/vendor');
  });

  afterEach(() => {
    fetchStub.restore();
    delete process.env.VENDOR_URL;
    delete process.env.ACCOUNT_SID;
    delete process.env.API_KEY_SID;
  });

  it('POSTs the action and params as a JSON body to VENDOR_URL with a Bearer Authorization header', async () => {
    fetchStub.withArgs('https://vendor.example.test/vend').resolves(fakeResponse(200, JSON.stringify({ token: 'fake-jwt' })));

    const result = await callVendor('mint-token', { identity: 'Alice' });
    assert.equal(result.token, 'fake-jwt');

    const [url, config] = fetchStub.withArgs('https://vendor.example.test/vend').firstCall.args;
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

    fetchStub.withArgs('https://vendor.example.test/vend').resolves(fakeResponse(200, JSON.stringify({ token: 'fake-jwt' })));
    await callVendorStage('mint-token', { identity: 'Alice' });

    const [, config] = fetchStub.withArgs('https://vendor.example.test/vend').firstCall.args;
    const body = JSON.parse(config.body);
    assert.equal(body.environment, 'stage');
    delete process.env.ENVIRONMENT;
  });

  it('rejects when the Function returns a non-2xx status', async () => {
    fetchStub.withArgs('https://vendor.example.test/vend').resolves(fakeResponse(401, JSON.stringify({ error: 'invalid OIDC claim' })));

    await assert.rejects(callVendor('mint-token', { identity: 'Alice' }), /invalid OIDC claim/);
  });

  it('rejects when VENDOR_URL is not set', async () => {
    delete process.env.VENDOR_URL;
    delete require.cache[require.resolve('../../lib/vendor')];
    delete require.cache[require.resolve('../../env')];
    const callVendorNoUrl = require('../../lib/vendor');
    await assert.rejects(callVendorNoUrl('mint-token', {}), /VENDOR_URL/);
  });

  it('rejects when minting a vendor token fails', async () => {
    fetchStub.withArgs('/mint-vendor-token').resolves(fakeResponse(500, JSON.stringify({ error: 'no runner OIDC token available' })));

    await assert.rejects(callVendor('mint-token', { identity: 'Alice' }), /no runner OIDC token available/);
  });

  describe('token refresh', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
      fetchStub.withArgs('https://vendor.example.test/vend').resolves(fakeResponse(200, JSON.stringify({ token: 'fake-jwt' })));
    });

    afterEach(() => {
      clock.restore();
    });

    it('reuses the cached token for calls made within its max age', async () => {
      await callVendor('mint-token', { identity: 'Alice' });
      clock.tick(60 * 1000);
      await callVendor('mint-token', { identity: 'Bob' });

      assert.equal(fetchStub.withArgs('/mint-vendor-token').callCount, 1);
    });

    it('mints a fresh token once the cached one exceeds its max age', async () => {
      fetchStub.withArgs('/mint-vendor-token').onSecondCall().resolves(fakeResponse(200, JSON.stringify({ token: 'refreshed-token' })));

      await callVendor('mint-token', { identity: 'Alice' });
      clock.tick(5 * 60 * 1000);
      await callVendor('mint-token', { identity: 'Bob' });

      const vendorCalls = fetchStub.withArgs('https://vendor.example.test/vend').getCalls();
      assert.equal(vendorCalls[0].args[1].headers.Authorization, 'Bearer fake-oidc-token');
      assert.equal(vendorCalls[1].args[1].headers.Authorization, 'Bearer refreshed-token');
    });
  });
});
