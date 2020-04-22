'use strict';

class NetworkMonitor {
  constructor(onNetworkChanged, options) {
    options = Object.assign({
      navigator,
      window,
    }, options);

    const nav = options.navigator;
    const connection = nav.connection || { type: null };
    let type = connection.type;

    const _listener = {
      value: connection.type
        ? () => {
          const networkChanged = type !== this.type && this.isOnline;
          type = this.type;
          if (networkChanged) {
            onNetworkChanged();
          }
        }
        : onNetworkChanged,
    };

    const _events = { value: connection.type ? ['change', 'typechange'] : ['online'] };

    const _target = { value: connection.type ? connection : options.window };

    Object.defineProperties(this, {
      isOnline: {
        enumerable: true,
        get() {
          return typeof nav.onLine === 'boolean'
            ? nav.onLine
            : true;
        }
      },
      type: {
        enumerable: true,
        get() {
          return connection.type || null;
        }
      },
      _listener,
      _events,
      _target,
    });
  }

  start() {
    this._events.forEach(event => {
      this._target.addEventListener(event, this._listener);
    });
  }

  stop() {
    this._events.forEach(event => {
      this._target.removeEventListener(event, this._listener);
    });
  }
}

module.exports = NetworkMonitor;
