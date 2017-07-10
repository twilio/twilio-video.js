'use strict';

const assert = require('assert');
const ChromeRTCSessionDescription = require('../../../../lib/webrtc/rtcsessiondescription/chrome');
const SessionDescription = require('../../../../lib/webrtc/rtcsessiondescription');
const { combinationContext } = require('../../../lib/util');

const isChrome = typeof webkitRTCPeerConnection !== 'undefined';
const isFirefox = typeof mozRTCPeerConnection !== 'undefined';
const isSafari = !isChrome && !isFirefox && navigator.userAgent.match(/AppleWebKit\/(\d+)\./);

describe('RTCSessionDescription', () => {
  describe('constructor', () => {
    var description;

    context('called with an invalid .type', () => {
      var descriptionInitDict = { type: 'bogus' };

      testErrorMessages('throws the same error as RTCSessionDescription',
        () => new RTCSessionDescription(descriptionInitDict),
        () => new SessionDescription(descriptionInitDict));
    });

    function testErrorMessages(description, fn1, fn2) {
      it(description, () => {
        var error1;
        try {
          fn1();
        } catch (error) {
          error1 = error;
        }

        var error2;
        try {
          fn2();
        } catch (error) {
          error2 = error;
        }

        assert(error1 instanceof Error);
        assert(error2 instanceof Error);
        assert.equal(error1.message, error2.message);
      });
    }

    context('called with .type "rollback" and', () => {
      combinationContext([
        [
          [true, false],
          x => x ? 'an .sdp' : 'no .sdp'
        ]
      ], ([hasSdp]) => {
        const sdp = hasSdp ? 'fake sdp' : null;

        beforeEach(() => {
          const descriptionInitDict = {
            type: 'rollback'
          };
          if (sdp) {
            descriptionInitDict.sdp = sdp;
          }
          description = new SessionDescription(descriptionInitDict);
        });

        testConstructor();

        testRollback(sdp);
      });
    });

    function testConstructor() {
      it('returns an instance of SessionDescription', () => {
        assert(description instanceof SessionDescription);
      });
    }

    function testRollback(sdp) {
      it('unwraps to null', () => {
        assert.equal(unwrap(description), null);
      });

      it('sets .sdp', () => {
        if (!sdp) {
          if (description.sdp === '') {
            return;
          }
        }
        assert.equal(description.sdp, sdp);
      });

      it('sets .type to "rollback"', () => {
        assert.equal(description.type, 'rollback');
      });

      (isSafari ? context.skip : context)
      ('setting .sdp', () => {
        var newSdp = 'new fake sdp';

        beforeEach(() => {
          description.sdp = newSdp;
        });

        it('sets .sdp', () => {
          assert.equal(description.sdp, newSdp);
        });

        it('unwraps to null', () => {
          assert.equal(unwrap(description), null);
        });
      });

      (isSafari ? context.skip : context)
      ('setting .type to', () => {
        combinationContext([
          [
            ['offer', 'answer', 'pranswer', 'rollback'],
            x => `"${x}"`
          ]
        ], ([newType]) => {
          beforeEach(() => {
            description.type = newType;
          });

          it('does not update .sdp', () => {
            if (!sdp) {
              if (description.sdp === '') {
                return;
              }
            }
            assert.equal(description.sdp, sdp);
          });

          it('sets .type', () => {
            assert.equal(description.type, newType);
          });

          it('unwraps to null', () => {
            assert.equal(unwrap(description), null);
          });
        });

        context('an invalid type', () => {
          var newType = 'bogus';

          beforeEach(() => {
            description.type = newType;
          });

          it('does not update .sdp', () => {
            if (!sdp) {
              if (description.sdp === '') {
                return;
              }
            }
            assert.equal(description.sdp, sdp);
          });

          it('does not set .type', () => {
            assert.equal(description.type, 'rollback');
          });

          it('unwraps to null', () => {
            assert.equal(unwrap(description), null);
          });
        });
      });
    }

    combinationContext([
      [
        ['offer', 'answer', 'pranswer'],
        x => `called with .type "${x}" and`
      ],
      [
        [true, false],
        x => x ? 'an .sdp' : 'no .sdp'
      ]
    ], ([type, hasSdp]) => {
      const sdp = 'fake sdp';

      beforeEach(() => {
        const descriptionInitDict = {
          type: type
        };
        if (hasSdp) {
          descriptionInitDict.sdp = sdp;
        }
        description = new SessionDescription(descriptionInitDict);
      });

      testConstructor();

      testRTCSessionDescription(type, hasSdp ? sdp : null);
    });

    function testRTCSessionDescription(type, sdp) {
      // it('sets ._description to an instance of RTCSessionDescription', () => {
      //   assert(unwrap(description) instanceof RTCSessionDescription);
      // });

      if (sdp) {
        it('sets .sdp', () => {
          assert.equal(description.sdp, sdp);
        });

        if (SessionDescription === ChromeRTCSessionDescription) {
          it('sets .sdp on the unwrapped RTCSessionDescription', () => {
            assert.equal(unwrap(description).sdp, description.sdp);
          });
        }
      }

      it('sets .type', () => {
        assert.equal(description.type, type);
      });

      if (SessionDescription === ChromeRTCSessionDescription) {
        it('sets .type on the unwrapped RTCSessionDescription', () => {
          assert.equal(unwrap(description).type, description.type);
        });
      }

      (isSafari ? context.skip : context)
      ('setting .sdp', () => {
        var newSdp = 'new fake sdp';

        beforeEach(() => {
          description.sdp = newSdp;
        });

        it('sets .sdp', () => {
          assert.equal(description.sdp, newSdp);
        });

        if (SessionDescription === ChromeRTCSessionDescription) {
          it('sets .sdp on the unwrapped RTCSessionDescription', () => {
            assert.equal(unwrap(description).sdp, newSdp);
          });
        }
      });

      (isSafari ? context.skip : context)
      ('setting .type to', () => {
        combinationContext([
          [
            ['offer', 'answer', 'pranswer'],
            x => `"${x}"`
          ]
        ], ([newType]) => {
          beforeEach(() => {
            description.type = newType;
          });

          it('does not update .sdp', () => {
            if (description.sdp === '') {
              return;
            }
            assert.equal(description.sdp, sdp);
          });

          it('sets .type', () => {
            assert.equal(description.type, newType);
          });

          if (SessionDescription === ChromeRTCSessionDescription) {
            it('sets .type on the unwrapped RTCSessionDescription', () => {
              assert.equal(unwrap(description).type, newType);
            });
          }
        });

        context('"rollback"', () => {
          var newType = 'rollback';

          beforeEach(() => {
            description.type = newType;
          });

          it('unwraps to null', () => {
            assert.equal(unwrap(description), null);
          });

          it('does not update .sdp', () => {
            if (description.sdp === '') {
              return;
            }
            assert.equal(description.sdp, sdp);
          });

          it('sets .type', () => {
            assert.equal(description.type, newType);
          });
        });

        context('an invalid type', () => {
          beforeEach(() => {
            description.type = 'bogus';
          });

          it('does not update .sdp', () => {
            if (description.sdp === '') {
              return;
            }
            assert.equal(description.sdp, sdp);
          });

          it('does not update .type', () => {
            assert.equal(description.type, type);
          });

          if (SessionDescription === ChromeRTCSessionDescription) {
            it('does not set .type on the unwrapped RTCSessionDescription', () => {
              assert.equal(unwrap(description).type, type);
            });
          }
        });
      });
    }
  });
});

function unwrap(description) {
  return description instanceof ChromeRTCSessionDescription
    ? description._description
    : null;
}
