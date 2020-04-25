'use strict';
const assert = require('assert');
const sinon = require('sinon');

function makeFakeTimeout(options) {
  options = options || {};
  options.instances = [];
  class Timeout {
    constructor(fn, delay, autoStart = true) {
      options.instances.push(this);
      this._fn = fn;
      this.delay = delay;
      this._timeout = null;
      this.setDelay = sinon.spy(delay => {
        this._delay = delay;
      });
      this.start = sinon.spy(() => {
        if (!this.isSet) {
          this._timeout = () => {
            const fn = this._fn;
            this.clear();
            fn();
          };
        }
      });
      this._simulateTimeout = () => {
        assert(this._timeout);
        this._timeout();
      };
      this.clear = sinon.spy(() => {
        this._timeout = null;
      });
      this.reset = sinon.spy(() => {
        this.clear();
        this.start();
      });
      if (autoStart) {
        this.start();
      }
    }

    get isSet() {
      return !!this._timeout;
    }
  }

  options.Timeout = Timeout;
  return options;
}

module.exports = makeFakeTimeout;
