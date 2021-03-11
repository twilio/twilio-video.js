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
    let entries = this._makeFakeEntry(videoEl, true);
    this._callback([entries]);
  }

  unobserve(videoEl) {
    let entries = this._makeFakeEntry(videoEl, false);
    this._callback([entries]);
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
    let entry = {};
    if (videoElement) {
      entry.target = videoElement;
    }
    entry.isIntersecting = isIntersecting;
    return entry;
  }
}

module.exports = NullIntersectionObserver;
