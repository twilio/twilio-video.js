'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { makeUUID } = require('../../../../lib/util');
const { DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME } = require('../../../../lib/util/constants');
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
      const log = new Log('foo', component('log'));
      assert(log instanceof Log);
    });

    it('should throw an error if module name is not a string', () => {
      assert.throws(() => new Log({}, component('foo')), error => {
        return error instanceof TypeError && error.message === 'moduleName must be a string';
      });
    });

    it('should throw an error if component is not specified', () => {
      assert.throws(() => new Log('foo'), error => {
        return error instanceof TypeError && error.message === 'component must be specified';
      });
    });

    it('should set the name to component.toString()', () => {
      const comp = component('bar');
      const log = new Log('foo', comp);
      assert.equal(log.name, comp.toString());
    });

    it('should call getLevelByName with the passed logLevel', () => {
      const log = new Log('foo', component('bar'), {
        foo: 'debug',
        bar: 'error'
      });
      // eslint-disable-next-line no-void
      void log.logLevel;
      assert(Log.getLevelByName.calledWith('debug'));
    });

    it('should set the default Log level if module specific level is not specified', () => {
      const log = new Log('foo', component('bar'), { baz: 'error' }, undefined, getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(logger.setDefaultLevel, DEFAULT_LOG_LEVEL);
      assert.equal(log.logLevel, Log.getLevelByName(DEFAULT_LOG_LEVEL));
    });

    it('should set the default Log level if logLevels object is not specified', () => {
      const log = new Log('foo', component('bar'), undefined, undefined, getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(logger.setDefaultLevel, DEFAULT_LOG_LEVEL);
      assert.equal(log.logLevel, Log.getLevelByName(DEFAULT_LOG_LEVEL));
    });

    it('should use "silent" if level is "off" when calling loglevel.setDefaultLevel', () => {
      const log = new Log('foo', component('bar'), { foo: 'off' }, undefined, getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(logger.setDefaultLevel, 'silent');
    });

    it('should use the specified loggerName', () => {
      const log = new Log('foo', component('bar'), { baz: 'error' }, 'qux', getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(getLogger, 'qux');
    });

    it('should append moduleName if logLevels have different levels', () => {
      const log = new Log('foo', component('bar'), { foo: 'info', baz: 'error' }, 'qux', getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(getLogger, 'qux-foo');
    });

    it('should not append moduleName if logLevels have the same levels', () => {
      const log = new Log('foo', component('bar'), { foo: 'info', baz: 'info' }, 'qux', getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(getLogger, 'qux');
    });

    it('should use default loggerName if loggerName is not specified', () => {
      const log = new Log('foo', component('bar'), { baz: 'error' }, undefined, getLogger);
      log.log(Log.DEBUG, []);
      sinon.assert.calledWith(getLogger, DEFAULT_LOGGER_NAME);
    });
  });

  describe('#getLevelByName(name)', () => {
    it('should return the input if the input is a number', () => {
      const level = Log.getLevelByName(3);
      assert.equal(level, 3);
    });

    it('should throw an error if the input string is not valid', () => {
      assert.throws(Log.getLevelByName.bind(null, 'foo'), error => {
        return error instanceof RangeError && /level must be one of/.test(error.message);
      });
    });

    it('should return the corresponding constant if the input is a valid log level', () => {
      const level = Log.getLevelByName('off');
      assert.equal(level, Log.OFF);
    });
  });

  describe('#createLog(moduleName, component)', () => {
    it('should create a Log whose logLevels reference is the same as that of its parent', () => {
      const logLevels = { foo: 'debug', bar: 'error' };
      const parent = new Log('foo', component('parent'), logLevels);
      const child = parent.createLog('bar', component('child'));
      assert.equal(child._logLevels, parent._logLevels);
    });

    it('should create a Log whose loggerName is the same as that of its parent', () => {
      const parent = new Log('foo', component('parent'), { foo: 'debug' }, 'bar');
      const child = parent.createLog('baz', component('child'));
      assert.equal(child._loggerName, parent._loggerName);
    });

    it('should not append moduleName twice if it was already appended from the parent', () => {
      const logLevels = { foo: 'debug', bar: 'error' };
      const parent = new Log('foo', component('parent'), logLevels, 'baz');
      const child = parent.createLog('bar', component('child'));
      assert.equal(child._loggerName, 'baz-bar');
    });
  });

  describe('#setLevels(levels)', () => {
    it('should set _logLevels to the new values', () => {
      const log = new Log('foo', component('bar'), { foo: 'debug' });
      log.setLevels({ foo: 'warn' });
      assert.deepEqual(log._logLevels, { foo: 'warn' });
      assert.equal(log.logLevel, Log.getLevelByName('warn'));
    });

    it('should update the log levels of the child Logs', () => {
      const logLevels = { foo: 'debug', bar: 'error' };
      const newLogLevels = { foo: 'debug', bar: 'warn' };
      const parent = new Log('foo', component('parent'), logLevels);
      const child = parent.createLog('bar', component('child'));
      parent.setLevels(newLogLevels);
      assert.deepEqual(child._logLevels, newLogLevels);
      assert.equal(child.logLevel, Log.getLevelByName('warn'));
    });

    it('should not update #logLevel when some other module\'s level is updated in logLevels', () => {
      const logLevels = { foo: 'error', bar: 'debug' };
      const log = new Log('foo', component('bar'), logLevels);
      const oldLevel = log.logLevel;
      log.setLevels(Object.assign({}, logLevels, { bar: 'off' }));
      assert.equal(log.logLevel, oldLevel);
    });
  });

  describe('#log(logLevel, message)', () => {
    const loggerMethods = ['debug', 'info', 'warn', 'error'];
    it('should throw an error if the logLevel passed is invalid', () => {

      const log = new Log('foo', component('bar'));
      assert.throws(log.log.bind(log, 999), error => {
        return error instanceof RangeError && /logLevel must be one of/.test(error.message);
      });
    });

    it('should not call any logger method if logLevel is "off"', () => {
      const log = new Log('foo', component('bar'));
      log.log(Log.OFF, []);
      loggerMethods.forEach(method => {
        sinon.assert.notCalled(logger[method]);
      });
    });

    loggerMethods.forEach((method, i) => {
      it(`should call logger.${method} if logLevel is Log.${method.toUpperCase()}`, () => {
        const log = new Log('foo', component('bar'), undefined, 'baz', getLogger);
        log.log(i, []);
        sinon.assert.called(logger[method]);
      });
    });
  });

  describe('#debug(messages)', () => {
    it('should call #log(Log.DEBUG, message)', () => {
      const log = new Log('foo', component('bar'), { foo: 'debug' });
      log.debug('baz');
      sinon.assert.calledWith(log.log, Log.DEBUG, ['baz']);
    });
  });

  describe('#deprecated(deprecationWarning)', () => {
    context('the first time the deprecationWarning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.deprecated('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the deprecationWarning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        const uuid = makeUUID();
        log.deprecated(uuid);
        log.deprecated(uuid);
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#info(messages)', () => {
    it('should call #log(Log.INFO, message)', () => {
      const log = new Log('foo', component('bar'), { foo: 'info' });
      log.info('baz');
      sinon.assert.calledWith(log.log, Log.INFO, ['baz']);
    });
  });

  describe('#warn(messages)', () => {
    it('should call #log(Log.WARN, message)', () => {
      const log = new Log('foo', component('bar'), { foo: 'warn' });
      log.warn('baz');
      sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
    });
  });

  describe('#warnOnce(deprecationWarning)', () => {
    context('the first time the warning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.warnOnce('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the warning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.warnOnce('baz');
        log.warnOnce('baz');
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#error(messages)', () => {
    it('should call #log(Log.ERROR, message)', () => {
      const log = new Log('foo', component('bar'), { foo: 'error' });
      log.error('baz');
      sinon.assert.calledWith(log.log, Log.ERROR, ['baz']);
    });
  });

  describe('#throw(error, message)', () => {
    it('should throw an error and call #log(Log.ERROR, message)', () => {
      const log = new Log('foo', component('bar'), { foo: 'error' });
      const error = new Error('baz');
      assert.throws(log.throw.bind(log, error));
      sinon.assert.calledWith(log.log, Log.ERROR, error);
    });

    it('should call the errors clone method if it exists', () => {
      const log = new Log('foo', component('bar'), { foo: 'error' });
      const error = new Error('baz');
      error.clone = sinon.spy();

      try {
        log.throw(error, 'foobar');
      } catch {
        // Do nothing
      }

      assert(error.clone.calledOnce);
    });
  });
});
