/* eslint-disable no-console */
const EventEmitter = require('events').EventEmitter;

/**
 * @extends EventEmitter
 * @emits documentVisiblePhase1
 * @emits documentVisiblePhase2
 */
const supportedEvents = ['documentVisiblePhase1', 'documentVisiblePhase2'];
class GlobalEvents {
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
    return supportedEvents.map(event => this._eventEmitter.listenerCount(event)).reduce((acc, eventCount) => acc + eventCount, 0);
  }

  _execute(event) {
    console.log('makarand: executing: ', event);
    return Promise.all(this._eventEmitter.listeners(event)
      .map(listener => {
        return Promise.resolve().then(() => {
          return listener();
        }).catch(() => {});
      })
    ).then(() => {
      console.log('makarand: done executing: ', event);
    });
  }

  _onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      this._execute('documentVisiblePhase1')
        .then(() => this._execute('documentVisiblePhase2'));
    }
  }

  _addEventListener(event, callback)  {
    const result =  this._eventEmitter.addListener(event, callback);
    this._hookupVisibilityChange();
    return result;
  }

  _removeEventListener(event, callback) {
    const result =  this._eventEmitter.removeListener(event, callback);
    this._hookupVisibilityChange();
    return result;
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

  onVisiblePhase1(callback) {
    return this._addEventListener('documentVisiblePhase1', callback);
  }

  offVisiblePhase1(callback) {
    return this._removeEventListener('documentVisiblePhase1', callback);
  }

  onVisiblePhase2(callback) {
    return this._addEventListener('documentVisiblePhase2', callback);
  }

  offVisiblePhase2(callback) {
    return this._removeEventListener('documentVisiblePhase2', callback);
  }
}

// exports singleton
module.exports = new GlobalEvents();
