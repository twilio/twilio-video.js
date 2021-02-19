/* eslint callback-return:0 */
'use strict';

let messageId = 1;
let nInstances = 0;
const SDMAX_FLATTEN_DELAY = 100; // ms
class RenderHintsController  {
  /**
   * Construct a {@link RenderHintsController}.
   */
  constructor(options) {
    const log = options.log.createLog('default', this);
    log.info('RenderHintsController constructor');
    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      _log: {
        value: log
      },
      _mspTransport: {
        value: null,
        writable: true,
      },
      _trackHints: {
        value: new Map() // map of trackSid => renderHint
      },
      _dirtyTracks: {
        value: new Set() // set of dirty trackSid's
      },
      _updatePending: {
        value: false, // is set to true when we send update to SFU, and false when we hear back from SFU
        writable: true,
      },
      _messageCallback: {
        value: message => {
        // https://code.hq.twilio.com/client/room-signaling-protocol/blob/master/schema/media/render_hints/server.yaml
          this._log.debug('Incoming: ', message);
          switch (message.type) {
            case 'render_hints':
              this._processHintResults((message && message.subscriber && message.subscriber.hints) || []);
              break;
            default:
              this._log.warn('Unknown message type: ', message.type);
              break;
          }
        }
      }
    });
  }

  setTransport(mspTransport) {
    if (this._mspTransport) {
      this._mspTransport.removeListener('message', this._messageCallback);
    }

    this._mspTransport = mspTransport;
    this._updatePending = false;
    if (this._mspTransport) {
      mspTransport.addListener('message',  this._messageCallback);

      // when transport is set (either 1st time of after vms failover)
      // resend all track states. For this simply mark all tracks as dirty.
      Array.from(this._trackHints.keys()).forEach(trackSid => this._dirtyTracks.add(trackSid));
      this._sendHints();
    }
  }

  toString() {
    return `[RenderHintsController #${this._instanceId}]`;
  }

  _processHintResults(hintResults) {
    hintResults.forEach(hintResult => {
      if (hintResult.result !== 'OK') {
        this._log.error('Server error processing hint: ', hintResult);
      }
    });
    this._updatePending = false;
    this._sendHints();
  }

  // sends given hints.
  _sendHints() {
    if (!this._mspTransport || this._updatePending || this._dirtyTracks.size === 0) {
      // cant send hints currently
      // will send them when any of the above conditions change.
      return;
    }

    const hints = [];
    Array.from(this._dirtyTracks).forEach(trackSid => {
      const mspHint = this._trackHints.get(trackSid);
      hints.push(mspHint);
      this._dirtyTracks.delete(trackSid);
    });

    // send the update. schema is described here.
    // https://code.hq.twilio.com/client/room-signaling-protocol/blob/master/schema/media/render_hints/client.yaml
    const payLoad = {
      type: 'render_hints',
      subscriber: {
        id: messageId++,
        hints
      }
    };
    this._log.debug('Outgoing: ', payLoad);
    this._mspTransport.publish(payLoad);
    this._updatePending = true;
  }

  /**
   * @param {Track.SID} trackSid
   * @param {ClientRenderHint} renderHint
   */
  sendTrackHint(trackSid, renderHint) {
    // convert hint to msp format
    const mspHint = {
      'track_sid': trackSid,
      'enabled': !!renderHint.enabled,
    };

    if (renderHint.renderDimension) {
      // eslint-disable-next-line camelcase
      mspHint.render_dimension = renderHint.renderDimension;
    }

    this._trackHints.set(trackSid, mspHint);
    const needToQueueUpdate = this._dirtyTracks.size === 0;
    this._dirtyTracks.add(trackSid);

    if (needToQueueUpdate) {
      setTimeout(() => this._sendHints(), SDMAX_FLATTEN_DELAY);
    }
  }

  /**
   * must be called when track is unsubscribed.
   * @param {Track.SID} trackSid
   */
  deleteTrackState(trackSid) {
    this._trackHints.delete(trackSid);
    this._dirtyTracks.delete(trackSid);
  }
}


module.exports = RenderHintsController;
