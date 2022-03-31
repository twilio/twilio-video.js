'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const { capitalize, randomBoolean, randomName } = require('../../../../lib/util');
const RemoteAudioTrackPublication = require('../../../../../lib/media/track/remoteaudiotrackpublication');
const RemoteDataTrackPublication = require('../../../../../lib/media/track/remotedatatrackpublication');
const RemoteVideoTrackPublication = require('../../../../../lib/media/track/remotevideotrackpublication');

[
  ['audio', RemoteAudioTrackPublication],
  ['data', RemoteDataTrackPublication],
  ['video', RemoteVideoTrackPublication]
].forEach(([kind, RemoteTrackPublication]) => {
  const className = `Remote${capitalize(kind)}TrackPublication`;
  describe(className, () => {
    describe('constructor', () => {
      let log;
      let publication;
      let signaling;

      before(() => {
        signaling = makeSignaling(randomBoolean(), false, kind, 'MT123');
        publication = new RemoteTrackPublication(signaling);
        log = publication._log;
        log.warn = sinon.spy();
      });

      it(`should return an instance of ${className}`, () => {
        assert(publication instanceof RemoteTrackPublication);
      });

      [
        ['isSubscribed', () => false],
        ['isTrackEnabled', () => signaling.isEnabled],
        ['kind', () => kind],
        ['publishPriority', () => signaling.priority],
        ['track', () => null],
        ['trackName', () => signaling.name],
        ['trackSid', () => signaling.sid]
      ].forEach(([prop, getExpectedValue]) => {
        it(`should set the .${prop} property`, () => {
          assert.equal(publication[prop], getExpectedValue());
        });

        if (prop === 'isTrackEnabled') {
          it('should show deprecation warning when accessed the first time', () => {
            sinon.assert.callCount(log.warn, 1);
            sinon.assert.calledWith(log.warn, '.isTrackEnabled is deprecated and scheduled for removal. During the deprecation period, this property is only valid if the corresponding RemoteTrack is subscribed to. The RemoteTrack can be considered disabled if .switchOffReason is set to "disabled-by-publisher".');
          });

          it('should not show deprecation warning when accessed the second time', () => {
            assert(typeof publication[prop], 'boolean');
            sinon.assert.callCount(log.warn, 1);
          });
        }
      });

      [
        ['trackDisabled', `${className}#trackDisabled has been deprecated and scheduled for removal. Use ${className}#trackSwitchedOff (track.switchOffReason === "disabled-by-publisher") instead.`],
        ['trackEnabled', `${className}#trackEnabled has been deprecated and scheduled for removal. Use ${className}#trackSwitchedOn instead.`]
      ].forEach(([event, warning], i) => {
        it(`should emit deprecation warning when "${event}" event is listened to for the first time`, () => {
          publication.on(event, () => {});
          sinon.assert.callCount(log.warn, 2 + i);
          sinon.assert.calledWith(log.warn, warning);
        });

        it(`should not emit deprecation warning when "${event}" event is listened to for the second time`, () => {
          publication.on(event, () => {});
          sinon.assert.callCount(log.warn, 2 + i);
        });
      });
    });

    describe('#_subscribed', () => {
      [
        [null, null],
        [null, makeTrack()],
        [makeTrack(), null],
        [makeTrack(), makeTrack()]
      ].forEach(([track, newTrack]) => {
        context(`called with a ${newTrack ? 'non-' : ''}null RemoteTrack when .track is ${track ? 'not ' : ''}null`, () => {
          let publication;
          let signaling;
          let subscribedTrack;

          beforeEach(() => {
            signaling = makeSignaling(randomBoolean(), false, kind, 'MT123');
            publication = new RemoteTrackPublication(signaling);
            publication._subscribed(track);
            publication.once('subscribed', track => {
              subscribedTrack = track;
            });
            publication._subscribed(newTrack);
          });

          if (!track && newTrack) {
            it('should set .isSubscribed to true', () => {
              assert(publication.isSubscribed);
            });

            it('should set the .track property', () => {
              assert.equal(publication.track, newTrack);
            });

            it(`should emit "subscribed" on the ${className}`, () => {
              assert.equal(subscribedTrack, newTrack);
            });

            return;
          }

          it('should not change the .track property', () => {
            assert.equal(publication.track, track);
          });

          it(`should not emit "subscribed" on the ${className}`, () => {
            assert(!subscribedTrack);
          });
        });
      });
    });

    describe('#_unsubscribe', () => {
      [null, makeTrack()].forEach(track => {
        context(`called when .track is ${track ? 'not ' : ''}null`, () => {
          let publication;
          let signaling;
          let unsubscribedTrack;

          beforeEach(() => {
            signaling = makeSignaling(randomBoolean(), false, kind, 'MT123');
            publication = new RemoteTrackPublication(signaling);
            publication._subscribed(track);
            publication.once('unsubscribed', track => {
              unsubscribedTrack = track;
            });
            publication._unsubscribe();
          });

          if (track) {
            it('should set .isSubscribed to false', () => {
              assert(!publication.isSubscribed);
            });

            it('should set the .track property to null', () => {
              assert.equal(publication.track, null);
            });

            it(`should emit "unsubscribed" on the ${className}`, () => {
              assert.equal(unsubscribedTrack, track);
            });

            return;
          }

          it('should not change the .track property', () => {
            assert.equal(publication.track, track);
          });

          it(`should not emit "unsubscribed" on the ${className}`, () => {
            assert(!unsubscribedTrack);
          });
        });
      });
    });

    describe('RemoteTrackSignaling updates', () => {
      [
        ['publishPriorityChanged', { priority: 'foo' }, 'publishPriority'],
        ['subscriptionFailed', { error: new Error('foo') }],
        ['trackDisabled', { isEnabled: false }, 'isTrackEnabled'],
        ['trackEnabled', { isEnabled: true }, 'isTrackEnabled'],
        ['trackSwitchedOff', { isSwitchedOff: true }],
        ['trackSwitchOffReasonChanged', { switchOffReason: 'zee' }]
      ].forEach(([event, options, prop]) => {
        context(`when "updated" is emitted on the underlying RemoteTrackPublicationSignaling due to ${{
          publishPriorityChanged: '.publishPriority being set to a new value',
          subscriptionFailed: 'a subscription error',
          trackDisabled: '.isEnabled being set to false',
          trackEnabled: '.isEnabled being set to true',
          trackSwitchedOff: '.isSwitchedOff being set to true',
          trackSwitchOffReasonChanged: '.switchOffReason changing'
        }[event]}`, () => {
          let publication;
          let signaling;

          beforeEach(() => {
            signaling = makeSignaling(event !== 'trackEnabled', event === 'trackSwitchOffReasonChanged', kind, 'MT123');
            publication = new RemoteTrackPublication(signaling);
          });

          if (event === 'subscriptionFailed') {
            it(`should emit "subscriptionFailed" on the ${className}`, () => {
              let error;
              publication.once('subscriptionFailed', err => {
                error = err;
              });
              signaling.update(options);
              assert.equal(error, options.error);
            });
            return;
          }

          [true, false].forEach(isSubscribed => {
            context(`when the Remote${capitalize(kind)}Track is ${isSubscribed ? '' : 'not '}subscribed to`, () => {
              const trackEvent = {
                trackDisabled: 'disabled',
                trackEnabled: 'enabled',
                trackSwitchedOff: 'switchedOff',
                trackSwitchOffReasonChanged: 'switchedOff'
              }[event];

              const publicationEvent = event === 'trackSwitchOffReasonChanged'
                ? 'trackSwitchedOff'
                : event;

              let publicationEventEmitted;
              let trackEventEmitted;

              beforeEach(() => {
                if (isSubscribed) {
                  const track = makeTrack(signaling.isEnabled);
                  track.once(trackEvent, () => {
                    trackEventEmitted = true;
                  });
                  publication._subscribed(track);
                }
                publication.once(publicationEvent, () => {
                  publicationEventEmitted = true;
                });
                signaling.update(options);
              });

              const shouldEmitTrackEvent = isSubscribed && event !== 'publishPriorityChanged';
              it(`should ${shouldEmitTrackEvent ? '' : 'not '}emit "${trackEvent}" on the Remote${capitalize(kind)}Track`, () => {
                assert.equal(!!trackEventEmitted, shouldEmitTrackEvent);
              });

              const shouldEmitPublicationEvent = publicationEvent !== 'trackSwitchedOff' || isSubscribed;
              it(`should ${shouldEmitPublicationEvent ? '' : 'not '}emit "${publicationEvent}" on the ${className}`, () => {
                assert.equal(!!publicationEventEmitted, shouldEmitPublicationEvent);
              });

              if (prop) {
                const [signalingProp] = Object.keys(options);
                it(`should set .${prop} to ${options[signalingProp]}`, () => {
                  assert.equal(publication[prop], options[signalingProp]);
                });
              }
            });
          });
        });
      });
    });

    describe('Object.keys', () => {
      let publication;

      before(() => {
        publication = new RemoteTrackPublication(makeSignaling(true, kind, 'MT123'));
      });

      it('only returns public properties', () => {
        assert.deepEqual(Object.keys(publication), [
          'trackName',
          'trackSid',
          'isSubscribed',
          'isTrackEnabled',
          'kind',
          'publishPriority',
          'track'
        ]);
      });
    });

    describe('#toJSON', () => {
      let publication;

      before(() => {
        publication = new RemoteTrackPublication(makeSignaling(true, kind, 'MT123'));
      });

      it('only returns public properties', () => {
        assert.deepEqual(publication.toJSON(), {
          isSubscribed: publication.isSubscribed,
          isTrackEnabled: publication.isTrackEnabled,
          kind: publication.kind,
          publishPriority: publication.publishPriority,
          track: null,
          trackName: publication.trackName,
          trackSid: publication.trackSid
        });
      });
    });
  });
});

