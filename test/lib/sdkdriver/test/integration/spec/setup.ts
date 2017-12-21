import * as assert from 'assert';
import DMP from '../../../src/dmp';
import TestDriver from '../../../src/testdriver';
import BrowserDriver from '../../../src/testdriver/browser';
import WSServerTransport from '../../../src/transport/websocket/server';

describe('setup', function() {
  this.timeout(60000);

  ['chrome', 'firefox'].forEach(browser => {
    describe(browser, () => {
      context('should start the web server and', () => {
        const version = '1.6.0';
        const sdkUrl = `//media.twiliocdn.com/sdk/js/video/releases/${version}/twilio-video.js`;
        let browserDriver: TestDriver;

        before(async () => {
          browserDriver = new BrowserDriver(browser, sdkUrl);
          await browserDriver.startWebServer();
        });

        context('start the WSServerTransport and', () => {
          let transport: WSServerTransport;
          let transportOpenPromise: Promise<void>;

          before(() => {
            transport = new WSServerTransport(browserDriver.webServer);
            transportOpenPromise = transport.open();
          });

          context(`open ${browser} and connect a client DMP module with the server DMP module and`, () => {
            let dmp: DMP;

            before(async () => {
              await Promise.all([
                transportOpenPromise,
                browserDriver.open()
              ]);
              dmp = new DMP(transport);
            });

            it(`${browser} should load the SDK from the specified URL`, async () => {
              const { sdkVersion } = await new Promise(resolve => dmp.once('event', resolve));
              assert.equal(sdkVersion, version);
            });

            it('the WSClientTransport and WSServerTransport should exchange messages', async () => {
              const { pong } = await dmp.sendRequest({ ping: 'foo' });
              assert.equal(pong, 'foo');
            });

            after(() => {
              browserDriver.close();
              dmp.close();
            });
          });
        });

        after(() => {
          browserDriver.stopWebServer();
        });
      });
    });
  });
});
