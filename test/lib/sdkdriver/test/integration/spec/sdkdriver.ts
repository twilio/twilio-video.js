import * as assert from 'assert';
import { join } from 'path';
import SDKDriver from '../../../src';
import TestDriver from '../../../src/testdriver';
import BrowserDriver from '../../../src/testdriver/browser';
import WSServerTransport from '../../../src/transport/websocket/server';

describe('SDKDriver', function() {
  this.timeout(60000);

  ['chrome', 'firefox'].forEach(browser => {
    describe(browser, () => {
      context('should create the BrowserDriver and start the web server', () => {
        const version = '1.6.0';
        const sdkUrl = `//sdk.twilio.com/js/video/releases/${version}/twilio-video.js`;
        let browserDriver: TestDriver;

        before(async () => {
          const webServerRoot: string = join(__dirname, '..', 'browser');
          browserDriver = new BrowserDriver(browser, webServerRoot, [sdkUrl]);
        });

        context('should create the WSServerTransport', () => {
          let transport: WSServerTransport;

          before(() => {
            transport = new WSServerTransport(browserDriver.webServer);
          });

          context('should create an SDKDriver with the WSServerTransport and the BrowserDriver', () => {
            let sdkDriver: SDKDriver;

            before(async () => {
              sdkDriver = await SDKDriver.create(transport, browserDriver);
            });

            it(`should load the SDK from the specified URL in ${browser}`, async () => {
              const { sdkVersion } = await sdkDriver.sendRequest({ type: 'sdkVersion' });
              assert.equal(sdkVersion, version);
            });

            after(() => {
              sdkDriver.close();
            });
          });
        });
      });
    });
  });
});
