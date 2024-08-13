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
var defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var LocalParticipantV2 = require('./localparticipant');
var Signaling = require('../');
/**
 * {@link SignalingV2} implements version 2 of our signaling protocol.
 * @extends Signaling
 */
var SignalingV2 = /** @class */ (function (_super) {
    __extends(SignalingV2, _super);
    /**
     * Construct {@link SignalingV2}.
     * @param {string} wsServer
     * @param {?object} [options={}]
     */
    function SignalingV2(wsServer, options) {
        var _this = this;
        /* eslint new-cap:0 */
        options = Object.assign({
            createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise
        }, options);
        _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _createCancelableRoomSignalingPromise: {
                value: options.createCancelableRoomSignalingPromise
            },
            _options: {
                value: options
            },
            _wsServer: {
                value: wsServer
            }
        });
        return _this;
    }
    /**
     * @private
     */
    SignalingV2.prototype._connect = function (localParticipant, token, encodingParameters, preferredCodecs, options) {
        options = Object.assign({}, this._options, options);
        return this._createCancelableRoomSignalingPromise.bind(null, token, this._wsServer, localParticipant, encodingParameters, preferredCodecs, options);
    };
    SignalingV2.prototype.createLocalParticipantSignaling = function (encodingParameters, networkQualityConfiguration) {
        return new LocalParticipantV2(encodingParameters, networkQualityConfiguration);
    };
    return SignalingV2;
}(Signaling));
module.exports = SignalingV2;
//# sourceMappingURL=index.js.map