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
    let entries = [this._controlVisibility(videoEl, true)];
    this._callback(entries);
  }

  unobserve(videoEl) {
    let entries = [this._controlVisibility(videoEl, false)];
    this._callback(entries);
  }

  makeVisible(videoEl) {
    let entries = [this._controlVisibility(videoEl, true)];
    this._callback(entries);

    // const visibleEntry = this._controlVisibility(videoEl, true);
    // return visibleEntry;
  }

  makeInvisible(videoEl) {
    let entries = [this._controlVisibility(videoEl, false)];
    this._callback(entries);

    // const invisibleEntry = this._controlVisibility(videoEl, false);
    // return invisibleEntry;
  }

  _controlVisibility(videoElement, isIntersecting) {
    let entry = {};
    if (videoElement) {
      entry.target = videoElement;
    }
    // eslint-disable-next-line no-undefined
    if (isIntersecting) {
      entry.isIntersecting = isIntersecting;
    }
    return entry;
  }
}

module.exports = NullIntersectionObserver;
