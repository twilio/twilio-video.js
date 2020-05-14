'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * A {@link MediaTrackSender} represents one or more local RTCRtpSenders.
 * @extends MediaTrackTransceiver
 */
class MediaTrackSender extends MediaTrackTransceiver {

  /**
   * Construct a {@link MediaTrackSender}.
   * @param {MediaStreamTrack} mediaStreamTrack
   */
  constructor(mediaStreamTrack,  restartOptions = {}) {
    console.log('makarand MediaTrackSender');
    super(mediaStreamTrack.id, mediaStreamTrack);
    Object.defineProperties(this, {
      _senders: {
        value: new Set()
      },
      _visibilityListenerRegistration: {
        value: null,
        writable: true
      },
      _documentIsHidden: {
        value: true,
        writable: true,
      },
      _restartOptions: {
        value: restartOptions || {}
      },
      _stateChangedCallback: {
        value: null,
        writable: true
      }
    });
  }

  log(...args) {
    // eslint-disable-next-line no-console
    console.log('Makarand: MediaTrackTransceiver: ', ...args);
  }

  _shouldAttemptRestart() {
    // TODO: check if track was stopped intentionally.
    return !this._documentIsHidden && this._restartOptions.trackReAcquireCallback &&
          ((this.track.muted && this._restartOptions.restartOnMuted) ||
          (this.track.readyState === 'ended' && this._restartOptions.restartOnEnded));
  }

  _handleTrackStateChange() {
    if (this._shouldAttemptRestart()) {
      // give it a second for things to come back to normal
      this.log('will replace tracks after 1 second');
      setTimeout(() => {
        this.log('checking if still need to replace track');
        if (this._shouldAttemptRestart()) {
          // replace tracks.
          this._restartOptions.trackReAcquireCallback().then(newTrack => {
            this.log('will replace tracks');
            this.track = newTrack;
            this._senders.forEach(sender => {
              this.log('replacing tracks');
              const replaceTrackPromise = sender.replaceTrack(this.track);
              replaceTrackPromise.then(() => {
                this.log('track replaced successfully');
              }).catch(err => {
                this.log('track replace failed', err);
              });
            });
          }).catch(err => {
            this.log('error, _trackReAcquireCallback failed', err);
          });
        } else {
          this.log('no need to replace track giving up');
        }
      }, 1000);
    }
  }

  // updates this._documentIsHidden depending on the visible state of document.
  // returns a function to unregister for listening..
  _listenForVisibilityChange(onStateChanged) {
    // Set the name of the hidden property and the change event for visibility
    let hidden;
    let visibilityChange;
    if (typeof document.hidden !== 'undefined') { // Opera 12.10 and Firefox 18 and later support
      hidden = 'hidden';
      visibilityChange = 'visibilitychange';
    } else if (typeof document.msHidden !== 'undefined') {
      hidden = 'msHidden';
      visibilityChange = 'msvisibilitychange';
    } else if (typeof document.webkitHidden !== 'undefined') {
      hidden = 'webkitHidden';
      visibilityChange = 'webkitvisibilitychange';
    }

    this._documentIsHidden = document[hidden];
    this.log(`Will use: ${hidden}, ${visibilityChange}`);
    const handleVisibilityChange = () => {
      if (document[hidden]) {
        this.log('document was hidden');
        this._documentIsHidden = true;
        onStateChanged();
      } else {
        this._documentIsHidden = false;
        this.log('document was visible');
        onStateChanged();
      }
      if (this.track) {
        this.log(`visibilityState = ${document.visibilityState}, muted = ${this.track.muted} readyState = ${this.track.readyState}`);
      }
    };
    // Warn if the browser doesn't support addEventListener or the Page Visibility API
    // eslint-disable-next-line no-undefined
    if (document && typeof document.addEventListener && hidden !== undefined) {
      // Handle page visibility change
      document.addEventListener(visibilityChange, handleVisibilityChange);
      return function() {
        document.removeEventListener(visibilityChange, handleVisibilityChange);
      };
    }

    this.log('This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.');
    // return no op function
    return () => {};
  }

  /**
   * Return a new {@link MediaTrackSender} containing a clone of the underlying
   * MediaStreamTrack. No RTCRtpSenders are copied.
   * @returns {MediaTrackSender}
   */
  clone() {
    return new MediaTrackSender(this.track.clone(), this._restartOptions);
  }

  _startWatching(start) {
    if (start && !this._visibilityListenerRegistration) {
      // we should stop watching once track stops.
      // this.once('stopped', () => this._startWatching(false));
      this.log('will start watching the track for state changes');

      this._stateChangedCallback = () => this._handleTrackStateChange();
      this.track.addEventListener('mute', this._stateChangedCallback);
      this.track.addEventListener('unmute', this._stateChangedCallback);
      this.track.addEventListener('ended', this._stateChangedCallback);
      this._visibilityListenerRegistration = this._listenForVisibilityChange(this._stateChangedCallback);
    } else if (!start && this._visibilityListenerRegistration) {
      this.log('will stop watching the track for state changes');
      this.track.removeEventListener('mute', this._stateChangedCallback);
      this.track.removeEventListener('unmute', this._stateChangedCallback);
      this.track.removeEventListener('ended', this._stateChangedCallback);
      this._visibilityListenerRegistration();
      this._visibilityListenerRegistration = null;
      this._stateChangedCallback = null;
    }
  }

  /**
   * Add an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @returns {this}
   */
  addSender(sender) {
    this._senders.add(sender);
    if (this._senders.size === 1) {
      // need to watch for mediaStream going bad.
      this._startWatching(true);
    }
    return this;
  }

  /**
   * Remove an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @returns {this}
   */
  removeSender(sender) {
    this._senders.delete(sender);
    if (this._senders.size === 0) {
      this._startWatching(false);
    }
    return this;
  }
}

module.exports = MediaTrackSender;
