'use strict';

class NetworkMonitor {
  constructor(onNetworkChanged, options) {
    options = Object.assign({
      navigator,
      window
    }, options);

    const nav = options.navigator;
    const connection = nav.connection || { type: null };
    let type = connection.type;

    Object.defineProperties(this, Object.assign({
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
      }
    }, connection.type ? {
      _events: {
        value: ['change', 'typechange']
      },
      _listener: {
        value: () => {
          const networkChanged = type !== this.type && this.isOnline;
          type = this.type;
          if (networkChanged) {
            onNetworkChanged();
          }
        }
      },
      _target: {
        value: connection
      }
    } : {
      _events: {
        value: ['online']
      },
      _listener: {
        value: onNetworkChanged
      },
      _target: {
        value: options.window
      }
    }));
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
