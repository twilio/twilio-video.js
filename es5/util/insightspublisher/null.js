// eslint-disable-next-line no-warning-comments
// TODO(mroberts): This should be described as implementing some
// InsightsPublisher interface.
'use strict';
/**
 * Null Insights publisher.
 */
var InsightsPublisher = /** @class */ (function () {
    function InsightsPublisher() {
        Object.defineProperties(this, {
            _connected: {
                writable: true,
                value: true
            }
        });
    }
    /**
     * Connect
     * @returns {void}
     */
    InsightsPublisher.prototype.connect = function () {
    };
    /**
     * Disconnect.
     * @returns {boolean}
     */
    InsightsPublisher.prototype.disconnect = function () {
        if (this._connected) {
            this._connected = false;
            return true;
        }
        return false;
    };
    /**
     * Publish.
     * @returns {boolean}
     */
    InsightsPublisher.prototype.publish = function () {
        return this._connected;
    };
    return InsightsPublisher;
}());
module.exports = InsightsPublisher;
//# sourceMappingURL=null.js.map