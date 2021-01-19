'use strict';

const getOptions = require('./options');
const getToken = require('../lib/token');
const { spawn } = require('child_process');
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
  const timeout = options.timeout;

  describe(name, function() {
    // eslint-disable-next-line no-invalid-this
    this.timeout(timeout);

    let server;
    let driver;
    let token;
    let environment;

    before(() => {
      server = spawn(start.command, start.args, {
        cwd: path,
        detached: true,
        // eslint-disable-next-line no-process-env
        env: Object.assign({}, start.env, process.env),
        stdio: 'inherit'
      });

      // NOTE(mroberts): Always test with Chrome until we can fix Firefox.
      // driver = process.env.BROWSER === 'firefox'
      //   ? webdriver.buildWebDriverForFirefox()
      //   : webdriver.buildWebDriverForChrome();
      driver = webdriver.buildWebDriverForChrome();

      return waitForServer(host, port, timeout);
    });

    after(() => {
      process.kill(-server.pid);
      return driver.quit();
    });

    beforeEach(() => {
      token = getToken('twilio-video.js-framework-test');
      // eslint-disable-next-line no-process-env
      environment = process.env.ENVIRONMENT;

      if (environment && environment !== 'prod') {
        return driver.get(`http://${host}:${port}?token=${token}&environment=${environment}`);
      }
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
    waitUntilError(driver).then(ex => {
      ex.getText().then(text => {
        // eslint-disable-next-line no-console
        console.log('Selenium Object', text);
      });
      throw new Error('Test Application errored: ' + ex);
    })
    // waitUntilError(driver).then(ex => { throw new Error('Test Application errored: ' + ex); })
  ]);
}

module.exports = runFrameworkTest;
