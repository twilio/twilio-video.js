/* eslint-disable no-console, no-undefined */
'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { Logger } = require('../../../es5');
const defaults = require('../../lib/defaults');
const defaultConnect = require('../../../es5').connect;
const getToken = require('../../lib/token');
const { createRoom, completeRoom } = require('../../lib/rest');
const { randomName } = require('../../lib/util');

describe('logger', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  let connectCount = 0;
  const DEFAULT_LOGGER_NAME = 'twilio-video';
  const consoleMethods = ['debug', 'info', 'warn', 'error', 'log'];

  const connect = (...args) => {
    connectCount++;
    return defaultConnect(...args);
  };

  let logger;
  let loggerCb;
  let room;
  let sid;
  let token;

  const loadPlugin = (loggerName, useDefaultLevel) => {
    loggerCb = sinon.spy();
    loggerName = loggerName || DEFAULT_LOGGER_NAME;

    logger = Logger.getLogger(loggerName);
    const originalFactory = logger.methodFactory;
    logger.methodFactory = function(methodName, level, loggerName) {
      const method = originalFactory(methodName, level, loggerName);
      return function(datetime, logLevel, component, message, data) {
        loggerCb({ datetime, logLevel, component, message, data });

        // Decorate the logs by prefixing with the loggerName
        method(loggerName, datetime, logLevel, component, message, data);
      };
    };
    if (!useDefaultLevel) {
      logger.setLevel('info');
    }
  };

  beforeEach(async () => {
    const identity = randomName();
    token = getToken(identity);
    sid = await createRoom(randomName(), defaults.topology);
    consoleMethods.forEach(method => sinon.stub(console, method));
    loadPlugin();
  });

  afterEach(async () => {
    if (room) {
      room.disconnect();
    }
    room = null;
    await completeRoom(sid);

    // Reset logger module cache
    const loggers = Logger.getLoggers();
    Object.keys(loggers).forEach(name => {
      delete loggers[name];
      localStorage.removeItem('loglevel:' + name);
    });

    consoleMethods.forEach(method => console[method].restore());
  });

  it('should initialize logger using default logger name', async () => {
    room = await connect(token, Object.assign({ name: sid }, defaults));
    sinon.assert.called(loggerCb);
  });

  it('should initialize logger using custom logger name', async () => {
    loadPlugin('my-logger');
    room = await connect(token, Object.assign({ name: sid, loggerName: 'my-logger' }, defaults));
    sinon.assert.called(loggerCb);
  });

  it('should provide required arguments via the plugin', async () => {
    room = await connect(token, Object.assign({ name: sid }, defaults));
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
    room = await connect(token, Object.assign({ name: sid }, defaults));
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

  it('should log signaling events', async () => {
    room = await connect(token, Object.assign({ name: sid }, defaults));
    room.disconnect();

    const callSpies = loggerCb.getCalls();
    assert(!!callSpies.length);

    // ensure that signaling events were fired for early/connecting/open events.
    let early = false;
    let connecting = false;
    let open = false;
    let closed = false;
    callSpies.forEach(callSpy => {
      const { message, data } = callSpy.args[0];
      if (message === 'event' && data.group === 'signaling') {
        assert(typeof data.elapsedTime === 'number');
        assert(typeof data.timestamp === 'number');
        assert(typeof data.level === 'string');
        assert(typeof data.name === 'string');
        early = early || data.name === 'early';
        connecting = connecting || data.name === 'connecting';
        open = open || data.name === 'open';
        closed = closed || data.name === 'closed';
      }
    });
    assert(early);
    assert(connecting);
    assert(open);
    assert(closed);
  });

  describe('multiple participants', () => {
    const loggerName1 = DEFAULT_LOGGER_NAME + '-alice';
    const loggerName2 = DEFAULT_LOGGER_NAME + '-bob';

    let logger1;
    let room1;
    let room2;

    beforeEach(() => {
      loadPlugin(loggerName1);
      loadPlugin(loggerName2);

      logger1 = Logger.getLogger(loggerName1);
    });

    afterEach(async () => {
      if (room1) {
        room1.disconnect();
      }
      if (room2) {
        room2.disconnect();
      }
      if (room1 || room2) {
        await completeRoom(sid);
      }
      room1 = null;
      room2 = null;
    });

    it('should not render logs that are turned off', async () => {
      logger1.setLevel('silent');
      room1 = await connect(token, Object.assign({ name: sid, loggerName: loggerName1 }, defaults));
      room2 = await connect(token, Object.assign({ name: sid, loggerName: loggerName2 }, defaults));

      let shouldHaveConnectComponentLogs = false;
      consoleMethods.forEach(method => {
        console[method].getCalls().forEach(callStub => {
          const prefix = callStub.args[0];
          const componentName = callStub.args[3];
          if (!componentName.includes('connect')) {
            return;
          }
          shouldHaveConnectComponentLogs = true;

          // The SDK adds a counter at the end to distinguish connect count.
          // Let's use that to determine which participant the log is coming from.
          assert(componentName.includes('#' + connectCount));
          assert.equal(prefix, loggerName2);
        });
      });

      assert(shouldHaveConnectComponentLogs);
    });

    it('should decorate the correct log for each individual component', async () => {
      room1 = await connect(token, Object.assign({ name: sid, loggerName: loggerName1 }, defaults));
      room2 = await connect(token, Object.assign({ name: sid, loggerName: loggerName2 }, defaults));

      let shouldHaveConnectComponentLogs = false;
      consoleMethods.forEach(method => {
        console[method].getCalls().forEach(callStub => {
          const prefix = callStub.args[0];
          const componentName = callStub.args[3];
          if (!componentName.includes('connect')) {
            return;
          }
          shouldHaveConnectComponentLogs = true;
          if (prefix === loggerName1) {
            assert(componentName.includes('#' + (connectCount - 1)));
          } else if (prefix === loggerName2) {
            assert(componentName.includes('#' + connectCount));
          }
        });
      });
      assert(shouldHaveConnectComponentLogs);
    });
  });
});
