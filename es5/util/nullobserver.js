/* eslint-disable no-console */
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
var NullObserver = /** @class */ (function () {
    function NullObserver(callback) {
        Object.defineProperties(this, {
            _callback: {
                value: callback
            }
        });
    }
    NullObserver.prototype.observe = function () {
    };
    NullObserver.prototype.unobserve = function () {
    };
    NullObserver.prototype.makeVisible = function (videoEl) {
        var visibleEntry = this._makeFakeEntry(videoEl, true);
        this._callback([visibleEntry]);
    };
    NullObserver.prototype.makeInvisible = function (videoEl) {
        var invisibleEntry = this._makeFakeEntry(videoEl, false);
        this._callback([invisibleEntry]);
    };
    NullObserver.prototype._makeFakeEntry = function (videoElement, isIntersecting) {
        return { target: videoElement, isIntersecting: isIntersecting };
    };
    return NullObserver;
}());
var NullIntersectionObserver = /** @class */ (function (_super) {
    __extends(NullIntersectionObserver, _super);
    function NullIntersectionObserver() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return NullIntersectionObserver;
}(NullObserver));
var NullResizeObserver = /** @class */ (function (_super) {
    __extends(NullResizeObserver, _super);
    function NullResizeObserver() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    NullResizeObserver.prototype.resize = function (videoEl) {
        var entry = this._makeFakeEntry(videoEl, true);
        this._callback([entry]);
    };
    return NullResizeObserver;
}(NullObserver));
module.exports = { NullIntersectionObserver: NullIntersectionObserver, NullResizeObserver: NullResizeObserver, NullObserver: NullObserver };
//# sourceMappingURL=nullobserver.js.map