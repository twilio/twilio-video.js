'use strict';

const credentials = require('../env');
const getOptions = require('./options');
const getToken = require('../lib/token').getToken.bind(null, credentials);
const spawn = require('child_process').spawn;
const waitForServer = require('./waitforserver');
const webdriver = require('./webdriver');

/**
 * Run a Framework Test. Selenium will be used to navigate to the Test
 * Application and ensure twilio-video.js can be used.
 * @param {FrameworkTestOptions} options
 * @returns {void}
 * @throws {Error}
 */
function runFrameworkTest(options) {
  options = getOptions(options);
  const name = options.name;
  const host = options.host;
  const port = options.port;
  const path = options.path;
  const start = options.start;

  describe(name, function() {
    this.timeout(30000);

    let server;
    let driver;
    let token;

    before(() => {
      server = spawn(start.command, start.args, {
        cwd: path,
        detached: true,
        env: Object.assign({}, start.env, process.env),
        stdio: 'ignore'
      });

      driver = webdriver.buildWebDriverForChrome();

      return waitForServer(host, port);
    });

    after(() => {
      process.kill(-server.pid);
      return driver.quit();
    });

    beforeEach(() => {
      token = getToken({ address: 'twilio-video.js-framework-test' });
      return driver.get(`http://${host}:${port}?token=${token}`);
    });

    it('Connects to and disconnects from a Room', () => {
      return waitUntilDisconnectedOrError(driver);
    });
  });
}

/**
 * Wait until the Test Application connects to and disconnects from a
 * {@link Room}.
 * @param {WebDriver} driver
 * @returns {Promise<void>}
 */
function waitUntilDisconnected(driver) {
  return webdriver.waitUntilElementLocatedAndTextMatches(driver, 'p',
    /^Disconnected from Room RM[a-f0-9]{32}\.$/);
}

/**
 * Wait until the Test Application errors.
 * @param {WebDriver} driver
 * @returns {Promise<void>}
 */
function waitUntilError(driver) {
  return webdriver.waitUntilElementLocatedAndTextMatches(driver, 'code',
    /Error/);
}

/**
 * Wait until the Test Application connects to and disconnects from a
 * {@link Room}, or errors. Successfully connecting to and disconnecting from a
 * {@link Room} resolves the Promise; an error rejects the Promise.
 * @param {WebDriver} driver
 * @returns {Promise<void>}
 */
function waitUntilDisconnectedOrError(driver) {
  return Promise.race([
    waitUntilDisconnected(driver),
    waitUntilError(driver).then(() => { throw new Error('Test Application errored'); })
  ]);
}

module.exports = runFrameworkTest;
