'use strict';

/**
 * The {@link DocumentVisibilityMonitor} monitors the visibility state of the DOM
 * and executes the attached listeners in phase order when the DOM is visible.
 */
class DocumentVisibilityMonitor {
  /**
   * Constructor.
   * @param {number} [nPhases=1] - the number of phases
   */
  constructor(nPhases = 1) {
    Object.defineProperties(this, {
      _listeners: {
        value: []
      },
      _onVisibilityChange: {
        value: () => {
          if (document.visibilityState === 'visible') {
            this._emitVisible();
          }
        }
      }
    });

    for (let i = 0; i < nPhases; i++) {
      this._listeners.push([]);
    }
  }

  _listenerCount() {
    return this._listeners.reduce((count, phaseListeners) => count + phaseListeners.length, 0);
  }

  /**
   * Call all the listeners. Makes sure that all listeners for a given phase
   * are executed before calling the listeners of the next phase.
   * @private
   */
  _emitVisible() {
    let promise = Promise.resolve();
    for (let phase = 1; phase <= this._listeners.length; phase++) {
      promise = promise.then(() => this._emitVisiblePhase(phase));
    }
    return promise;
  }

  /**
   * Call all the listeners for a given phase.
   * @private
   */
  _emitVisiblePhase(phase) {
    const phaseListeners = this._listeners[phase - 1];
    return Promise.all(phaseListeners.map(listener => {
      const ret = listener();
      return ret instanceof Promise ? ret : Promise.resolve(ret);
    }));
  }

  /**
   * Start listening to the DOM visibility state change.
   * @private
   */
  _start() {
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  /**
   * Stop listening to the DOM visibility state change.
   * @private
   */
  _stop() {
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  /**
   * Listen for the DOM to be visible at the given phase.
   * @param {number} phase
   * @param {function} listener
   * @returns {this}
   */
  onVisible(phase, listener) {
    if (typeof phase !== 'number' || phase <= 0 || phase > this._listeners.length) {
      throw new Error('invalid phase: ', phase);
    }
    const phaseListeners = this._listeners[phase - 1];
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
  offVisible(phase, listener) {
    if (typeof phase !== 'number' || phase <= 0 || phase > this._listeners.length) {
      throw new Error('invalid phase: ', phase);
    }

    const phaseListeners = this._listeners[phase - 1];
    const index = phaseListeners.indexOf(listener);
    if (index !== -1) {
      phaseListeners.splice(index, 1);
      if (this._listenerCount() === 0) {
        this._stop();
      }
    }
    return this;
  }
}

module.exports = new DocumentVisibilityMonitor(2);
