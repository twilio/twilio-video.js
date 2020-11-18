/* eslint-disable no-console, no-undefined */
'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { Logger } = require('../../../lib');
const defaults = require('../../lib/defaults');
const connect = require('../../../lib/connect');
const getToken = require('../../lib/token');
const { createRoom } = require('../../lib/rest');
const { randomName } = require('../../lib/util');

describe('logger', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  const DEFAULT_LOGGER_NAME = 'twilio-video';

  let logger;
  let loggerCb;
  let sid;
  let token;

  const loadPlugin = (loggerName, showLogs) => {
    loggerCb = sinon.spy();
    loggerName = loggerName || DEFAULT_LOGGER_NAME;

    // Reset logger module cache
    const loggers = Logger.getLoggers();
    Object.keys(loggers).forEach(name => delete loggers[name]);

    logger = Logger.getLogger(loggerName);
    const originalFactory = logger.methodFactory;
    logger.methodFactory = function(methodName, level, loggerName) {
      const method = originalFactory(methodName, level, loggerName);
      return function(datetime, logLevel, component, message, data) {
        loggerCb({ datetime, logLevel, component, message, data });
        if (showLogs) {
          method(...arguments);
        }
      };
    };
    logger.setLevel('info');
  };

  beforeEach(async () => {
    const identity = randomName();
    token = getToken(identity);
    sid = await createRoom(randomName(), defaults.topology);
    loadPlugin();
  });

  it('should initialize logger using default logger name', async () => {
    await connect(token, Object.assign({ name: sid }, defaults));
    sinon.assert.called(loggerCb);
  });

  it('should initialize logger using custom logger name', async () => {
    loadPlugin('my-logger');
    await connect(token, Object.assign({ name: sid, loggerName: 'my-logger' }, defaults));
    sinon.assert.called(loggerCb);
  });

  it('should initialize loggers for each individual components', async () => {
    await connect(token, Object.assign({ name: sid, logLevel: {
      default: 'error',
      media: 'warn',
    } }, defaults));

    assert(!!Logger.getLogger(DEFAULT_LOGGER_NAME + '-default'));
    assert(!!Logger.getLogger(DEFAULT_LOGGER_NAME + '-media'));
  });

  it('should provide required arguments via the plugin', async () => {
    await connect(token, Object.assign({ name: sid }, defaults));
    const callSpies = loggerCb.getCalls();
    assert(!!callSpies.length);
    callSpies.forEach(callSpy => {
      ['datetime', 'logLevel', 'component', 'message'].forEach(argName => {
        assert(!!callSpy.args[0]);
        assert(!!callSpy.args[0][argName]);
      });
    });
  });

  it('should provide optional data via the plugin', async () => {
    const room = await connect(token, Object.assign({ name: sid }, defaults));
    const callSpies = loggerCb.getCalls();
    assert(!!callSpies.length);

    let loggedRoomName;
    callSpies.forEach(callSpy => {
      const { message, data } = callSpy.args[0];
      if (message === 'Room name:') {
        loggedRoomName = data;
      }
    });

    assert.equal(room.name, loggedRoomName);
  });
});
