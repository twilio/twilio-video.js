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
var EventEmitter = require('events').EventEmitter;
var _a = require('./util/constants'), DEFAULT_NQ_LEVEL_LOCAL = _a.DEFAULT_NQ_LEVEL_LOCAL, DEFAULT_NQ_LEVEL_REMOTE = _a.DEFAULT_NQ_LEVEL_REMOTE, MAX_NQ_LEVEL = _a.MAX_NQ_LEVEL;
var inRange = require('./util').inRange;
/**
 * {@link NetworkQualityConfigurationImpl} represents an object which notifies its
 * listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements NetworkQualityConfiguration
 * @property {?NetworkQualityVerbosity} local - Verbosity level for {@link LocalParticipant}
 * @property {?NetworkQualityVerbosity} remote - Verbosity level for {@link RemoteParticipant}s
 */
var NetworkQualityConfigurationImpl = /** @class */ (function (_super) {
    __extends(NetworkQualityConfigurationImpl, _super);
    /**
     * Construct an {@link NetworkQualityConfigurationImpl}.
     * @param {NetworkQualityConfiguration} networkQualityConfiguration - Initial {@link NetworkQualityConfiguration}
     */
    function NetworkQualityConfigurationImpl(networkQualityConfiguration) {
        var _this = _super.call(this) || this;
        networkQualityConfiguration = Object.assign({
            local: DEFAULT_NQ_LEVEL_LOCAL,
            remote: DEFAULT_NQ_LEVEL_REMOTE
        }, networkQualityConfiguration);
        Object.defineProperties(_this, {
            local: {
                value: inRange(networkQualityConfiguration.local, DEFAULT_NQ_LEVEL_LOCAL, MAX_NQ_LEVEL)
                    ? networkQualityConfiguration.local
                    : DEFAULT_NQ_LEVEL_LOCAL,
                writable: true
            },
            remote: {
                value: inRange(networkQualityConfiguration.remote, DEFAULT_NQ_LEVEL_REMOTE, MAX_NQ_LEVEL)
                    ? networkQualityConfiguration.remote
                    : DEFAULT_NQ_LEVEL_REMOTE,
                writable: true
            }
        });
        return _this;
    }
    /**
     * Update the verbosity levels for network quality information for
     * {@link LocalParticipant} and {@link RemoteParticipant} with those
     * in the given {@link NetworkQualityConfiguration}.
     * @param {NetworkQualityConfiguration} networkQualityConfiguration - The new {@link NetworkQualityConfiguration}
     */
    NetworkQualityConfigurationImpl.prototype.update = function (networkQualityConfiguration) {
        var _this = this;
        networkQualityConfiguration = Object.assign({
            local: this.local,
            remote: this.remote
        }, networkQualityConfiguration);
        [
            ['local', DEFAULT_NQ_LEVEL_LOCAL, 3],
            ['remote', DEFAULT_NQ_LEVEL_REMOTE, 3]
        ].forEach(function (_a) {
            var _b = __read(_a, 3), localOrRemote = _b[0], min = _b[1], max = _b[2];
            _this[localOrRemote] = typeof networkQualityConfiguration[localOrRemote] === 'number'
                && inRange(networkQualityConfiguration[localOrRemote], min, max)
                ? networkQualityConfiguration[localOrRemote]
                : min;
        });
    };
    return NetworkQualityConfigurationImpl;
}(EventEmitter));
module.exports = NetworkQualityConfigurationImpl;
//# sourceMappingURL=networkqualityconfiguration.js.map