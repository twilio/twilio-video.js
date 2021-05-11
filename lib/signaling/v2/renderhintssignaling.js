/* eslint callback-return:0 */
'use strict';

const MediaSignaling = require('./mediasignaling');
const { isDeepEqual } = require('../../util');

let messageId = 1;
class RenderHintsSignaling extends MediaSignaling {
  /**
   * Construct a {@link RenderHintsSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'render_hints', options);
    Object.defineProperties(this, {
      _trackSidsToRenderHints: {
        value: new Map()
      },
      _dirtyTrackSids: {
        value: new Set()
      },
      _isResponsePending: {
        value: false,
        writable: true,
      }
    });

    this.on('ready', transport => {
      transport.on('message', message => {
        this._log.debug('Incoming: ', message);
        switch (message.type) {
          case 'render_hints':
            this._processHintResults((message && message.subscriber && message.subscriber.hints) || []);
            break;
          default:
            this._log.warn('Unknown message type: ', message.type);
            break;
        }
      });

      // NOTE(mpatwardhan): When transport is set (either 1st time of after vms failover)
      // resend all track states. For this simply mark all tracks as dirty.
      Array.from(this._trackSidsToRenderHints.keys()).forEach(trackSid => this._dirtyTrackSids.add(trackSid));
      this._sendHints();
    });
  }

  _processHintResults(hintResults) {
    this._isResponsePending = false;
    hintResults.forEach(hintResult => {
      if (hintResult.result !== 'OK') {
        this._log.debug('Server error processing hint:', hintResult);
      }
    });
    this._sendHints();
  }

  _sendHints() {
    if (!this._transport || this._isResponsePending || this._dirtyTrackSids.size === 0) {
      return;
    }

    const hints = [];
    Array.from(this._dirtyTrackSids).forEach(trackSid => {
      const mspHint = this._trackSidsToRenderHints.get(trackSid);
      hints.push(mspHint);
      this._dirtyTrackSids.delete(trackSid);
    });

    const payLoad = {
      type: 'render_hints',
      subscriber: {
        id: messageId++,
        hints
      }
    };
    this._log.debug('Outgoing: ', payLoad);
    this._transport.publish(payLoad);
    this._isResponsePending = true;
  }

  /**
   * @param {Track.SID} trackSid
   * @param {ClientRenderHint} renderHint
   */
  setTrackHint(trackSid, renderHint) {
    // convert hint to msp format
    const mspHint = {
      'track': trackSid,
    };

    if ('enabled' in renderHint) {
      mspHint.enabled = !!renderHint.enabled;
    }

    if (renderHint.renderDimensions) {
      // eslint-disable-next-line camelcase
      mspHint.render_dimensions = renderHint.renderDimensions;
    }

    const oldHint = this._trackSidsToRenderHints.get(trackSid);
    if (!isDeepEqual(oldHint, mspHint)) {
      this._trackSidsToRenderHints.set(trackSid, mspHint);
      this._dirtyTrackSids.add(trackSid);
      this._sendHints();
    }
  }

  /**
   * must be called when track is unsubscribed.
   * @param {Track.SID} trackSid
   */
  clearTrackHint(trackSid) {
    this._trackSidsToRenderHints.delete(trackSid);
    this._dirtyTrackSids.delete(trackSid);
  }
}


module.exports = RenderHintsSignaling;
