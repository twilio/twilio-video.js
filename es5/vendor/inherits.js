/**
 * Copyright (c) 2011-2022 Isaac Z. Schlueter
 * Licensed under the ISC License.
 *
 * Copied from https://github.com/isaacs/inherits (2.0.4)
*/
module.exports = function inherits(ctor, superCtor) {
    if (ctor && superCtor) {
        ctor.super_ = superCtor;
        if (typeof Object.create === 'function') {
            // implementation from standard node.js 'util' module
            ctor.prototype = Object.create(superCtor.prototype, {
                constructor: {
                    value: ctor,
                    enumerable: false,
                    writable: true,
                    configurable: true
                }
            });
        }
        else {
            // old school shim for old browsers
            var TempCtor = /** @class */ (function () {
                function TempCtor() {
                }
                return TempCtor;
            }());
            TempCtor.prototype = superCtor.prototype;
            ctor.prototype = new TempCtor();
            ctor.prototype.constructor = ctor;
        }
    }
};
//# sourceMappingURL=inherits.js.map