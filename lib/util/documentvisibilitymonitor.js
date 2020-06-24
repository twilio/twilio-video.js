const EventEmitter = require('events').EventEmitter;

/**
 * @extends EventEmitter
 * @emits documentVisiblePhase1
 * @emits documentVisiblePhase2
 */
const supportedPhases = ['phase1', 'phase2'];
/**
 * exposes a mechanism for listening for document visibility in
 * ordered phases.
 * caller can subscriber for document visibility on phase1 and phase2
 * phase1 callbacks will be executed first. Those callbacks may return async.
 * phase2 callbacks will be executed only after phase1 callbacks are settled.
 */
class DocumentVisibilityMonitor {
  constructor() {
    Object.defineProperties(this, {
      _eventEmitter: {
        value: new EventEmitter()
      },
      _visibilityListener: {
        value: null,
        writable: true
      }
    });
  }

  _listenerCount() {
    return supportedPhases.map(event => this._eventEmitter.listenerCount(event)).reduce((acc, eventCount) => acc + eventCount, 0);
  }

  _execute(event) {
    return Promise.all(this._eventEmitter.listeners(event)
      .map(listener => Promise.resolve().then(() => listener()).catch(() => {}))
    );
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      supportedPhases.reduce((acc, phase) => acc.then(() => this._execute(phase)), Promise.resolve());
    }
  }

  _hookupVisibilityChange() {
    const needListener = this._listenerCount() > 0;
    const hasListener = this._visibilityListener !== null;
    if (needListener !== hasListener) {
      if (needListener) {
        this._visibilityListener = this._onVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this._visibilityListener);
      } else {
        document.removeEventListener('visibilitychange', this._visibilityListener);
        this._visibilityListener = null;
      }
    }
  }

  /**
   * hooks up for document visibility for given phase
  */
  onVisible(callback, phase) {
    if (!supportedPhases.includes(phase)) {
      throw new Error(`unsupported phase ${phase}`);
    }
    const result =  this._eventEmitter.addListener(phase, callback);
    this._hookupVisibilityChange();
    return result;
  }

  /**
   * unhooks up for document visibility for given phase
  */
  offVisible(callback, phase) {
    if (!supportedPhases.includes(phase)) {
      throw new Error(`unsupported phase ${phase}`);
    }
    const result =  this._eventEmitter.removeListener(phase, callback);
    this._hookupVisibilityChange();
    return result;
  }
}

// exports singleton
module.exports = new DocumentVisibilityMonitor();
