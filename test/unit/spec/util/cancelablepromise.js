'use strict';

const assert = require('assert');

const CancelablePromise = require('../../../../lib/util/cancelablepromise');

const { a } = require('../../../lib/util');

const sinon = require('sinon');

describe('CancelablePromise', () => {
  describe('constructor', () => {
    it('should return an instance of CancelablePromise', () => {
      assert(new CancelablePromise(() => {}, () => {}) instanceof CancelablePromise);
    });

    // NOTE(mroberts): My workaround for this landed in Zone.js 0.7.0; once we
    // are comfortable that the fix has been rolled out to most Angular users,
    // we can re-enable this test. Zone.js is at 0.8.9 at the time of writing.
    //
    //   * https://github.com/twilio/twilio-video.js/commit/3e28936bed2c367a6365a49c38ba69c855459ed1
    //   * https://github.com/angular/zone.js/pull/495
    //
    it.skip('should return an instance of Promise', () => {
      assert(new CancelablePromise(() => {}, () => {}) instanceof Promise);
    });

    it('should accept an onCreate handler which, if thrown in, rejects the CancelablePromise with the thrown value', async () => {
      const expectedReason = {};
      try {
        await new CancelablePromise(() => {
          throw expectedReason;
        }, () => {});
      } catch (actualReason) {
        assert.equal(actualReason, expectedReason);
        return;
      }
      throw new Error('Unexpectedly resolved');
    });

    it('should expose an isCanceled handler to the onCreate handler that initially returns false', () => {
      // eslint-disable-next-line no-new
      new CancelablePromise((resolve, _reject, isCanceled) => {
        assert.equal(isCanceled(), false);
        resolve();
      }, () => {});
    });
  });

  describe('.resolve', () => {
    let cancelablePromise;
    let expectedResult;

    beforeEach(() => {
      expectedResult = {};
      cancelablePromise = CancelablePromise.resolve(expectedResult);
    });

    it('should return an instance of CancelablePromise', () => {
      assert(cancelablePromise instanceof CancelablePromise);
    });

    it('should return a CancelablePromise that resolves with the specified result', async () => {
      const actualResult = await cancelablePromise;
      assert.equal(actualResult, expectedResult);
    });
  });

  describe('.reject', () => {
    let cancelablePromise;
    let expectedReason;

    beforeEach(() => {
      expectedReason = {};
      cancelablePromise = CancelablePromise.reject(expectedReason);
      cancelablePromise.catch(() => {});
    });

    it('should return an instance of CanceablePromise', () => {
      assert(cancelablePromise instanceof CancelablePromise);
    });

    it('should return a CancelablePromise that rejects with the specified reason', async () => {
      try {
        await cancelablePromise;
      } catch (actualReason) {
        assert.equal(actualReason, expectedReason);
        return;
      }
      throw new Error('Unexpectedly resolved');
    });
  });

  describe('#catch', () => {
    ['rejected', 'resolved', 'unresolved', 'unrejected'].forEach(type => {
      describe(`called on ${a(type)} ${type} CancelablePromise`, () => {
        let cancelablePromise;
        let resultOrReason;
        let resolveOrReject;
        let uncaught;
        let caught;
        let didCallCancel;

        beforeEach(() => {
          resultOrReason = {};
          resolveOrReject = null;
          caught = uncaught = {};
          didCallCancel = false;

          cancelablePromise = new CancelablePromise((resolve, reject) => {
            switch (type) {
              case 'canceled':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'rejected':
                reject(resultOrReason);
                break;
              case 'resolved':
                resolve(resultOrReason);
                break;
              case 'unrejected':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'unresolved':
                resolveOrReject = () => resolve(resultOrReason);
                break;
            }
          }, () => {
            didCallCancel = true;
            resolveOrReject();
          }).catch(reason => {
            caught = reason;
          });

          if (type === 'canceled') {
            cancelablePromise.cancel();
            didCallCancel = false;
          }
        });

        it('should return an instance of CancelablePromise', () => {
          if (resolveOrReject) {
            resolveOrReject();
          }
          assert(cancelablePromise instanceof CancelablePromise);
        });

        if (type.endsWith('resolved')) {
          it('should not invoke the rejection handler', async () => {
            if (resolveOrReject) {
              resolveOrReject();
            }
            await cancelablePromise;
            assert.equal(caught, uncaught);
          });
        } else {
          it('should invoke the rejection handler with the specified reason', async () => {
            if (resolveOrReject) {
              resolveOrReject();
            }
            await cancelablePromise;
            assert.equal(caught, resultOrReason);
          });
        }

        if (type.startsWith('un')) {
          it('should preserve the ability to cancel', () => {
            assert.equal(didCallCancel, false);
            cancelablePromise.cancel();
            assert.equal(didCallCancel, true);
            if (resolveOrReject) {
              resolveOrReject();
            }
            cancelablePromise.catch(() => {});
          });
        }
      });
    });
  });

  describe('#cancel', () => {
    ['pending', 'rejected', 'resolved'].forEach(type => {
      let cancelablePromise;
      let resultOrReason;
      let didCallCancel;
      let isCanceled;

      describe(`called on ${a(type)} ${type} CancelablePromise`, () => {
        beforeEach(() => {
          let resolveOrReject = null;

          resultOrReason = {};
          didCallCancel = false;

          cancelablePromise = new CancelablePromise((resolve, reject, _isCanceled) => {
            isCanceled = _isCanceled;
            switch (type) {
              case 'pending':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'rejected':
                reject(resultOrReason);
                break;
              case 'resolved':
                resolve(resultOrReason);
                break;
            }
          }, () => {
            didCallCancel = true;
            if (resolveOrReject) {
              resolveOrReject();
            }
          }).cancel();

          cancelablePromise.catch(() => {});
        });

        it('should return an instance of CancelablePromise', () => {
          assert(cancelablePromise instanceof CancelablePromise);
        });

        if (type === 'pending') {
          it('should invoke the onCancel handler at most once, even on subsequent invocations', () => {
            assert.equal(didCallCancel, true);
            didCallCancel = false;
            cancelablePromise.cancel();
            assert.equal(didCallCancel, false);
          });
        } else {
          it('should not invoke the onCancel handler, even on subsequent invocations', () => {
            assert.equal(didCallCancel, false);
            cancelablePromise.cancel();
            assert.equal(didCallCancel, false);
          });
        }

        if (type === 'pending') {
          it('should cause the isCanceled function exposed by the CancelablePromise constructor to return true', () => {
            assert.equal(isCanceled(), true);
          });
        } else {
          it('should cause the isCanceled function exposed by the CancelablePromise constructor to continue returning false', () => {
            assert.equal(isCanceled(), false);
          });
        }
      });
    });
  });

  describe('#then', () => {
    ['rejected', 'resolved', 'unresolved', 'unrejected'].forEach(type => {
      describe(`called on ${a(type)} ${type} CancelablePromise`, () => {
        let cancelablePromise;
        let resultOrReason;
        let resolveOrReject;
        let unresolved;
        let resolved;
        let didCallCancel;

        beforeEach(() => {
          resultOrReason = {};
          resolveOrReject = null;
          resolved = unresolved = {};
          didCallCancel = false;

          cancelablePromise = new CancelablePromise((resolve, reject) => {
            switch (type) {
              case 'canceled':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'rejected':
                reject(resultOrReason);
                break;
              case 'resolved':
                resolve(resultOrReason);
                break;
              case 'unrejected':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'unresolved':
                resolveOrReject = () => resolve(resultOrReason);
                break;
            }
          }, () => {
            didCallCancel = true;
            resolveOrReject();
          }).then(result => {
            resolved = result;
          });

          if (type === 'canceled') {
            cancelablePromise.cancel();
            didCallCancel = false;
          }
        });

        it('should return an instance of CancelablePromise', () => {
          if (resolveOrReject) {
            resolveOrReject();
          }
          assert(cancelablePromise instanceof CancelablePromise);
          cancelablePromise.catch(() => {});
        });

        if (type.endsWith('resolved')) {
          it('should invoke the resolution handler with the specified result', async () => {
            if (resolveOrReject) {
              resolveOrReject();
            }
            await cancelablePromise;
            assert.equal(resolved, resultOrReason);
          });
        } else {
          it('should not invoke the resolution handler', async () => {
            if (resolveOrReject) {
              resolveOrReject();
            }
            try {
              await cancelablePromise;
            } catch (error) {
              assert.equal(resolved, unresolved);
              return;
            }
            throw new Error('Unexpectedly resolved');
          });
        }

        if (type.startsWith('un')) {
          it('should preserve the ability to cancel', () => {
            assert.equal(didCallCancel, false);
            cancelablePromise.cancel();
            assert.equal(didCallCancel, true);
            if (resolveOrReject) {
              resolveOrReject();
            }
            cancelablePromise.catch(() => {});
          });
        }
      });
    });
  });

  describe('#finally', () => {
    ['rejected', 'resolved', 'unresolved', 'unrejected'].forEach(type => {
      describe(`called on ${a(type)} ${type} CancelablePromise`, () => {
        let cancelablePromise;
        let resultOrReason;
        let resolveOrReject;
        let resolved;

        beforeEach(() => {
          resultOrReason = {};
          resolveOrReject = null;

          cancelablePromise = new CancelablePromise((resolve, reject) => {
            switch (type) {
              case 'canceled':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'rejected':
                reject(resultOrReason);
                break;
              case 'resolved':
                resolve(resultOrReason);
                break;
              case 'unrejected':
                resolveOrReject = () => reject(resultOrReason);
                break;
              case 'unresolved':
                resolveOrReject = () => resolve(resultOrReason);
                break;
            }
          }, () => {
            resolveOrReject();
          }).then(result => {
            resolved = result;
          });
        });

        it('should have called finally', async () => {
          const onFinally = sinon.stub();
          await cancelablePromise.finally(onFinally);
          if (resolveOrReject) {
            resolveOrReject();
          }
          sinon.assert.calledOnce(onFinally);
          assert(cancelablePromise instanceof CancelablePromise);
        });
      });
    });
  });
});
