'use strict';

var assert = require('assert');
var StateMachine = require('../../../lib/statemachine');
var util = require('../../../lib/util');

describe('StateMachine', function() {
  describe('constructor', function() {
    it('sets .state to initialState', function() {
      assert.equal('foo', new StateMachine('foo', { foo: [] }).state);
    });

    it('sets .isLocked to false', function() {
      assert.equal(false, new StateMachine('foo', { foo: [] }).isLocked);
    });
  });

  describe('#bracket', function() {
    context('when the Promise returned by the transition function rejects', function(done) {
      it('releases the lock and rejects with the error', function(done) {
        var sm = new StateMachine('foo', { foo: [] });
        sm.bracket('lock', function(key) {
          sm.takeLockSync(key);  // reenter
          throw new Error(':-)');
        }).then(function() {
          throw new Error('Unexpected resolution');
        }, function(error) {
          assert.equal(':-)', error.message);
          assert.equal(false, sm.isLocked);
        }).then(done, done);
      });
    });

    context('when the Promise returned by the transition function resolves', function() {
      it('releases the lock and resolves', function(done) {
        var sm = new StateMachine('foo', { foo: [] });
        sm.bracket('lock', function(key) {
          sm.takeLockSync(key);  // reenter
        }).then(function() {
          assert.equal(false, sm.isLocked);
        }).then(done, done);
      });
    });
  });

  describe('#hasLock', function() {
    context('when locked', function() {
      it('returns true if called with the key returned by #takeLock', function(done) {
        var sm = new StateMachine('foo', { foo: [] });
        sm.takeLock().then(function(key) {
          assert(sm.hasLock(key));
        }).then(done, done);
      });

      it('returns true if called with the key returned by #takeLockSync', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = sm.takeLockSync('key');
        assert(sm.hasLock(key));
      });

      it('returns false if called with another key', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock1');
        sm.takeLockSync('lock2');
        assert.equal(false, sm.hasLock(key));
      });
    });

    context('when unlocked', function() {
      it('returns false', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock');
        assert.equal(false, sm.hasLock(key));
      });
    });
  });

  describe('#preempt', function() {
    context('when the transition is invalid', function() {
      it('throws an Error', function() {
        var sm = new StateMachine('foo', { foo: [] });
        assert.throws(sm.preempt.bind(sm, 'bar'));
      });
    });

    context('when the transition is valid', function() {
      context('the StateMachine is locked', function() {
        context('and a new lock is not requested', function() {
          it('sets .state and releases the current lock', function(done) {
            var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            var key = sm.takeLockSync('lock');
            var i = 0;
            var deferred = util.defer();

            // The "stateChanged" event should fire before anyone waiting to
            // take the lock. Taking the lock from within the "stateChanged"
            // callback should maintain FIFO order.
            Promise.all([
              new Promise(function(resolve) {
                sm.once('stateChanged', function() {
                  sm.takeLock().then(function() {
                    deferred.resolve(i++);
                  });
                  resolve(i++);
                });
              }),
              sm.takeLock().then(function(key) {
                sm.releaseLock(key);
                return i++;
              }),
              deferred.promise
            ]).then(function(order) {
              assert.equal(0, order[0]);
              assert.equal(2, order[1]);
              assert.equal(3, order[2]);
            }).then(done, done);

            sm.preempt('bar');
            assert.equal('bar', sm.state);
            assert.equal(false, sm.isLocked);
            i++;  // 1
          });
        });

        context('and a new lock is requested', function() {
          it('sets .state, releases the current lock, and takes a new lock', function(done) {
            var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            var key1 = sm.takeLockSync('lock1');
            var i = 0;
            var deferred = util.defer();

            // The "stateChanged" event should fire before anyone waiting to
            // take the lock. Taking the lock from within the "stateChanged"
            // callback should maintain FIFO order.
            Promise.all([
              new Promise(function(resolve) {
                sm.once('stateChanged', function() {
                  sm.takeLock().then(function() {
                    deferred.resolve(i++);
                  });
                  resolve(i++);
                });
              }),
              sm.takeLock().then(function(key) {
                sm.releaseLock(key);
                return i++;
              }),
              deferred.promise
            ]).then(function(order) {
              assert.equal(0, order[0]);
              assert.equal(2, order[1]);
              assert.equal(3, order[2]);
            }).then(done, done);

            var key2 = sm.preempt('bar', 'lock2');
            assert.equal('bar', sm.state);
            assert(sm.hasLock(key2));
            i++;  // 1
            sm.releaseLock(key2);
          });
        });
      });

      context('the StateMachine is unlocked', function() {
        context('and a new lock is not requested', function() {
          it('sets .state', function(done) {
            var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            sm.once('stateChanged', function() {
              try {
                assert.equal('bar', sm.state);
              } catch (error) {
                done(error);
                return;
              }
              done();
            });
            sm.preempt('bar');
            assert.equal('bar', sm.state);
          });
        });

        context('and a new lock is requested', function() {
          it('sets .state and takes a new lock', function(done) {
            var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            sm.once('stateChanged', function() {
              try {
                assert.equal('bar', sm.state);
              } catch (error) {
                done(error);
                return;
              }
              done();
            });
            var key = sm.preempt('bar', 'lock');
            assert.equal('bar', sm.state);
            assert(sm.hasLock(key));
          });
        });
      });
    });
  });

  describe('#releaseLock', function() {
    context('when locked', function() {
      it('throws an Error if the wrong key is provided', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock1');
        sm.takeLockSync('lock2');
        assert.throws(sm.releaseLock.bind(sm, key));
      });

      it('sets .isLocked to false if the key is provided', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock');
        assert.equal(false, sm.hasLock(key));
        assert.equal(false, sm.isLocked);
      });
    });

    context('when unlocked', function() {
      it('throws an Error', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock');
        assert.throws(sm.releaseLock.bind(sm, key));
      });
    });
  });

  describe('#takeLock', function() {
    context('when locked', function() {
      context('and called with a string', function() {
        it('returns a Promise that resolves to a key once the current lock is released', function(done) {
          var sm = new StateMachine('foo', { foo: [] });
          var key1 = sm.takeLockSync('lock1');
          var key2 = null;
          sm.takeLock().then(function(key) {
            key2 = key;
            assert(sm.hasLock(key2));
            assert(sm.isLocked);
          }).then(done, done);
          sm.releaseLock(key1);
          assert.equal(null, key2);
        });
      });

      context('and called with the key for the lock', function() {
        it('reenters the lock and returns a Promise that resolves to the same key', function(done) {
          var sm = new StateMachine('foo', { foo: [] });
          var key = sm.takeLockSync('lock');
          sm.takeLock(key).then(function(_key) {
            assert.equal(key, _key);
          }).then(done, done);
        });
      });

      context('and called with the key for a different lock', function() {
        it('returns a Promise that rejects with an Error', function(done) {
          var sm = new StateMachine('foo', { foo: [] });
          var key = takeAndReleaseLockSync(sm, 'lock1');
          sm.takeLockSync('lock2');
          sm.takeLock(key).then(function(key) {
            throw new Error('Unexpected resolution');
          }, function(error) {
            assert(error instanceof Error);
          }).then(done, done);
        });
      });
    });

    context('when unlocked', function() {
      context('and called with a string', function() {
        it('returns a Promise that resolves to a key', function(done) {
          var sm = new StateMachine('foo', { foo: [] });
          sm.takeLock().then(function(key) {
            assert(sm.hasLock(key));
            assert(sm.isLocked);
          }).then(done, done);
        });
      });

      context('and called with a key', function() {
        it('returns a Promise that rejects with an Error', function(done) {
          var sm = new StateMachine('foo', { foo: [] });
          var key = takeAndReleaseLockSync(sm, 'lock');
          sm.takeLock(key).then(function(key) {
            throw new Error('Unexpected resolution');
          }, function(error) {
            assert(error instanceof Error);
          }).then(done, done);
        });
      });
    });
  });

  describe('#takeLockSync', function() {
    context('when locked', function() {
      context('and called with a string', function() {
        it('throws an Error', function() {
          var sm = new StateMachine('foo', { foo: [] });
          sm.takeLockSync('lock1');
          assert.throws(sm.takeLockSync.bind(sm, 'lock2'));
        });
      });

      context('and called with the key for the lock', function() {
        it('reenters the lock', function() {
          var sm = new StateMachine('foo', { foo: [] });
          var key = sm.takeLockSync('lock');
          assert.equal(key, sm.takeLockSync(key));
        });
      });

      context('and called with the key for a different lock', function() {
        it('throws an Error', function() {
          var sm = new StateMachine('foo', { foo: [] });
          var key = takeAndReleaseLockSync(sm, 'lock1');
          sm.takeLockSync('lock2');
          assert.throws(sm.takeLockSync.bind(sm, key));
        });
      });
    });

    context('when unlocked', function() {
      context('and called with a string', function() {
        it('returns a key', function() {
          var sm = new StateMachine('foo', { foo: [] });
          var key = sm.takeLockSync('lock');
          assert(sm.hasLock(key));
          assert(sm.isLocked);
        });
      });

      context('and called with a key', function() {
        it('throws an Error', function() {
          var sm = new StateMachine('foo', { foo: [] });
          var key = takeAndReleaseLockSync(sm, 'lock');
          assert.throws(sm.takeLockSync.bind(sm, key));
        });
      });
    });
  });

  describe('#transition', function() {
    context('when locked', function() {
      it('throws an Error if the key is not provided', function() {
        var sm = new StateMachine('foo', { foo: [] });
        sm.takeLockSync('lock');
        assert.throws(sm.transition.bind(sm, 'bar'));
      });

      it('throws an Error if the wrong key is provided', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock1');
        sm.takeLockSync('lock2');
        assert.throws(sm.transition.bind(sm, 'bar', key));
      });

      it('throws an Error if the key is provided but the transition is invalid', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = sm.takeLockSync('lock');
        assert.throws(sm.transition.bind(sm, 'bar', key));
      });

      it('sets .state to the new state if the key is provided and the transition is valid', function() {
        var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
        var key = sm.takeLockSync('lock');
        sm.transition('bar', key);
        assert.equal('bar', sm.state);
      });

      it('emits the "stateChanged" event if the key is provided and the transition is valid', function(done) {
        var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
        var key = sm.takeLockSync('lock');
        sm.once('stateChanged', function() {
          try {
            assert.equal('bar', sm.state);
          } catch (error) {
            done(error);
            return;
          }
          done();
        });
        sm.transition('bar', key);
      });
    });

    context('when unlocked', function() {
      it('throws an Error if a key is provided', function() {
        var sm = new StateMachine('foo', { foo: [] });
        var key = takeAndReleaseLockSync(sm, 'lock');
        assert.throws(sm.transition.bind(sm, 'bar', key));
      });

      it('throws an Error if the transition is invalid', function() {
        var sm = new StateMachine('foo', { foo: [] });
        assert.throws(sm.transition.bind(sm, 'bar'));
      });

      it('sets .state to the new state if the transition is valid', function() {
        var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
        sm.transition('bar');
        assert.equal('bar', sm.state);
      });

      it('emits the "stateChanged" event if the transition is valid', function(done) {
        var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
        sm.once('stateChanged', function() {
          try {
            assert.equal('bar', sm.state);
          } catch (error) {
            done(error);
            return;
          }
          done();
        });
        sm.transition('bar');
      });
    });
  });

  describe('#when', function() {
    describe('when the state matches the current state', () => {
      it('returns a Promise that resolves to the StateMachine', () => {
        var sm = new StateMachine('foo', { foo: [] });
        return sm.when('foo').then(_sm => assert.equal(sm, _sm));
      });
    });

    describe('when the state does not match the current state, and', () => {
      describe('the state is not reachable from the current state', () => {
        it('returns a Promise that rejects with an Error', () => {
          var sm = new StateMachine('foo', { foo: [], bar: [] });
          return sm.when('bar').then(
            () => { throw new Error('Unexpected resolution'); },
            error => assert(error instanceof Error));
        });
      });

      describe('the state is reachable from the current state, and it transitions to', () => {
        describe('the state', () => {
          it('returns a Promise that resolves to the StateMachine', () => {
            var sm = new StateMachine('foo', { foo: ['bar'], bar: [] });
            var promise = sm.when('bar').then(_sm => assert.equal(sm, _sm));
            sm.transition('bar');
            return promise;
          });
        });

        describe('a new state from which the state is no longer reachable', () => {
          it('returns a Promise that rejects with an Error', () => {
            var sm = new StateMachine('foo', { foo: ['bar', 'baz'], bar: [], baz: [] });
            var promise = sm.when('baz').then(
              () => { throw new Error('Unexpected resolution'); },
              error => assert(error instanceof Error));
            sm.transition('bar');
            return promise;
          });
        });
      });
    });
  });
});

function takeAndReleaseLockSync(sm, name) {
  var key = sm.takeLockSync(name);
  sm.releaseLock(key);
  return key;
}
