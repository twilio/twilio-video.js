'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { makeUUID } = require('../../../../lib/util');
const { DEFAULT_LOGGER_NAME } = require('../../../../lib/util/constants');
const Log = require('../../../../lib/util/log');

function component(name) {
  return {
    toString() {
      return name;
    }
  };
}

describe('Log', () => {
  const log = Log.prototype.log;
  let getLogger;
  let logger;

  beforeEach(() => {
    Log.prototype.log = sinon.spy(log);

    logger = {
      setDefaultLevel: sinon.spy(),
      trace: sinon.spy(),
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
    };
    getLogger = sinon.stub().returns(logger);
  });

  describe('constructor', () => {
    let getLevelByName;

    before(() => {
      getLevelByName = Log.getLevelByName;
      Log.getLevelByName = sinon.spy();
    });

    after(() => {
      Log.getLevelByName = getLevelByName;
    });

    it('should return an instance of Log', () => {
      const log = new Log(component('log'));
      assert(log instanceof Log);
    });

    it('should throw an error if component is not specified', () => {
      assert.throws(() => new Log(), error => {
        return error instanceof TypeError && error.message === 'component must be specified';
      });
    });

    it('should set the name to component.toString()', () => {
      const comp = component('bar');
      const log = new Log(comp);
      assert.equal(log.name, comp.toString());
    });

    it('should use the specified loggerName', () => {
      const log = new Log(component('bar'), 'qux', getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(getLogger, 'qux');
    });

    it('should use default loggerName if loggerName is not specified', () => {
      const log = new Log(component('bar'), undefined, getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(getLogger, DEFAULT_LOGGER_NAME);
    });
  });

  describe('#createLog(moduleName, component)', () => {
    it('should create a Log whose loggerName is the same as that of its parent', () => {
      const parent = new Log(component('parent'));
      const child = parent.createLog(component('child'));
      assert.equal(child._loggerName, parent._loggerName);
    });
  });

  describe('#log(logLevel, message)', () => {
    const loggerMethods = ['trace', 'debug', 'info', 'warn', 'error'];
    it('should throw an error if the logLevel passed is invalid', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      assert.throws(log.log.bind(log, 999), error => {
        return error instanceof RangeError && /logLevel must be one of/.test(error.message);
      });
    });

    it('should not call any logger method if logLevel is "off"', () => {
      const log = new Log(component('bar'));
      log.log(Log.OFF, []);
      loggerMethods.forEach(method => {
        sinon.assert.notCalled(logger[method]);
      });
    });

    loggerMethods.forEach((method, i) => {
      it(`should call logger.${method} if logLevel is Log.${method.toUpperCase()}`, () => {
        const log = new Log(component('bar'), 'baz', getLogger);
        log.log(i, []);
        sinon.assert.called(logger[method]);
      });
    });
  });

  describe('#debug(messages)', () => {
    it('should call #log(Log.DEBUG, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      log.debug('baz');
      sinon.assert.calledWith(log.log, Log.DEBUG, ['baz']);
    });
  });

  describe('#deprecated(deprecationWarning)', () => {
    context('the first time the deprecationWarning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log(component('bar'));
        log.deprecated('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the deprecationWarning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log(component('bar'));
        const uuid = makeUUID();
        log.deprecated(uuid);
        log.deprecated(uuid);
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#info(messages)', () => {
    it('should call #log(Log.INFO, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      log.info('baz');
      sinon.assert.calledWith(log.log, Log.INFO, ['baz']);
    });
  });

  describe('#warn(messages)', () => {
    it('should call #log(Log.WARN, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      log.warn('baz');
      sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
    });
  });

  describe('#warnOnce(deprecationWarning)', () => {
    context('the first time the warning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log(component('bar'));
        log.warnOnce('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the warning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log(component('bar'));
        log.warnOnce('baz');
        log.warnOnce('baz');
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#error(messages)', () => {
    it('should call #log(Log.ERROR, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      log.error('baz');
      sinon.assert.calledWith(log.log, Log.ERROR, ['baz']);
    });
  });

  describe('#throw(error, message)', () => {
    it('should throw an error and call #log(Log.ERROR, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      const error = new Error('baz');
      assert.throws(log.throw.bind(log, error));
      sinon.assert.calledWith(log.log, Log.ERROR, error);
    });

    it('should call the errors clone method if it exists', () => {
      // eslint-disable-next-line new-cap
      const log = new Log(component('bar'));
      const error = new Error('baz');
      error.clone = sinon.spy();

      try {
        log.throw(error, 'foobar');
      // eslint-disable-next-line no-catch-shadow
      } catch (error) {
        // Do nothing
      }

      assert(error.clone.calledOnce);
    });
  });
});
