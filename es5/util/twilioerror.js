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
/**
 * @extends Error
 * @property {number} code - Error code
 */
var TwilioError = /** @class */ (function (_super) {
    __extends(TwilioError, _super);
    /**
     * Creates a new {@link TwilioError}
     * @param {number} code - Error code
     * @param {string} [message] - Error message
     * @param {string} [fileName] - Name of the script file where error was generated
     * @param {number} [lineNumber] - Line number of the script file where error was generated
     */
    function TwilioError(code) {
        var _this = this;
        var args = [].slice.call(arguments, 1);
        _this = _super.apply(this, __spreadArray([], __read(args))) || this;
        Object.setPrototypeOf(_this, TwilioError.prototype);
        var error = Error.apply(_this, args);
        error.name = 'TwilioError';
        Object.defineProperty(_this, 'code', {
            value: code,
            enumerable: true
        });
        Object.getOwnPropertyNames(error).forEach(function (prop) {
            Object.defineProperty(this, prop, {
                value: error[prop],
                enumerable: true
            });
        }, _this);
        return _this;
    }
    /**
     * Returns human readable string describing the error.
     * @returns {string}
     */
    TwilioError.prototype.toString = function () {
        var message = this.message ? ": " + this.message : '';
        return this.name + " " + this.code + message;
    };
    return TwilioError;
}(Error));
module.exports = TwilioError;
//# sourceMappingURL=twilioerror.js.map