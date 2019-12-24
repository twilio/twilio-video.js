/* eslint-disable indent */
'use strict';

const { EventEmitter } = require('events');

const DominantSpeakerSignaling = require('./dominantspeakersignaling');
const NetworkQualitySignaling = require('./networkqualitysignaling');
const TrackPrioritySignaling = require('./trackprioritysignaling');
const TrackSwitchOffSignaling = require('./trackswitchoffsignaling');

class MediaSignalingManager extends EventEmitter {
  constructor(networkQualityConfiguration, getTrackReceiver, options) {
    super();
    options = Object.assign({
      DominantSpeakerSignaling,
      NetworkQualitySignaling,
      TrackPrioritySignaling,
      TrackSwitchOffSignaling,
    }, options);
    Object.defineProperties(this, {
      _mspObjects: {
        value: new Map()
      },
      _getTrackReceiver: {
        value: getTrackReceiver
      },
      _DominantSpeakerSignaling: {
        value: options.DominantSpeakerSignaling
      },
      _NetworkQualitySignaling: {
        value: options.NetworkQualitySignaling
      },
      _networkQualityConfiguration: {
        value: networkQualityConfiguration
      },
      _TrackPrioritySignaling: {
        value: options.TrackPrioritySignaling
      },
      _TrackSwitchOffSignaling: {
        value: options.TrackSwitchOffSignaling
      }
    });
    [
      'active_speaker',
      'network_quality',
      'track_priority',
      'track_switch_off'
    ].forEach(msp => this._mspObjects.set(msp, {
      promise: null,
    }));
  }

  update(mediaSignaling) {
    if (mediaSignaling) {
      [...this._mspObjects.keys()].forEach(msp => {
        const mspSignal = mediaSignaling[msp];
        const mspObject = this._mspObjects.get(msp);
        if (!mspObject.promise
          && mspSignal
          && mspSignal.transport
          && mspSignal.transport.type === 'data-channel'
        ) {
          // tear down
          this._tearDownSignaling(msp);
          const id = mspSignal.transport.label;
          const signalingPromise = this._getTrackReceiver(id).then(receiver => {
            if (receiver.kind !== 'data') {
              throw new Error('Expected a DataTrackReceiver');
            } if (mspObject.promise !== signalingPromise) {
              // _tearDownSignaling was called.
              return;
            }

            // NOTE(mpatwardhan): The underlying RTCDataChannel is closed whenever
            // the VMS instance fails over, and a new RTCDataChannel is created in order
            // to resume sending Dominant Speaker updates.
            receiver.once('close', () => this._tearDownSignaling(msp));

            let signalingObject = null;
            const dataTransport = receiver.toDataTransport();
            switch (msp) {
              case 'active_speaker':
                signalingObject = new this._DominantSpeakerSignaling(dataTransport);
                break;
              case 'network_quality':
                signalingObject = new this._NetworkQualitySignaling(dataTransport, this._networkQualityConfiguration);
                break;
              case 'track_priority':
                signalingObject = new this._TrackPrioritySignaling(dataTransport);
                break;
              case 'track_switch_off':
                signalingObject = new this._TrackSwitchOffSignaling(dataTransport);
                break;
              }
              this.emit(msp, signalingObject);
          });
          mspObject.promise = signalingPromise;
        }
      });
    }
  }

  tearDown() {
    [...this._mspObjects.keys()].forEach(msp => this._tearDownSignaling(msp));
  }

  _tearDownSignaling(msp) {
    const mspObject = this._mspObjects.get(msp);
    mspObject.promise = null;
    mspObject.signaling = null;
    this.emit(msp, null);
  }

}

module.exports = MediaSignalingManager;
