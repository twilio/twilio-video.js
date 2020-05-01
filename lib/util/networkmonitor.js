'use strict';

/**
 * Monitor the network connection status to detect interruptions and handoffs.
 */
class NetworkMonitor {
  /**
   * Construct a {@link NetworkMonitor}.
   * @param {function} onNetworkChanged
   * @param {*} [options]
   */
  constructor(onNetworkChanged, options) {
    options = Object.assign({
      navigator,
      window,
    }, options);

    const nav = options.navigator;
    const connection = nav.connection || { type: null };
    let type = connection.type;

    const { _events, _listener, _target } = connection.type ? {
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
    };

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
      _target
    });
  }

  /**
   * Start the {@link NetworkMonitor}.
   */
  start() {
    this._events.forEach(event => {
      this._target.addEventListener(event, this._listener);
    });
  }

  /**
   * Stop the {@link NetworkMonitor}.
   */
  stop() {
    this._events.forEach(event => {
      this._target.removeEventListener(event, this._listener);
    });
  }
}

module.exports = NetworkMonitor;
