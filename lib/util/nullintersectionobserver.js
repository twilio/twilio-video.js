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
    console.log('visible element', videoEl);
    let entries = [this._controlVisibility(videoEl, true)];
    this._callback(entries);
  }

  makeInivisible() {
    console.log('invisible html element');
    let entries = [this._controlVisibility('someEl', false)];
    this._callback(entries);
  }

  _controlVisibility(videoElement, isIntersecting) {
    let entry = {};
    if (videoElement) {
      entry.target = videoElement;
    }
    if (isIntersecting) {
      entry.isIntersecting = isIntersecting;
    }
    return entry;
  }
}

module.exports = NullIntersectionObserver;
