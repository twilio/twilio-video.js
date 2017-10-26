'use strict';

const assert = require('assert');

const StateMachine = require('../../../lib/statemachine');
const { defer } = require('../../../lib/util');

describe('StateMachine', () => {
  describe('constructor', () => {
    it('sets .state to initialState', () => {
      assert.equal('foo', new StateMachine('foo', { foo: [] }).state);
    });

    it('sets .isLocked to false', () => {
      assert.equal(false, new StateMachine('foo', { foo: [] }).isLocked);
    });
  });

  describe('#bracket', () => {
    context('when the Promise returned by the transition function rejects', () => {
      it('releases the lock and rejects with the error', async () => {
        const sm = new StateMachine('foo', { foo: [] });
        try {
          await sm.bracket('lock', key => {
            sm.takeLockSync(key);  // reenter
            throw new Error(':-)');
          });
        } catch (error) {
          // Expected rejection
          assert.equal(':-)', error.message);
          assert.equal(false, sm.isLocked);
          return;
        }
        throw new Error('Unexpected resolution');
      });
    });

    context('when the Promise returned by the transition function resolves', () => {
      it('releases the lock and resolves', async () => {
        const sm = new StateMachine('foo', { foo: [] });
        await sm.bracket('lock', key => {
          sm.takeLockSync(key);  // reenter
        });
        assert.equal(false, sm.isLocked);
      });
    });
  });

  describe('#hasLock', () => {
    context('when locked', () => {
      it('returns true if called with the key returned by #takeLock', async () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = await sm.takeLock();
        assert(sm.hasLock(key));
      });

      it('returns true if called with the key returned by #takeLockSync', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = sm.takeLockSync('key');
        assert(sm.hasLock(key));
      });

      it('returns false if called with another key', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock1');
        sm.takeLockSync('lock2');
        assert.equal(false, sm.hasLock(key));
      });
    });

    context('when unlocked', () => {
      it('returns false', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock');
        assert.equal(false, sm.hasLock(key));
      });
    });
  });

  describe('#preempt', () => {
    context('when the transition is invalid', () => {
      it('throws an Error', () => {
        const sm = new StateMachine('foo', { foo: [] });
        assert.throws(sm.preempt.bind(sm, 'bar'));
      });
    });

    context('when the transition is valid', () => {
      context('the StateMachine is locked', () => {
        context('and a new lock is not requested', () => {
          it('sets .state and releases the current lock', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const deferred = defer();

            sm.takeLockSync('lock');

            let i = 0;

            // The "stateChanged" event should fire before anyone waiting to
            // take the lock. Taking the lock from within the "stateChanged"
            // callback should maintain FIFO order.
            const promise = Promise.all([
              new Promise(resolve => {
                sm.once('stateChanged', async () => {
                  const promise = sm.takeLock();
                  resolve(i++);
                  await promise;
                  deferred.resolve(i++);
                });
              }),
              sm.takeLock().then(key => {
                sm.releaseLock(key);
                return i++;
              }),
              deferred.promise
            ]);

            sm.preempt('bar');
            assert.equal('bar', sm.state);
            assert.equal(false, sm.isLocked);
            i++;  // 1

            const order = await promise;
            assert.equal(0, order[0]);
            assert.equal(2, order[1]);
            assert.equal(3, order[2]);
          });
        });

        context('and a new lock is requested', () => {
          it('sets .state, releases the current lock, and takes a new lock', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const deferred = defer();

            sm.takeLockSync('lock1');

            let i = 0;

            // The "stateChanged" event should fire before anyone waiting to
            // take the lock. Taking the lock from within the "stateChanged"
            // callback should maintain FIFO order.
            const promise = Promise.all([
              new Promise(resolve => {
                sm.once('stateChanged', async () => {
                  const promise = sm.takeLock();
                  resolve(i++);
                  await promise;
                  deferred.resolve(i++);
                });
              }),
              sm.takeLock().then(key => {
                sm.releaseLock(key);
                return i++;
              }),
              deferred.promise
            ]);

            const key2 = sm.preempt('bar', 'lock2');
            assert.equal('bar', sm.state);
            assert(sm.hasLock(key2));
            i++;  // 1
            sm.releaseLock(key2);

            const order = await promise;
            assert.equal(0, order[0]);
            assert.equal(2, order[1]);
            assert.equal(3, order[2]);
          });
        });
      });

      context('the StateMachine is unlocked', () => {
        context('and a new lock is not requested', () => {
          it('sets .state', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const promise = new Promise(resolve => {
              sm.once('stateChanged', (bar, baz) => resolve([bar, baz]));
            });

            sm.preempt('bar', null, ['baz']);
            assert.equal('bar', sm.state);

            const [, baz] = await promise;
            assert.equal('bar', sm.state);
            assert.equal('baz', baz);
          });
        });

        context('and a new lock is requested', () => {
          it('sets .state and takes a new lock', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const promise = new Promise(resolve => {
              sm.once('stateChanged', (bar, baz) => resolve([bar, baz]));
            });

            const key = sm.preempt('bar', 'lock', ['baz']);
            assert.equal('bar', sm.state);
            assert(sm.hasLock(key));

            const [, baz] = await promise;
            assert.equal('bar', sm.state);
            assert.equal('baz', baz);
          });
        });
      });
    });
  });

  describe('#releaseLock', () => {
    context('when locked', () => {
      it('throws an Error if the wrong key is provided', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock1');
        sm.takeLockSync('lock2');
        assert.throws(sm.releaseLock.bind(sm, key));
      });

      it('sets .isLocked to false if the key is provided', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock');
        assert.equal(false, sm.hasLock(key));
        assert.equal(false, sm.isLocked);
      });
    });

    context('when unlocked', () => {
      it('throws an Error', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock');
        assert.throws(sm.releaseLock.bind(sm, key));
      });
    });
  });

  describe('#takeLock', () => {
    context('when locked', () => {
      context('and called with a string', () => {
        it('returns a Promise that resolves to a key once the current lock is released', async () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key1 = sm.takeLockSync('lock1');
          const promise = sm.takeLock();

          sm.releaseLock(key1);

          const key2 = await promise;
          assert(sm.hasLock(key2));
          assert(sm.isLocked);
        });
      });

      context('and called with the key for the lock', () => {
        it('reenters the lock and returns a Promise that resolves to the same key', async () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = sm.takeLockSync('lock');
          const _key = await sm.takeLock(key);
          assert.equal(_key, key);
        });
      });

      context('and called with the key for a different lock', () => {
        it('returns a Promise that rejects with an Error', async () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = takeAndReleaseLockSync(sm, 'lock1');
          sm.takeLockSync('lock2');
          try {
            await sm.takeLock(key);
          } catch (error) {
            // Expected rejection
            assert(error instanceof Error);
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });

    context('when unlocked', () => {
      context('and called with a string', () => {
        it('returns a Promise that resolves to a key', async () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = await sm.takeLock();
          assert(sm.hasLock(key));
          assert(sm.isLocked);
        });
      });

      context('and called with a key', () => {
        it('returns a Promise that rejects with an Error', async () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = takeAndReleaseLockSync(sm, 'lock');
          try {
            await sm.takeLock(key);
          } catch (error) {
            // Expected rejection
            assert(error instanceof Error);
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });
  });

  describe('#takeLockSync', () => {
    context('when locked', () => {
      context('and called with a string', () => {
        it('throws an Error', () => {
          const sm = new StateMachine('foo', { foo: [] });
          sm.takeLockSync('lock1');
          assert.throws(sm.takeLockSync.bind(sm, 'lock2'));
        });
      });

      context('and called with the key for the lock', () => {
        it('reenters the lock', () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = sm.takeLockSync('lock');
          assert.equal(key, sm.takeLockSync(key));
        });
      });

      context('and called with the key for a different lock', () => {
        it('throws an Error', () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = takeAndReleaseLockSync(sm, 'lock1');
          sm.takeLockSync('lock2');
          assert.throws(sm.takeLockSync.bind(sm, key));
        });
      });
    });

    context('when unlocked', () => {
      context('and called with a string', () => {
        it('returns a key', () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = sm.takeLockSync('lock');
          assert(sm.hasLock(key));
          assert(sm.isLocked);
        });
      });

      context('and called with a key', () => {
        it('throws an Error', () => {
          const sm = new StateMachine('foo', { foo: [] });
          const key = takeAndReleaseLockSync(sm, 'lock');
          assert.throws(sm.takeLockSync.bind(sm, key));
        });
      });
    });
  });

  describe('#transition', () => {
    context('when locked', () => {
      it('throws an Error if the key is not provided', () => {
        const sm = new StateMachine('foo', { foo: [] });
        sm.takeLockSync('lock');
        assert.throws(sm.transition.bind(sm, 'bar'));
      });

      it('throws an Error if the wrong key is provided', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock1');
        sm.takeLockSync('lock2');
        assert.throws(sm.transition.bind(sm, 'bar', key));
      });

      it('throws an Error if the key is provided but the transition is invalid', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = sm.takeLockSync('lock');
        assert.throws(sm.transition.bind(sm, 'bar', key));
      });

      it('sets .state to the new state if the key is provided and the transition is valid', () => {
        const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
        const key = sm.takeLockSync('lock');
        sm.transition('bar', key);
        assert.equal('bar', sm.state);
      });

      describe('when the key is provided and the transition is valid', () => {
        describe('and no payload is provided', () => {
          it('emits the "stateChanged" event', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const key = sm.takeLockSync('lock');
            const promise = new Promise(resolve => sm.once('stateChanged', resolve));

            sm.transition('bar', key);

            await promise;
            assert.equal('bar', sm.state);
          });
        });

        describe('and a payload is provided', () => {
          it('emits the "stateChanged" event with the extra payload', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const key = sm.takeLockSync('lock');
            const promise = new Promise(resolve => {
              sm.once('stateChanged', (bar, baz, qux) => resolve([bar, baz, qux]));
            });

            sm.transition('bar', key, ['baz', 'qux']);

            const [bar, baz, qux] = await promise;
            assert.equal('bar', bar);
            assert.equal('baz', baz);
            assert.equal('qux', qux);
          });
        });
      });
    });

    context('when unlocked', () => {
      it('throws an Error if a key is provided', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const key = takeAndReleaseLockSync(sm, 'lock');
        assert.throws(sm.transition.bind(sm, 'bar', key));
      });

      it('throws an Error if the transition is invalid', () => {
        const sm = new StateMachine('foo', { foo: [] });
        assert.throws(sm.transition.bind(sm, 'bar'));
      });

      describe('when the transition is valid', () => {
        describe('and no payload is provided', () => {
          it('sets .state to the new state', () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            sm.transition('bar');
            assert.equal('bar', sm.state);
          });

          it('emits the "stateChanged" event', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const promise = new Promise(resolve => sm.once('stateChanged', resolve));

            sm.transition('bar');

            await promise;
            assert.equal('bar', sm.state);
          });
        });

        describe('and a payload is provided', () => {
          it('sets .state to the new state', () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            sm.transition('bar', null, ['baz', 'qux']);
            assert.equal('bar', sm.state);
          });

          it('emits the "stateChanged" event with the extra payload', async () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const promise = new Promise(resolve => {
              sm.once('stateChanged', (bar, baz, qux) => resolve([bar, baz, qux]));
            });

            sm.transition('bar', null, ['baz', 'qux']);

            const [bar, baz, qux] = await promise;
            assert.equal('bar', bar);
            assert.equal('baz', baz);
            assert.equal('qux', qux);
          });
        });
      });
    });
  });

  describe('#when', () => {
    describe('when the state matches the current state', () => {
      it('returns a Promise that resolves to the StateMachine', () => {
        const sm = new StateMachine('foo', { foo: [] });
        return sm.when('foo').then(_sm => assert.equal(sm, _sm));
      });

      it('should delete the Promise from the ._whenDeferreds Set', () => {
        const sm = new StateMachine('foo', { foo: [] });
        const whenDeferredsSize = sm._whenDeferreds.size;
        return sm.when('foo').then(() => assert.equal(sm._whenDeferreds.size, whenDeferredsSize));
      });
    });

    describe('when the state does not match the current state, and', () => {
      describe('the state is not reachable from the current state', () => {
        it('returns a Promise that rejects with an Error', () => {
          const sm = new StateMachine('foo', { foo: [], bar: [] });
          return sm.when('bar').then(
            () => { throw new Error('Unexpected resolution'); },
            error => assert(error instanceof Error));
        });

        it('should delete the Promise from the ._whenDeferreds Set', () => {
          const sm = new StateMachine('foo', { foo: [], bar: [] });
          const whenDeferredsSize = sm._whenDeferreds.size;
          return sm.when('bar').then(
            () => { throw new Error('Unexpected resolution'); },
            () => assert.equal(sm._whenDeferreds.size, whenDeferredsSize));
        });
      });

      describe('the state is reachable from the current state, and it transitions to', () => {
        describe('the state', () => {
          it('returns a Promise that resolves to the StateMachine', () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const promise = sm.when('bar').then(_sm => assert.equal(sm, _sm));
            sm.transition('bar');
            return promise;
          });

          it('should delete the Promise from the ._whenDeferreds Set', () => {
            const sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            const whenDeferredsSize = sm._whenDeferreds.size;
            const promise = sm.when('bar').then(() => assert.equal(sm._whenDeferreds.size, whenDeferredsSize));
            sm.transition('bar');
            return promise;
          });
        });

        describe('a new state from which the state is no longer reachable', () => {
          it('returns a Promise that rejects with an Error', () => {
            const sm = new StateMachine('foo', { foo: ['bar', 'baz'], bar: [], baz: [] });
            const promise = sm.when('baz').then(
              () => { throw new Error('Unexpected resolution'); },
              error => assert(error instanceof Error));
            sm.transition('bar');
            return promise;
          });

          it('should delete the Promise from the ._whenDeferreds Set', () => {
            const sm = new StateMachine('foo', { foo: ['bar', 'baz'], bar: [], baz: [] });
            const whenDeferredsSize = sm._whenDeferreds.size;
            const promise = sm.when('baz').then(
              () => { throw new Error('Unexpected resolution'); },
              () => assert.equal(sm._whenDeferreds.size, whenDeferredsSize));
            sm.transition('bar');
            return promise;
          });
        });
      });
    });
  });
});

function takeAndReleaseLockSync(sm, name) {
  const key = sm.takeLockSync(name);
  sm.releaseLock(key);
  return key;
}
