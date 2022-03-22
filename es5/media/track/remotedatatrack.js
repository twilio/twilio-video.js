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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var Track = require('./');
var _a = require('../../util/constants'), E = _a.typeErrors, trackPriority = _a.trackPriority;
/**
 * A {@link RemoteDataTrack} represents data published to a {@link Room} by a
 * {@link RemoteParticipant}.
 * @extends Track
 * @property {boolean} isEnabled - true
 * @property {boolean} isSubscribed - Whether the {@link RemoteDataTrack} is
 *   subscribed to
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteDataTrack} is
 *   switched off
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which data will be transmitted or
 *   retransmitted if not acknowledged on the underlying RTCDataChannel.
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the data will be retransmitted if not successfully received on the
 *   underlying RTCDataChannel.
 * @property {boolean} ordered - true if data on the {@link RemoteDataTrack} can
 *   be received out-of-order.
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteDataTrack}
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of retransmits that will be attempted, ensuring "reliable"
 *   transmission.
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteDataTrack}
 * @emits RemoteDataTrack#message
 * @emits RemoteDataTrack#switchedOff
 * @emits RemoteDataTrack#switchedOn
 */
var RemoteDataTrack = /** @class */ (function (_super) {
    __extends(RemoteDataTrack, _super);
    /**
     * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
     * @param {Track.SID} sid
     * @param {DataTrackReceiver} dataTrackReceiver
     * @param {{log: Log, name: ?string}} options
     */
    function RemoteDataTrack(sid, dataTrackReceiver, options) {
        var _this = _super.call(this, dataTrackReceiver.id, 'data', options) || this;
        Object.defineProperties(_this, {
            _isSwitchedOff: {
                value: false,
                writable: true
            },
            _priority: {
                value: null,
                writable: true
            },
            isEnabled: {
                enumerable: true,
                value: true
            },
            isSwitchedOff: {
                enumerable: true,
                get: function () {
                    return this._isSwitchedOff;
                }
            },
            maxPacketLifeTime: {
                enumerable: true,
                value: dataTrackReceiver.maxPacketLifeTime
            },
            maxRetransmits: {
                enumerable: true,
                value: dataTrackReceiver.maxRetransmits
            },
            ordered: {
                enumerable: true,
                value: dataTrackReceiver.ordered
            },
            priority: {
                enumerable: true,
                get: function () {
                    return this._priority;
                }
            },
            reliable: {
                enumerable: true,
                value: dataTrackReceiver.maxPacketLifeTime === null
                    && dataTrackReceiver.maxRetransmits === null
            },
            sid: {
                enumerable: true,
                value: sid
            }
        });
        dataTrackReceiver.on('message', function (data) {
            _this.emit('message', data, _this);
        });
        return _this;
    }
    /**
     * Update the subscriber {@link Track.Priority} of the {@link RemoteDataTrack}.
     * @param {?Track.Priority} priority - the new {@link Track.priority};
     *   Currently setPriority has no effect on data tracks.
     * @returns {this}
     * @throws {RangeError}
     */
    RemoteDataTrack.prototype.setPriority = function (priority) {
        var priorityValues = __spreadArray([null], __read(Object.values(trackPriority)));
        if (!priorityValues.includes(priority)) {
            // eslint-disable-next-line new-cap
            throw E.INVALID_VALUE('priority', priorityValues);
        }
        // Note: priority has no real effect on the data tracks.
        this._priority = priority;
        return this;
    };
    /**
     * @private
     */
    RemoteDataTrack.prototype._setEnabled = function () {
        // Do nothing.
    };
    /**
     * @private
     * @param {boolean} isSwitchedOff
     */
    RemoteDataTrack.prototype._setSwitchedOff = function (isSwitchedOff) {
        if (this._isSwitchedOff !== isSwitchedOff) {
            this._isSwitchedOff = isSwitchedOff;
            this.emit(isSwitchedOff ? 'switchedOff' : 'switchedOn', this);
        }
    };
    return RemoteDataTrack;
}(Track));
/**
 * A message was received over the {@link RemoteDataTrack}.
 * @event RemoteDataTrack#message
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that received
 *   the message
 */
/**
 * A {@link RemoteDataTrack} was switched off.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   switched off
 * @event RemoteDataTrack#switchedOff
 */
/**
 * A {@link RemoteDataTrack} was switched on.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   switched on
 * @event RemoteDataTrack#switchedOn
 */
module.exports = RemoteDataTrack;
//# sourceMappingURL=remotedatatrack.js.map