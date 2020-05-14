/* eslint-disable no-console */
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
    super(mediaStreamTrack.id, mediaStreamTrack);
    console.log(`makarand MediaTrackTransceiver[${this._instanceId}]: constructor`);
    Object.defineProperties(this, {
      _senders: {
        value: new Set()
      },
      _clones: {
        value: new Set()
      },
      _restartOptions: {
        value: restartOptions || {}
      },
      _stateChangedCallback: {
        value: null,
        writable: true
      },
    });
  }

  log(...args) {
    // eslint-disable-next-line no-console
    console.log(`Makarand[${this._instanceId}]: MediaTrackTransceiver: `, ...args);
  }

  _shouldAttemptRestart() {
    // TODO: check if track was stopped intentionally.
    const isDocumentVisible = document && document.hidden === false;
    return isDocumentVisible && this._restartOptions.trackReAcquireCallback &&
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
      }, 1);
    }
  }

  wasStopped() {
    // local audio track was stopped intentionally.
    // now we do expect a track.ended event thru
    // localTrackPublication.stop() => MediaTrackTransceiver.stop => track.stop => ended.
    // but we do not want to restart the track in this case, as it was intentionally stopped.
    // stop watching for new events.
    this.log(' was notified of track getting stopped from API');
    this._startWatching(false);

    // let the clones know
    this._clones.forEach(clone => clone.wasStopped());

    // and update our options so that we do not start listening to track again.
    this._restartOptions.trackReAcquireCallback = null;
  }

  /**
   * Return a new {@link MediaTrackSender} containing a clone of the underlying
   * MediaStreamTrack. No RTCRtpSenders are copied.
   * @returns {MediaTrackSender}
   */
  clone() {
    const clone = new MediaTrackSender(this.track.clone(), this._restartOptions);
    this._clones.add(clone);
    return clone;
  }

  _startWatching(start) {
    // eslint-disable-next-line no-undefined
    if (!document || !document.addEventListener || document.hidden === undefined) {
      this.log('This requires a modern browser that supports document Visibility');
      return;
    }

    if (start && !this._stateChangedCallback) {
      // we should stop watching once track stops.
      // this.once('stopped', () => this._startWatching(false));
      this.log('will start watching the track for state changes');
      this._stateChangedCallback = () => this._handleTrackStateChange();
      this.track.addEventListener('mute', this._stateChangedCallback);
      this.track.addEventListener('unmute', this._stateChangedCallback);
      this.track.addEventListener('ended', this._stateChangedCallback);
      document.addEventListener('visibilitychange', this._stateChangedCallback);
    } else if (!start && this._stateChangedCallback) {
      this.log('will stop watching the track for state changes');
      this.track.removeEventListener('mute', this._stateChangedCallback);
      this.track.removeEventListener('unmute', this._stateChangedCallback);
      this.track.removeEventListener('ended', this._stateChangedCallback);
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
