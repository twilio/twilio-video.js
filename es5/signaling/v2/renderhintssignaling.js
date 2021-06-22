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
var isDeepEqual = require('../../util').isDeepEqual;
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
            _dirtyTrackSids: {
                value: new Set()
            },
            _isResponsePending: {
                value: false,
                writable: true,
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
            // resend all track states. For this simply mark all tracks as dirty.
            Array.from(_this._trackSidsToRenderHints.keys()).forEach(function (trackSid) { return _this._dirtyTrackSids.add(trackSid); });
            _this._sendHints();
        });
        return _this;
    }
    RenderHintsSignaling.prototype._processHintResults = function (hintResults) {
        var _this = this;
        this._isResponsePending = false;
        hintResults.forEach(function (hintResult) {
            if (hintResult.result !== 'OK') {
                _this._log.debug('Server error processing hint:', hintResult);
            }
        });
        this._sendHints();
    };
    RenderHintsSignaling.prototype._sendHints = function () {
        var _this = this;
        if (!this._transport || this._isResponsePending || this._dirtyTrackSids.size === 0) {
            return;
        }
        var hints = [];
        Array.from(this._dirtyTrackSids).forEach(function (trackSid) {
            var mspHint = _this._trackSidsToRenderHints.get(trackSid);
            hints.push(mspHint);
            _this._dirtyTrackSids.delete(trackSid);
        });
        var payLoad = {
            type: 'render_hints',
            subscriber: {
                id: messageId++,
                hints: hints
            }
        };
        this._log.debug('Outgoing: ', payLoad);
        this._transport.publish(payLoad);
        this._isResponsePending = true;
    };
    /**
     * @param {Track.SID} trackSid
     * @param {ClientRenderHint} renderHint
     */
    RenderHintsSignaling.prototype.setTrackHint = function (trackSid, renderHint) {
        // convert hint to msp format
        var mspHint = {
            'track': trackSid,
        };
        if ('enabled' in renderHint) {
            mspHint.enabled = !!renderHint.enabled;
        }
        if (renderHint.renderDimensions) {
            // eslint-disable-next-line camelcase
            mspHint.render_dimensions = renderHint.renderDimensions;
        }
        var oldHint = this._trackSidsToRenderHints.get(trackSid);
        if (!isDeepEqual(oldHint, mspHint)) {
            this._trackSidsToRenderHints.set(trackSid, mspHint);
            this._dirtyTrackSids.add(trackSid);
            this._sendHints();
        }
    };
    /**
     * must be called when track is unsubscribed.
     * @param {Track.SID} trackSid
     */
    RenderHintsSignaling.prototype.clearTrackHint = function (trackSid) {
        this._trackSidsToRenderHints.delete(trackSid);
        this._dirtyTrackSids.delete(trackSid);
    };
    return RenderHintsSignaling;
}(MediaSignaling));
module.exports = RenderHintsSignaling;
//# sourceMappingURL=renderhintssignaling.js.map