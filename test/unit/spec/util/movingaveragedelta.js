const assert = require('assert');
const MovingAverageDelta = require('../../../../lib/util/movingaveragedelta');

describe('MovingAverageDelta', () => {
  describe('#get', () => {
    let movingAverageDelta;

    before(() => {
      movingAverageDelta = new MovingAverageDelta();
    });

    context('when the first sample is put', () => {
      before(() => {
        movingAverageDelta.putSample(1000, 40);
      });

      it('should return the result of numerator0 / denominator0', () => {
        assert.equal(movingAverageDelta.get(), 1000 / 40);
      });
    });

    context('when the second sample is put, that has the same denominator as the previous sample', () => {
      before(() => {
        movingAverageDelta.putSample(2000, 40);
      });

      it('should return 0', () => {
        assert.equal(movingAverageDelta.get(), 0);
      });
    });

    context('when the third sample is put', () => {
      before(() => {
        movingAverageDelta.putSample(3000, 81);
      });

      it('should return the result of (numerator2 - numerator1) / (denominator2 - denominator1)', () => {
        assert.equal(movingAverageDelta.get(), 1000 / 41);
      });
    });
  });
});
