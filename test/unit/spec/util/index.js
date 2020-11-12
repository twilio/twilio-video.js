'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const util = require('@twilio/webrtc/lib/util');

const {
  hidePrivateProperties,
  hidePrivateAndCertainPublicPropertiesInClass,
  makeUUID,
  promiseFromEvents,
  isChromeScreenShareTrack,
  createRoomConnectEventPayload
} = require('../../../../lib/util');

describe('util', () => {
  describe('createRoomConnectEventPayload', () => {
    [
      {
        testCase: 'empty options',
        connectOptions: {},
        expectedPayload: {},
      },
      {
        testCase: 'audio true',
        connectOptions: { audio: true },
        expectedPayload: { audio: 'true' },
      },
      {
        testCase: 'video true',
        connectOptions: { video: true },
        expectedPayload: { video: 'true' },
      },
      {
        testCase: 'automaticSubscription true',
        connectOptions: { automaticSubscription: true },
        expectedPayload: { automaticSubscription: 'true' },
      },
      {
        testCase: 'tracks specified',
        connectOptions: { tracks: [{ kind: 'audio' }, { kind: 'data' }, { kind: 'video' }] },
        expectedPayload: { audioTracks: 1, dataTracks: 1, videoTracks: 1 },
      },
      {
        testCase: 'enableDominantSpeaker true',
        connectOptions: { dominantSpeaker: true },
        expectedPayload: { enableDominantSpeaker: 'true' },
      },
      {
        testCase: 'enableDominantSpeaker false',
        connectOptions: { dominantSpeaker: false },
        expectedPayload: { enableDominantSpeaker: 'false' },
      },
      {
        testCase: 'eventListener provided',
        connectOptions: { eventListener: {} },
        expectedPayload: { eventListener: 'true' },
      },
      {
        testCase: 'iceTransportPolicy specified',
        connectOptions: { iceTransportPolicy: 'relay' },
        expectedPayload: { iceTransportPolicy: 'relay' },
      },
      {
        testCase: 'preferredAudioCodecs specified',
        connectOptions: { preferredAudioCodecs: ['one', 'two'] },
        expectedPayload: { preferredAudioCodecs: JSON.stringify(['one', 'two']) },
      },
      {
        testCase: 'preferredVideoCodecs specified',
        connectOptions: { preferredAudioCodecs: [{ codec: 'VP8', simulcast: true }] },
        expectedPayload: { preferredAudioCodecs: JSON.stringify([{ codec: 'VP8', simulcast: true }]) },
      },
      {
        testCase: 'bandwidthProfile specified',
        connectOptions: {
          bandwidthProfile: {
            mode: 'grid',
            maxTracks: 1,
            trackSwitchOffMode: 'detected',
            dominantSpeakerPriority: 'high',
            renderDimensions: {
              high: { width: 100, height: 200 }
            }
          }
        },
        expectedPayload: {
          bandwidthProfileOptions: {
            mode: 'grid',
            maxTracks: 1,
            trackSwitchOffMode: 'detected',
            dominantSpeakerPriority: 'high',
            renderDimensions: JSON.stringify({
              high: { width: 100, height: 200 }
            })
          }
        },
      },
    ].forEach(({ testCase, connectOptions, expectedPayload }) => {
      it(testCase, () => {
        const event = createRoomConnectEventPayload(connectOptions);
        const defaultOptions = {
          'audio': 'false',
          'audioTracks': 0,
          'automaticSubscription': 'false',
          'dataTracks': 0,
          'enableDominantSpeaker': 'false',
          'enableDscp': 'false',
          'eventListener': 'false',
          'iceServers': 0,
          'preflight': 'false',
          'video': 'false',
          'videoTracks': 0
        };
        const expectedOutput = Object.assign(defaultOptions, expectedPayload);
        assert.strictEqual(event.name, 'connect');
        assert.strictEqual(event.level, 'info');
        assert.strictEqual(event.group, 'room');
        assert.deepStrictEqual(event.payload, expectedOutput);
      });
    });
  });

  describe('hidePrivateProperties', () => {
    it('should do what it says', () => {
      const object = { foo: 'bar', _baz: 'qux' };
      assert.deepEqual(Object.keys(object), ['foo', '_baz']);
      hidePrivateProperties(object);
      assert.deepEqual(Object.keys(object), ['foo']);
    });
  });

  describe('hidePrivateAndCertainPublicPropertiesInClass', () => {
    it('should do what it says', () => {
      class Foo1 {
        constructor() {
          this.args = [].slice.call(arguments);
          this.bar = 'baz';
          this._foo = 'bar';
          this._baz = 'qux';
        }
      }

      const foo1 = new Foo1(1, 2, 3);
      assert.deepEqual(Object.keys(foo1), ['args', 'bar', '_foo', '_baz']);
      assert.deepEqual(foo1.args, [1, 2, 3]);

      const Foo2 = hidePrivateAndCertainPublicPropertiesInClass(Foo1, ['bar']);
      const foo2 = new Foo2(1, 2, 3);
      assert.deepEqual(Object.keys(foo2), ['args']);
      assert.deepEqual(foo2.args, [1, 2, 3]);
    });
  });

  describe('makeUUID', () => {
    it('should generate a unique UUID', () => {
      const uuid1 = makeUUID();
      const uuid2 = makeUUID();
      const uuid3 = makeUUID();

      assert.notEqual(uuid1, uuid2);
      assert.notEqual(uuid2, uuid3);
      assert.notEqual(uuid1, uuid3);
    });
  });

  describe('promiseFromEvents', () => {
    let emitter;
    let promise;
    let spy;

    beforeEach(() => {
      emitter = new EventEmitter();
      spy = sinon.spy();
      promise = promiseFromEvents(spy, emitter, 'foo', 'bar');
    });

    it('should call the function passed', () => {
      assert(spy.calledOnce);
    });

    it('should resolve when the success event is fired', () => {
      emitter.emit('foo');
      return promise;
    });

    it('should reject when the failure event is fired', async () => {
      emitter.emit('bar');
      try {
        await promise;
      } catch (error) {
        // Expected rejection
        return;
      }
      throw new Error('Unexpected resolution');
    });

    it('should not require a failure event', () => {
      promise = promiseFromEvents(spy, emitter, 'foo');
      emitter.emit('foo');
      return promise;
    });
  });

  describe('chromeScreenShare', () => {
    const validLabels = ['web-contents-media-stream://1174:3', 'window:1561:0', 'screen:2077749241:0'];
    const invalidLabels = ['foo:bar:12356', 'fizz:123456:78901', 'fakelabel://123456'];
    const mediaStreamTrack = {
      kind: 'video',
      id: '1aaadf6e-6a4f-465b-96bf-1a35a2d3ac2b',
      enabled: true,
      muted: true,
      onmute: null,
      onunmute: null,
      readyState: 'live',
      onended: null,
      contentHint: ''
    };
    let stub;

    beforeEach(() => {
      stub = sinon.stub(util, 'guessBrowser');
    });

    afterEach(() => {
      stub.restore();
    });

    [['chrome', true], ['firefox', false], ['safari', false]].forEach(([browser, expectedBool]) => {
      it(`valid labels should return ${expectedBool} for ${browser}`, () => {
        stub = stub.returns(browser);
        validLabels.forEach(label => {
          mediaStreamTrack.label = label;
          const screenShare = isChromeScreenShareTrack(mediaStreamTrack);
          assert.equal(expectedBool, screenShare);
          stub.resetHistory();
        });
      });
    });

    [['chrome', false], ['firefox', false], ['safari', false]].forEach(([browser, expectedBool]) => {
      it(`invalid labels should return ${expectedBool} for ${browser}`, () => {
        stub = stub.returns(browser);
        invalidLabels.forEach(label => {
          mediaStreamTrack.label = label;
          const screenShare = isChromeScreenShareTrack(mediaStreamTrack);
          assert.equal(expectedBool, screenShare);
          stub.resetHistory();
        });
      });
    });
  });
});
