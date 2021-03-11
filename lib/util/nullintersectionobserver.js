/* eslint-disable no-console */
'use strict';

class NullIntersectionObserver {
  constructor(callback) {
    Object.defineProperties(this, {
      _callback: {
        value: callback
      }
    });
  }

  observe(videoEl) {
    const visibleEntry = this._makeFakeEntry(videoEl, true);
    this._callback([visibleEntry]);
  }

  unobserve(videoEl) {
    const invisibleEntry = this._makeFakeEntry(videoEl, false);
    this._callback([invisibleEntry]);
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

module.exports = NullIntersectionObserver;
