/* eslint-disable no-console */
'use strict';

class NullObserver {
  constructor(callback) {
    Object.defineProperties(this, {
      _callback: {
        value: callback
      }
    });
  }

  observe() {
  }

  unobserve() {
  }

  makeVisible(videoEl) {
    const visibleEntry = this._makeFakeEntry(videoEl, true);
    this._callback([visibleEntry]);
  }

  makeInvisible(videoEl) {
    const invisibleEntry = this._makeFakeEntry(videoEl, false);
    this._callback([invisibleEntry]);
  }

  _makeFakeEntry(videoElement, isIntersecting) {
    return { target: videoElement, isIntersecting  };
  }
}

class NullIntersectionObserver extends NullObserver { }

class NullResizeObserver extends NullObserver {
  resize(videoEl) {
    const entry = this._makeFakeEntry(videoEl, true);
    this._callback([entry]);
  }
}


module.exports = { NullIntersectionObserver, NullResizeObserver, NullObserver };
