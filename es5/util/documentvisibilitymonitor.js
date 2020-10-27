'use strict';

/**
 * The {@link DocumentVisibilityMonitor} monitors the visibility state of the DOM
 * and executes the attached listeners in phase order when the DOM is visible.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DocumentVisibilityMonitor = function () {
  /**
   * Constructor.
   * @param {number} [nPhases=1] - the number of phases
   */
  function DocumentVisibilityMonitor() {
    var _this = this;

    var nPhases = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;

    _classCallCheck(this, DocumentVisibilityMonitor);

    Object.defineProperties(this, {
      _listeners: {
        value: []
      },
      _onVisibilityChange: {
        value: function value() {
          if (document.visibilityState === 'visible') {
            _this._emitVisible();
          }
        }
      }
    });

    for (var i = 0; i < nPhases; i++) {
      this._listeners.push([]);
    }
  }

  _createClass(DocumentVisibilityMonitor, [{
    key: '_listenerCount',
    value: function _listenerCount() {
      return this._listeners.reduce(function (count, phaseListeners) {
        return count + phaseListeners.length;
      }, 0);
    }

    /**
     * Call all the listeners. Makes sure that all listeners for a given phase
     * are executed before calling the listeners of the next phase.
     * @private
     */

  }, {
    key: '_emitVisible',
    value: function _emitVisible() {
      var _this2 = this;

      var promise = Promise.resolve();

      var _loop = function _loop(phase) {
        promise = promise.then(function () {
          return _this2._emitVisiblePhase(phase);
        });
      };

      for (var phase = 1; phase <= this._listeners.length; phase++) {
        _loop(phase);
      }
      return promise;
    }

    /**
     * Call all the listeners for a given phase.
     * @private
     */

  }, {
    key: '_emitVisiblePhase',
    value: function _emitVisiblePhase(phase) {
      var phaseListeners = this._listeners[phase - 1];
      return Promise.all(phaseListeners.map(function (listener) {
        var ret = listener();
        return ret instanceof Promise ? ret : Promise.resolve(ret);
      }));
    }

    /**
     * Start listening to the DOM visibility state change.
     * @private
     */

  }, {
    key: '_start',
    value: function _start() {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    /**
     * Stop listening to the DOM visibility state change.
     * @private
     */

  }, {
    key: '_stop',
    value: function _stop() {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }

    /**
     * Listen for the DOM to be visible at the given phase.
     * @param {number} phase
     * @param {function} listener
     * @returns {this}
     */

  }, {
    key: 'onVisible',
    value: function onVisible(phase, listener) {
      if (typeof phase !== 'number' || phase <= 0 || phase > this._listeners.length) {
        throw new Error('invalid phase: ', phase);
      }
      var phaseListeners = this._listeners[phase - 1];
      phaseListeners.push(listener);
      if (this._listenerCount() === 1) {
        this._start();
      }
      return this;
    }

    /**
     * Stop listening for the DOM to be visible at the given phase.
     * @param {number} phase
     * @param {function} listener
     * @returns {this}
     */

  }, {
    key: 'offVisible',
    value: function offVisible(phase, listener) {
      if (typeof phase !== 'number' || phase <= 0 || phase > this._listeners.length) {
        throw new Error('invalid phase: ', phase);
      }

      var phaseListeners = this._listeners[phase - 1];
      var index = phaseListeners.indexOf(listener);
      if (index !== -1) {
        phaseListeners.splice(index, 1);
        if (this._listenerCount() === 0) {
          this._stop();
        }
      }
      return this;
    }
  }]);

  return DocumentVisibilityMonitor;
}();

module.exports = new DocumentVisibilityMonitor(2);