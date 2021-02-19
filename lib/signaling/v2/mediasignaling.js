/* eslint callback-return:0 */
'use strict';

const EventEmitter = require('events');

let nInstances = 0;
class MediaSignaling extends EventEmitter {
  /**
   * Construct a {@link MediaSignaling}.
   * @param {Promise<DataTrackReceiver>} getReceive
   */
  constructor(getReceiver, channel, options) {
    super();
    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      channel: {
        value: channel,
      },
      _log: {
        value: options.log.createLog('default', this)
      },
      _getReceiver: {
        value: getReceiver
      },
      _receiverPromise: {
        value: null,
        writable: true,
      },
      _transport: {
        value: null,
        writable: true
      }
    });
  }

  get isSetup() {
    return !!this._receiverPromise;
  }

  toString() {
    return `[MSPController #${this._instanceId}:${this.channel}]`;
  }

  setup(id) {
    this._teardown();
    this._log.info('setting up for id:', id);
    const receiverPromise = this._getReceiver(id).then(receiver => {
      if (receiver.kind !== 'data') {
        throw new Error('Expected a DataTrackReceiver');
      } if (this._receiverPromise !== receiverPromise) {
        return;
      }

      this._transport = receiver.toDataTransport();
      this.emit('ready', this._transport);

      receiver.once('close', () => this._teardown());
    });
    this._receiverPromise = receiverPromise;
  }

  _teardown() {
    if (this._transport) {
      this._log.info('Tearing down');
      this._transport = null;
      this._receiverPromise = null;
      this.emit('teardown');
    }
  }
}

module.exports = MediaSignaling;
