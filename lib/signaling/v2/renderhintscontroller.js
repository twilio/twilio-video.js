/* eslint callback-return:0 */
'use strict';

let messageId = 1;
let nInstances = 0;
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
        value: new Map() // map of trackSid => { renderHint }
      },
      _dirtyTracks: {
        value: new Set() // set of track sids that are not yet sent to server.
      },
      _updatePending: {
        value: false,
        writable: true,
      },
      _messageCallback: {
        value: message => {
        // https://code.hq.twilio.com/client/room-signaling-protocol/blob/master/schema/media/render_hints/server.yaml
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
    if (this._mspTransport) {
      mspTransport.addListener('message',  this._messageCallback);

      // when transport is set (either 1st time of after vms failover
      // resend track states.
      this._sendHints(Array.from(this._trackHints.keys()));
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
    this._sendUpdates();
  }

  // sends given hints.
  _sendHints(trackSidArray) {
    const hints = [];
    trackSidArray.forEach(trackSid => {
      const hint = this._trackHints.get(trackSid);
      hints.push({
        'track_sid': trackSid,
        'enabled': hint.enabled,
        'render_dimension': {
          height: hint.renderDimension.height,
          width: hint.renderDimension.width,
        }
      });
      this._dirtyTracks.delete(trackSid);
    });

    if (hints.length > 0) {
      // send the update. schema is described here.
      // https://code.hq.twilio.com/client/room-signaling-protocol/blob/master/schema/media/render_hints/client.yaml
      this._mspTransport.publish({ type: 'render_hints',
        subscriber: {
          id: messageId++,
          hints
        } });
      this._updatePending = true;
    }
  }

  /**
   * @private
   * sends out any dirtyTracks
   */
  _sendUpdates() {
    if (this._mspTransport && !this._updatePending) {
      this._sendHints(Array.from(this._dirtyTracks));
    }
  }

  /**
   * @param {Track.SID} trackSid
   * @param {RenderHint} renderHint
   */
  sendTrackHint(trackSid, renderHint) {
    // save updated track state.
    this._trackHints.set(trackSid, renderHint);
    this._dirtyTracks.add(trackSid);
    this._sendUpdates();
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
