'use strict';

const assert = require('assert');

const AsyncVar = require('../../../../lib/util/asyncvar');

describe('AsyncVar', () => {
  describe('#put', () => {
    describe('called after one #take', () => {
      it('resolves the #take with the value #put', async () => {
        const asyncVar = new AsyncVar();
        const take = asyncVar.take();
        asyncVar.put(1);
        assert.equal(1, await take);
      });
    });

    describe('called before any #takes', () => {
      describe('can be called multiple times', () => {
        it('and the next #take will only return the most recently #put value', async () => {
          const asyncVar = new AsyncVar();
          asyncVar.put(1);
          asyncVar.put(2);
          asyncVar.put(3);
          assert.equal(3, await asyncVar.take());
        });
      });
    });

    describe('called after multiple #takes', () => {
      describe('can be called once', () => {
        it('and will resolve the earliest unresolved call to #take with the value #put', async () => {
          const asyncVar = new AsyncVar();
          const take1 = asyncVar.take();
          asyncVar.take();
          asyncVar.put(1);
          assert.equal(1, await take1);
        });
      });

      describe('can be called multiple times', () => {
        it('and will resolve the calls to #take with the values #put in order', async () => {
          const asyncVar = new AsyncVar();
          const take1 = asyncVar.take();
          const take2 = asyncVar.take();
          asyncVar.take();
          asyncVar.put(1);
          asyncVar.put(2);
          assert.equal(1, await take1);
          assert.equal(2, await take2);
        });
      });
    });
  });
});
