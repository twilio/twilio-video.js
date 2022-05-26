/* eslint consistent-return:0 */
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
var ParticipantSignaling = require('./participant');
var RoomSignaling = require('./room');
var StateMachine = require('../statemachine');
/*
Signaling States
----------------

              +---------+
              |         |
              | opening |
         +--->|         |
         |    +---------+
    +--------+   |   |   +------+
    |        |<--+   +-->|      |
    | closed |<----------| open |
    |        |<--+   +-->|      |
    +--------+   |   |   +------+
              +---------+   |
              |         |<--+
              | closing |
              |         |
              +---------+

*/
var states = {
    closed: [
        'opening'
    ],
    opening: [
        'closed',
        'open'
    ],
    open: [
        'closed',
        'closing'
    ],
    closing: [
        'closed',
        'open'
    ]
};
/**
 * @extends StateMachine
 * @property {string} state - one of "closed", "opening", "open", or "closing"
 */
var Signaling = /** @class */ (function (_super) {
    __extends(Signaling, _super);
    /**
     * Construct {@link Signaling}.
     */
    function Signaling() {
        return _super.call(this, 'closed', states) || this;
    }
    /**
     * @private
     */
    // NOTE(mroberts): This is a dummy implementation suitable for testing.
    Signaling.prototype._close = function (key) {
        this.transition('closing', key);
        this.transition('closed', key);
        return Promise.resolve(this);
    };
    /**
     * @private
     */
    // NOTE(mroberts): This is a dummy implementation suitable for testing.
    Signaling.prototype._connect = function (localParticipant, token, encodingParameters, preferredCodecs, options) {
        localParticipant.connect('PA00000000000000000000000000000000', 'test');
        var sid = 'RM00000000000000000000000000000000';
        var promise = Promise.resolve(new RoomSignaling(localParticipant, sid, options));
        promise.cancel = function cancel() { };
        return promise;
    };
    /**
     * @private
     */
    // NOTE(mroberts): This is a dummy implementation suitable for testing.
    Signaling.prototype._open = function (key) {
        this.transition('opening', key);
        this.transition('open', key);
        return Promise.resolve(this);
    };
    /**
     * Close the {@link Signaling}.
     * @returns {Promise<this>}
     */
    Signaling.prototype.close = function () {
        var _this = this;
        return this.bracket('close', function (key) {
            switch (_this.state) {
                case 'closed':
                    return _this;
                case 'open':
                    return _this._close(key);
                default:
                    throw new Error("Unexpected Signaling state \"" + _this.state + "\"");
            }
        });
    };
    /**
     * Connect to a {@link RoomSignaling}.
     * @param {ParticipantSignaling} localParticipant
     * @param {string} token
     * @param {EncodingParametersImpl} encodingParameters
     * @param {PreferredCodecs} preferredCodecs
     * @param {object} options
     * @returns {Promise<function(): CancelablePromise<RoomSignaling>>}
     */
    Signaling.prototype.connect = function (localParticipant, token, encodingParameters, preferredCodecs, options) {
        var self = this;
        return this.bracket('connect', function transition(key) {
            switch (self.state) {
                case 'closed':
                    return self._open(key).then(transition.bind(null, key));
                case 'open':
                    // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
                    // we just need to ensure the Signaling remains open.
                    self.releaseLockCompletely(key);
                    return self._connect(localParticipant, token, encodingParameters, preferredCodecs, options);
                default:
                    throw new Error("Unexpected Signaling state \"" + self.state + "\"");
            }
        });
    };
    /**
     * Create a local {@link ParticipantSignaling}.
     * @returns {ParticipantSignaling}
     */
    Signaling.prototype.createLocalParticipantSignaling = function () {
        return new ParticipantSignaling();
    };
    /**
     * Open the {@link Signaling}.
     * @returns {Promise<this>}
     */
    Signaling.prototype.open = function () {
        var _this = this;
        return this.bracket('open', function (key) {
            switch (_this.state) {
                case 'closed':
                    return _this._open(key);
                case 'open':
                    return _this;
                default:
                    throw new Error("Unexpected Signaling state \"" + _this.state + "\"");
            }
        });
    };
    return Signaling;
}(StateMachine));
module.exports = Signaling;
//# sourceMappingURL=index.js.map