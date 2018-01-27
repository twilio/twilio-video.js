'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { DEFAULT_LOG_LEVEL } = require('../../../../lib/util/constants');
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
  beforeEach(() => {
    Log.prototype.log = sinon.spy(log);
  });

  before(() => {
    Log._levels.splice(0, Log._levels.length,
      { name: 'DEBUG', logFn: sinon.spy() },
      { name: 'INFO',  logFn: sinon.spy() },
      { name: 'WARN',  logFn: sinon.spy() },
      { name: 'ERROR', logFn: sinon.spy() },
      { name: 'OFF' }
    );
  });

  describe('new Log(component, logLevels)', () => {
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
      void log.logLevel;
      assert(Log.getLevelByName.calledWith('debug'));
    });

    it('should set the default Log level if module specific level is not specified', () => {
      const log = new Log('foo', component('bar'), { baz: 'error' });
      assert.equal(log.logLevel, Log.getLevelByName(DEFAULT_LOG_LEVEL));
    });

    it('should set the default Log level if logLevels object is not specified', () => {
      const log = new Log('foo', component('bar'));
      assert.equal(log.logLevel, Log.getLevelByName(DEFAULT_LOG_LEVEL));
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
    it('should throw an error if the logLevel passed is invalid', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'));
      assert.throws(log.log.bind(log, 999), error => {
        return error instanceof RangeError && /logLevel must be one of/.test(error.message);
      });
    });

    it('should call the log function if the logLevel is within the Logs verbosity', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'warn' });
      log.log(Log.ERROR, 'foo');
      assert(Log._levels[Log.ERROR].logFn.called);
    });

    it('should not call the log function if the logLevel is outside of the Logs verbosity', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'off' });
      log.log(Log.WARN, 'foo');
      assert(!Log._levels[Log.WARN].logFn.called);
    });
  });

  describe('#debug(messages)', () => {
    it('should call #log(Log.DEBUG, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'debug' });
      log.debug('baz');
      sinon.assert.calledWith(log.log, Log.DEBUG, ['baz']);
    });
  });

  describe('#deprecated(deprecationWarning)', () => {
    context('the first time the deprecationWarning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.deprecated('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the deprecationWarning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.deprecated('baz');
        log.deprecated('baz');
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#info(messages)', () => {
    it('should call #log(Log.INFO, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'info' });
      log.info('baz');
      sinon.assert.calledWith(log.log, Log.INFO, ['baz']);
    });
  });

  describe('#warn(messages)', () => {
    it('should call #log(Log.WARN, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'warn' });
      log.warn('baz');
      sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
    });
  });

  describe('#warnOnce(deprecationWarning)', () => {
    context('the first time the warning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.warnOnce('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the warning is passed', () => {
      it('should call #log(Log.WARN, message)', () => {
        // eslint-disable-next-line new-cap
        const log = new Log('foo', component('bar'), { foo: 'warn' });
        log.warnOnce('baz');
        log.warnOnce('baz');
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#error(messages)', () => {
    it('should call #log(Log.ERROR, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'error' });
      log.error('baz');
      sinon.assert.calledWith(log.log, Log.ERROR, ['baz']);
    });
  });

  describe('#throw(error, message)', () => {
    it('should throw an error and call #log(Log.ERROR, message)', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'error' });
      const error = new Error('baz');
      assert.throws(log.throw.bind(log, error));
      sinon.assert.calledWith(log.log, Log.ERROR, error);
    });

    it('should call the errors clone method if it exists', () => {
      // eslint-disable-next-line new-cap
      const log = new Log('foo', component('bar'), { foo: 'error' });
      const error = new Error('baz');
      error.clone = sinon.spy();

      try {
        log.throw(error, 'foobar');
      } catch (error) {
        // Do nothing
      }

      assert(error.clone.calledOnce);
    });
  });
});
