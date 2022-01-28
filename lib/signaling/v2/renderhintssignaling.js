/* eslint callback-return:0 */
'use strict';

const MediaSignaling = require('./mediasignaling');
const Timeout = require('../../util/timeout');
const { isDeepEqual } = require('../../util');
const RENDER_HINT_RESPONSE_TIME_MS = 2000; // time to wait for server response (before resending all hints.)

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
      _responseTimer: {
        value: new Timeout(() => {
          this._sendAllHints();
          // once timer fires, for next round double the delay.
          this._responseTimer.setDelay(this._responseTimer.delay * 2);
        }, RENDER_HINT_RESPONSE_TIME_MS, false),
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
      // resend all track states.
      this._sendAllHints();
    });
  }

  _sendAllHints() {
    // to force sending all hints simply mark all tracks as dirty.
    Array.from(this._trackSidsToRenderHints.keys()).forEach(trackSid => {
      const trackState = this._trackSidsToRenderHints.get(trackSid);
      if (trackState.renderDimensions) {
        trackState.isDimensionDirty = true;
      }

      if ('enabled' in trackState) {
        trackState.isEnabledDirty = true;
      }
    });
    this._sendHints();
  }

  _processHintResults(hintResults) {
    this._responseTimer.clear();
    this._responseTimer.setDelay(RENDER_HINT_RESPONSE_TIME_MS);
    hintResults.forEach(hintResult => {
      if (hintResult.result !== 'OK') {
        this._log.debug('Server error processing hint:', hintResult);
      }
    });
    this._sendHints();
  }

  _sendHints() {
    if (!this._transport || this._responseTimer.isSet) {
      return;
    }

    const hints = [];
    Array.from(this._trackSidsToRenderHints.keys()).forEach(trackSid => {
      const trackState = this._trackSidsToRenderHints.get(trackSid);
      if (trackState.isEnabledDirty || trackState.isDimensionDirty) {
        const mspHint = {
          'track': trackSid,
        };
        if (trackState.isEnabledDirty) {
          mspHint.enabled = trackState.enabled;
          trackState.isEnabledDirty = false;
        }
        if (trackState.isDimensionDirty) {
          // eslint-disable-next-line camelcase
          mspHint.render_dimensions = trackState.renderDimensions;
          trackState.isDimensionDirty = false;
        }
        hints.push(mspHint);
      }
    });

    if (hints.length > 0) {
      const payLoad = {
        type: 'render_hints',
        subscriber: {
          id: messageId++,
          hints
        }
      };
      this._log.debug('Outgoing: ', payLoad);
      this._transport.publish(payLoad);
      this._responseTimer.start();
    }
  }

  /**
   * @param {Track.SID} trackSid
   * @param {ClientRenderHint} renderHint
   */
  setTrackHint(trackSid, renderHint) {
    const trackState = this._trackSidsToRenderHints.get(trackSid) || { isEnabledDirty: false, isDimensionDirty: false };
    if ('enabled' in renderHint && trackState.enabled !== renderHint.enabled) {
      trackState.enabled = !!renderHint.enabled;
      trackState.isEnabledDirty = true;
    }

    if (renderHint.renderDimensions && !isDeepEqual(renderHint.renderDimensions, trackState.renderDimensions)) {
      // eslint-disable-next-line camelcase
      trackState.renderDimensions = renderHint.renderDimensions;
      trackState.isDimensionDirty = true;
    }
    this._trackSidsToRenderHints.set(trackSid, trackState);
    this._sendHints();
  }

  /**
   * must be called when track is unsubscribed.
   * @param {Track.SID} trackSid
   */
  clearTrackHint(trackSid) {
    this._trackSidsToRenderHints.delete(trackSid);
  }
}


module.exports = RenderHintsSignaling;
