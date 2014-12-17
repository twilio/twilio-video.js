'use strict';

var util = require('./');

function Log(name, options) {
  options = util.withDefaults(options, {
    'logLevel': Log.INFO
  });
  var logLevel = options['logLevel'];
  Object.defineProperties(this, {
    'name': {
      value: name
    },
    'level': {
      value: logLevel
    }
  });
  return this;
}

Log.DEBUG = 0;
Log.INFO = 1;
Log.WARN = 2;
Log.ERROR = 3;

Log.mixin = function mixin(name, options) {
  var log = new Log(name, options);
  Object.defineProperties(this, {
    '_log': {
      value: log
    }
  });
};

Log.prototype.debug = function debug() {
  if (this.level <= Log.DEBUG) {
    var args = [].slice.call(arguments);
    args.unshift('DEBUG');
    args.unshift(this.name);
    // args.unshift(new Date());
    args = args.join(' ');
    console.log.call(console, args);
  }
  return this;
};

Log.prototype.info = function info() {
  if (this.level <= Log.INFO) {
    var args = [].slice.call(arguments);
    args.unshift('INFO');
    args.unshift(this.name);
    // args.unshift(new Date());
    args = args.join(' ');
    console.log.call(console, args);
  }
  return this;
};

Log.prototype.warn = function warn() {
  if (this.level <= Log.WARN) {
    var args = [].slice.call(arguments);
    args.unshift('WARN');
    args.unshift(this.name);
    // args.unshift(new Date());
    args = args.join(' ');
    console.warn.call(console, args);
  }
  return this;
};

Log.prototype.error = function error() {
  if (this.level <= Log.ERROR) {
    var args = [].slice.call(arguments);
    args.unshift('ERROR');
    args.unshift(this.name);
    // args.unshift(new Date());
    args = args.join(' ');
    console.error.call(console, args);
  }
  return this;
};

module.exports = Log;
