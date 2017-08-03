'use strict';

var assert = require('assert');
var sinon = require('sinon');
var constants = require('../../../../lib/util/constants');
var component = (name) => ({ toString: () => name });

var Log = require('../../../../lib/util/log');

describe('Log', function() {
  var log = Log.prototype.log;
  beforeEach(function() {
    Log.prototype.log = sinon.spy(log);
  });

  before(function() {
    Log._levels.splice(0, Log._levels.length,
      { name: 'DEBUG', logFn: sinon.spy() },
      { name: 'INFO',  logFn: sinon.spy() },
      { name: 'WARN',  logFn: sinon.spy() },
      { name: 'ERROR', logFn: sinon.spy() },
      { name: 'OFF' }
    );
  });

  describe('new Log(component, logLevels)', function() {
    var getLevelByName;

    before(function() {
      getLevelByName = Log.getLevelByName;
      Log.getLevelByName = sinon.spy();
    });

    after(function() {
      Log.getLevelByName = getLevelByName;
    });

    it('should return an instance of Log', function() {
      var log1 = new Log('foo', component('log1'));
      var log2 = Log('bar', component('log2'));

      assert(log1 instanceof Log);
      assert(log2 instanceof Log);
    });

    it('should throw an error if module name is not a string', () => {
      assert.throws(Log.bind(null, {}, component('foo')), error => {
        return error instanceof TypeError && error.message === 'moduleName must be a string';
      });
    });

    it('should throw an error if component is not specified', () => {
      assert.throws(Log.bind(null, 'foo'), error => {
        return error instanceof TypeError && error.message === 'component must be specified';
      });
    });

    it('should set the name to component.toString()', () => {
      var comp = component('bar');
      var log = new Log('foo', comp);
      assert.equal(log.name, comp.toString());
    });

    it('should call getLevelByName with the passed logLevel', function() {
      var log = new Log('foo', component('bar'), {
        foo: 'debug',
        bar: 'error'
      });
      var level = log.logLevel;
      assert(Log.getLevelByName.calledWith('debug'));
    });

    it('should set the default Log level if module specific level is not specified', () => {
      var log = new Log('foo', component('bar'), { baz: 'error' });
      assert.equal(log.logLevel, Log.getLevelByName(constants.DEFAULT_LOG_LEVEL));
    });

    it('should set the default Log level if logLevels object is not specified', () => {
      var log = new Log('foo', component('bar'));
      assert.equal(log.logLevel, Log.getLevelByName(constants.DEFAULT_LOG_LEVEL));
    });
  });

  describe('#getLevelByName(name)', function() {
    it('should return the input if the input is a number', function() {
      var level = Log.getLevelByName(3);
      assert.equal(level, 3);
    });

    it('should throw an error if the input string is not valid', function() {
      assert.throws(Log.getLevelByName.bind(null, 'foo'), error => {
        return error instanceof RangeError && /level must be one of/.test(error.message);
      });
    });

    it('should return the corresponding constant if the input is a valid log level', function() {
      var level = Log.getLevelByName('off');
      assert.equal(level, Log['OFF']);
    });
  });

  describe('#createLog(moduleName, component)', () => {
    it('should create a Log whose logLevels reference is the same as that of its parent', () => {
      var logLevels = { foo: 'debug', bar: 'error' };
      var parent = new Log('foo', component('parent'), logLevels);
      var child = parent.createLog('bar', component('child'));
      assert.equal(child._logLevels, parent._logLevels);
    });
  });

  describe('#setLevels(levels)', () => {
    it('should set _logLevels to the new values', () => {
      var log = new Log('foo', component('bar'), { foo: 'debug' });
      log.setLevels({ foo: 'warn' });
      assert.deepEqual(log._logLevels, { foo: 'warn' });
      assert.equal(log.logLevel, Log.getLevelByName('warn'));
    });

    it('should update the log levels of the child Logs', () => {
      var logLevels = { foo: 'debug', bar: 'error' };
      var newLogLevels = { foo: 'debug', bar: 'warn' };
      var parent = new Log('foo', component('parent'), logLevels);
      var child = parent.createLog('bar', component('child'));
      parent.setLevels(newLogLevels);
      assert.deepEqual(child._logLevels, newLogLevels);
      assert.equal(child.logLevel, Log.getLevelByName('warn'));
    });

    it('should not update #logLevel when some other module\'s level is updated in logLevels', () => {
      var logLevels = { foo: 'error', bar: 'debug' };
      var log = new Log('foo', component('bar'), logLevels);
      var oldLevel = log.logLevel;
      logLevels = Object.assign(logLevels, { bar: 'off' });
      log.setLevels(logLevels);
      assert.equal(log.logLevel, oldLevel);
    });
  });

  describe('#log(logLevel, message)', function() {
    it('should throw an error if the logLevel passed is invalid', function() {
      var log = Log('foo', component('bar'));
      assert.throws(log.log.bind(log, 999), error => {
        return error instanceof RangeError && /logLevel must be one of/.test(error.message);
      });
    });

    it('should call the log function if the logLevel is within the Logs verbosity', function() {
      var log = Log('foo', component('bar'), { foo: 'warn' });
      log.log(Log.ERROR, 'foo');
      assert(Log._levels[Log.ERROR].logFn.called);
    });

    it('should not call the log function if the logLevel is outside of the Logs verbosity', function() {
      var log = Log('foo', component('bar'), { foo: 'off' });
      log.log(Log.WARN, 'foo');
      assert(!Log._levels[Log.WARN].logFn.called);
    });
  });

  describe('#debug(messages)', function() {
    it('should call #log(Log.DEBUG, message)', function() {
      var log = Log('foo', component('bar'), { foo: 'debug' });
      log.debug('baz');
      sinon.assert.calledWith(log.log, Log.DEBUG, ['baz']);
    });
  });

  describe('#deprecated(deprecationWarning)', function() {
    context('the first time the deprecationWarning is passed', function() {
      it('should call #log(Log.WARN, message)', function() {
        var log = Log('foo', component('bar'), { foo: 'warn' });
        log.deprecated('baz');
        sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
      });
    });

    context('subsequent times the deprecationWarning is passed', function() {
      it('should call #log(Log.WARN, message)', function() {
        var log = Log('foo', component('bar'), { foo: 'warn' });
        log.deprecated('baz');
        log.deprecated('baz');
        sinon.assert.calledOnce(log.log);
      });
    });
  });

  describe('#info(messages)', function() {
    it('should call #log(Log.INFO, message)', function() {
      var log = Log('foo', component('bar'), { foo: 'info' });
      log.info('baz');
      sinon.assert.calledWith(log.log, Log.INFO, ['baz']);
    });
  });

  describe('#warn(messages)', function() {
    it('should call #log(Log.WARN, message)', function() {
      var log = Log('foo', component('bar'), { foo: 'warn' });
      log.warn('baz');
      sinon.assert.calledWith(log.log, Log.WARN, ['baz']);
    });
  });

  describe('#error(messages)', function() {
    it('should call #log(Log.ERROR, message)', function() {
      var log = Log('foo', component('bar'), { foo: 'error' });
      log.error('baz');
      sinon.assert.calledWith(log.log, Log.ERROR, ['baz']);
    });
  });

  describe('#throw(error, message)', function() {
    it('should throw an error and call #log(Log.ERROR, message)', function() {
      var log = Log('foo', component('bar'), { foo: 'error' });
      var error = new Error('baz');
      assert.throws(log.throw.bind(log, error));
      sinon.assert.calledWith(log.log, Log.ERROR, error);
    });

    it('should call the errors clone method if it exists', function() {
      var log = Log('foo', component('bar'), { foo: 'error' });
      var error = new Error('baz');
      error.clone = sinon.spy();

      try {
        log.throw(error, 'foobar');
      } catch(e) { }

      assert(error.clone.calledOnce);
    });
  });
});
