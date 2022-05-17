'use strict';

const inherits = require('../../../../lib/vendor/inherits.js');
const assert = require('assert');

describe('inherits', () => {
  it('should inherit from parent', () => {
    function test(c) {
      assert.strictEqual(c.constructor, Child);
      assert.strictEqual(c.constructor.super_, Parent);
      assert.strictEqual(Object.getPrototypeOf(c), Child.prototype);
      assert.strictEqual(Object.getPrototypeOf(Object.getPrototypeOf(c)), Parent.prototype);
    }

    function Child() {
      Parent.call(this);
      test(this);
    }

    function Parent() {}

    inherits(Child, Parent);

    let c = new Child();
    test(c);

    assert.strictEqual(typeof inherits, 'function');
  });
});