function makeSignaling(isEnabled, isSwitchedOff, kind, sid) {
  const signaling = new EventEmitter();
  signaling.error = null;
  signaling.isEnabled = isEnabled;
  signaling.kind = kind;
  signaling.name = randomName();
  signaling.priority = randomName();
  signaling.sid = sid;
  signaling.isSwitchedOff = isSwitchedOff;
  signaling.switchOffReason = isSwitchedOff ? 'foo' : null;

  signaling.update = options => {
    const changedProps = ['error', 'isEnabled', 'isSwitchedOff', 'priority', 'switchOffReason'].filter(prop => {
      // eslint-disable-next-line no-prototype-builtins
      return options.hasOwnProperty(prop) && signaling[prop] !== options[prop];
    });
    if (changedProps.length > 0) {
      changedProps.forEach(prop => {
        signaling[prop] = options[prop];
      });
      signaling.emit('updated');
    }
  };

  return signaling;
}

function makeTrack(isEnabled) {
  const track = new EventEmitter();
  track.isEnabled = typeof isEnabled === 'boolean' ? isEnabled : true;
  track.isSubscribed = true;

  track._setEnabled = isEnabled => {
    if (track.isEnabled !== isEnabled) {
      track.isEnabled = isEnabled;
      track.emit(track.isEnabled ? 'enabled' : 'disabled');
    }
  };

  track._setSwitchedOff = (switchedOff, switchOffReason) => {
    if (track.switchedOff !== switchedOff || track.switchOffReason !== switchOffReason) {
      track.switchedOff = switchedOff;
      track.switchOffReason = switchOffReason;
      track.emit(`switched${track.switchedOff ? 'Off' : 'On'}`, ...(track.switchedOff ? [switchOffReason] : []));
    }
  };

  track._setTrackReceiver = trackReceiver => {
    if (track.trackTransceiver !== trackReceiver) {
      track.trackTransceiver = trackReceiver;
    }
  };

  return track;
}
