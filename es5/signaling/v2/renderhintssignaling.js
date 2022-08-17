/* eslint callback-return:0 */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var MediaSignaling = require('./mediasignaling');
var Timeout = require('../../util/timeout');
var isDeepEqual = require('../../util').isDeepEqual;
var RENDER_HINT_RESPONSE_TIME_MS = 2000; // time to wait for server response (before resending all hints.)
var messageId = 1;
var RenderHintsSignaling = /** @class */ (function (_super) {
    __extends(RenderHintsSignaling, _super);
    /**
     * Construct a {@link RenderHintsSignaling}.
     */
    function RenderHintsSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'render_hints', options) || this;
        Object.defineProperties(_this, {
            _trackSidsToRenderHints: {
                value: new Map()
            },
            _responseTimer: {
                value: new Timeout(function () {
                    _this._sendAllHints();
                    // once timer fires, for next round double the delay.
                    _this._responseTimer.setDelay(_this._responseTimer.delay * 2);
                }, RENDER_HINT_RESPONSE_TIME_MS, false),
            }
        });
        _this.on('ready', function (transport) {
            transport.on('message', function (message) {
                _this._log.debug('Incoming: ', message);
                switch (message.type) {
                    case 'render_hints':
                        _this._processHintResults((message && message.subscriber && message.subscriber.hints) || []);
                        break;
                    default:
                        _this._log.warn('Unknown message type: ', message.type);
                        break;
                }
            });
            // NOTE(mpatwardhan): When transport is set (either 1st time of after vms failover)
            // resend all track states.
            _this._sendAllHints();
        });
        return _this;
    }
    RenderHintsSignaling.prototype._sendAllHints = function () {
        var _this = this;
        // to force sending all hints simply mark all tracks as dirty.
        Array.from(this._trackSidsToRenderHints.keys()).forEach(function (trackSid) {
            var trackState = _this._trackSidsToRenderHints.get(trackSid);
            if (trackState.renderDimensions) {
                trackState.isDimensionDirty = true;
            }
            if ('enabled' in trackState) {
                trackState.isEnabledDirty = true;
            }
        });
        this._sendHints();
    };
    RenderHintsSignaling.prototype._processHintResults = function (hintResults) {
        var _this = this;
        this._responseTimer.clear();
        this._responseTimer.setDelay(RENDER_HINT_RESPONSE_TIME_MS);
        hintResults.forEach(function (hintResult) {
            if (hintResult.result !== 'OK') {
                _this._log.debug('Server error processing hint:', hintResult);
            }
        });
        this._sendHints();
    };
    RenderHintsSignaling.prototype._sendHints = function () {
        var _this = this;
        if (!this._transport || this._responseTimer.isSet) {
            return;
        }
        var hints = [];
        Array.from(this._trackSidsToRenderHints.keys()).forEach(function (trackSid) {
            var trackState = _this._trackSidsToRenderHints.get(trackSid);
            if (trackState.isEnabledDirty || trackState.isDimensionDirty) {
                var mspHint = {
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
            var payLoad = {
                type: 'render_hints',
                subscriber: {
                    id: messageId++,
                    hints: hints
                }
            };
            this._log.debug('Outgoing: ', payLoad);
            this._transport.publish(payLoad);
            this._responseTimer.start();
        }
    };
    /**
     * @param {Track.SID} trackSid
     * @param {ClientRenderHint} renderHint
     */
    RenderHintsSignaling.prototype.setTrackHint = function (trackSid, renderHint) {
        var trackState = this._trackSidsToRenderHints.get(trackSid) || { isEnabledDirty: false, isDimensionDirty: false };
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
    };
    /**
     * must be called when track is unsubscribed.
     * @param {Track.SID} trackSid
     */
    RenderHintsSignaling.prototype.clearTrackHint = function (trackSid) {
        this._trackSidsToRenderHints.delete(trackSid);
    };
    return RenderHintsSignaling;
}(MediaSignaling));
module.exports = RenderHintsSignaling;
//# sourceMappingURL=renderhintssignaling.js.map