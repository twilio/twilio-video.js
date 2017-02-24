'use strict';

/**
 * @typedef {object} FrameworkTestOptions
 * @property {string} name - the name of the Framework Test
 * @property {string} path - the path to the Framework Test
 * @property {string} [host="localhost"] - the HTTP server host that serves the Test Application
 * @property {number} [port=3000] - the HTTP server port that serves the Test Application
 * @property {number} [timeout=120000] - the duration in milliseconds a Framework Test is allowed to run before "timing out"
 * @property {FrameworkTestCommandOptions} [start] - options for starting the Test Application (defaults to "npm start")
 * @property {FrameworkTestCommandOptions} [test] - options for testing the Test Application (defaults to "npm test")
 */

/**
 * @typedef {object} FrameworkTestCommandOptions
 * @property {string} [command="npm"] - the command to run
 * @property {Array<string>} [args=["start"]] - arguments to the command
 * @property {Object<string, boolean|number|string>} [env={}] - additional environment variables
 */

/**
 * Get {@link FrameworkTestOptions}.
 * @param {object} options
 * @returns {FrameworkTestOptions}
 * @throws {Error}
 */
function getOptions(options) {
  options = Object.assign({}, {
    host: 'localhost',
    port: 3000,
    timeout: 120000,
    start: {},
    test: {}
  }, options);

  if (!options.name) {
    throw new Error('name is required');
  } else if (!options.path) {
    throw new Error('path is required');
  }

  options.start = Object.assign({}, {
    command: 'npm',
    args: ['start'],
    env: {}
  }, options.start);

  options.test = Object.assign({}, {
    command: 'npm',
    args: ['test'],
    env: {}
  }, options.test);

  return options;
}

module.exports = getOptions;
