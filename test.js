const { combinationContext } = require('./test/lib/util');

combinationContext([
  [
    [1, 2],
    x => `x = ${x}`
  ],
  [
    [3, 4],
    y => `y = ${y}`
  ]
], ([x, y]) => {
  it('works?', () => {});
});
