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
    } else {
      // old school shim for old browsers
      class TempCtor {
        constructor() { }
      }
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  }
};
