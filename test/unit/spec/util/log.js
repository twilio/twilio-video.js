'use strict';

var assert = require('assert');
var sinon = require('sinon');

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

  describe('new Log(name, logLevel)', function() {
    var getLevelByName;

    before(function() {
      getLevelByName = Log.getLevelByName;
      Log.getLevelByName = sinon.spy();
    });

    after(function() {
      Log.getLevelByName = getLevelByName;
    });

    it('should return an instance of Log', function() {
      var log1 = new Log('foo');
      var log2 = Log('bar');

      assert(log1 instanceof Log);
      assert(log2 instanceof Log);
    });

    it('should call getLevelByName with the passed logLevel', function() {
      var log = new Log('foo', 'debug');
      assert(Log.getLevelByName.calledWith('debug'));
    });
  });

  describe('#getLevelByName(name)', function() {
    it('should return the input if the input is a number', function() {
      var level = Log.getLevelByName(3);
      assert.equal(level, 3);
    });

    it('should throw an error if the input string is not valid', function() {
      assert.throws(Log.getLevelByName.bind(null, 'foo'), /INVALID_ARGUMENT/);
    });

    it('should return the corresponding constant if the input is a valid log level', function() {
      var level = Log.getLevelByName('off');
      assert.equal(level, Log['OFF']);
    });
  });

  describe('#log(logLevel, message)', function() {
    it('should throw an error if the logLevel passed is invalid', function() {
      var log = Log();
      assert.throws(log.log.bind(log, 999));
    });

    it('should call the log function if the logLevel is within the Logs verbosity', function() {
      var log = Log('foo', Log.WARN);
      log.log(Log.ERROR, 'foo');
      assert(Log._levels[Log.ERROR].logFn.called);
    });

    it('should not call the log function if the logLevel is outside of the Logs verbosity', function() {
      var log = Log('foo', Log.OFF);
      log.log(Log.WARN, 'foo');
      assert(!Log._levels[Log.WARN].logFn.called);
    });
  });

  describe('#debug(messages)', function() {
    it('should call #log(Log.DEBUG, message)', function() {
      var log = Log('foo', 'debug');
      log.debug('bar');
      sinon.assert.calledWith(log.log, Log.DEBUG, ['bar']);
    });
  });

  describe('#info(messages)', function() {
    it('should call #log(Log.INFO, message)', function() {
      var log = Log('foo', 'info');
      log.info('bar');
      sinon.assert.calledWith(log.log, Log.INFO, ['bar']);
    });
  });

  describe('#warn(messages)', function() {
    it('should call #log(Log.WARN, message)', function() {
      var log = Log('foo', 'warn');
      log.warn('bar');
      sinon.assert.calledWith(log.log, Log.WARN, ['bar']);
    });
  });

  describe('#error(messages)', function() {
    it('should call #log(Log.ERROR, message)', function() {
      var log = Log('foo', 'error');
      log.error('bar');
      sinon.assert.calledWith(log.log, Log.ERROR, ['bar']);
    });
  });

  describe('#throw(error, message)', function() {
    it('should throw an error and call #log(Log.ERROR, message)', function() {
      var log = Log('foo', 'error');
      var error = new Error('bar');
      assert.throws(log.throw.bind(log, error));
      sinon.assert.calledWith(log.log, Log.ERROR, error);
    });

    it('should call the errors clone method if it exists', function() {
      var log = Log('foo', 'error');
      var error = new Error('bar');
      error.clone = sinon.spy();

      try {
        log.throw(error, 'foobar');
      } catch(e) { }

      assert(error.clone.calledOnce);
    });
  });
});
