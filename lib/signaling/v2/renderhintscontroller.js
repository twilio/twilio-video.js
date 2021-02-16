/* eslint callback-return:0 */
'use strict';

let messageId = 1;
let nInstances = 0;
class RenderHintsController  {
  /**
   * Construct a {@link RenderHintsController}.
   */
  constructor(mspTransport, options) {
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
        value: mspTransport
      },
      _trackHints: {
        value: new Map() // map of trackSid => { renderHint }
      },
      _dirtyTracks: {
        value: new Set() // set of track sids that we have not yet sent to server.
      },
      _updatePending: {
        value: false,
        writable: true,
      },
    });

    // when transport goes ready (either 1st time, or due after VMS failover)
    this._mspTransport.on('ready', mediaSignalingTransport => {
      // start listening for messages
      mediaSignalingTransport.on('message', message => {
        // https://code.hq.twilio.com/client/room-signaling-protocol/blob/master/schema/media/render_hints/server.yaml
        switch (message.type) {
          case 'render_hints':
            this._processHintResults((message && message.subscriber && message.subscriber.hints) || []);
            break;
          default:
            this._log.warn('Unknown message type: ', message.type);
            break;
        }
      });

      // and send the current state of tracks initially.
      this._sendHints(Array.from(this._trackHints.keys()));
    });
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
    });

    // send the update. schema is described here.
    // https://code.hq.twilio.com/client/room-signaling-protocol/blob/master/schema/media/render_hints/client.yaml
    this._mspController.mediaSignalingTransport.publishMessage({ type: 'render_hints',
      subscriber: {
        id: messageId++,
        hints
      } });
    this._updatePending = true;
  }

  _sendUpdates() {
    if (this.isReady() && !this._updatePending) {
      this._sendHints(Array.from(this._dirtyTracks));
      this._dirtyTracks.clear();
    }
  }

  /**
   * @param {Track.SID} trackSid
   */
  sendTrackHint(trackSid, renderHint) {
    // save updated track state.
    this._trackHints.set(trackSid, renderHint);
    this._dirtyTracks.add(trackSid);
    this._sendUpdates();
  }

  // must be called when track is unsubscribed.
  deleteTrackState(trackSid) {
    this._trackHints.delete(trackSid);
    this._dirtyTracks.delete(trackSid);
  }
}

module.exports = RenderHintsController;
