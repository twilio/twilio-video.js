import * as assert from 'assert';
import { calculateMOS, mosToScore  } from '../../../lib/preflight/mos';

function round2(number) : number {
  return Math.round(number * 100) / 100;
}
describe('mos', () => {
  [
    {
      name: 'case 1: zero values',
      rtt: 0,
      jitter: 0,
      fractionLost: 0,
      expectedMos: 4.43,
      expectedQualityScore: 5
    },
    {
      name: 'case 1: high rtt',
      rtt: 2000,
      jitter: 0,
      fractionLost: 0,
      expectedMos: 1.00,
      expectedQualityScore: 1
    },
    {
      name: 'case 1: high packet loss',
      rtt: 0,
      jitter: 0,
      fractionLost: 10,
      expectedMos: 3.57,
      expectedQualityScore: 2
    }
  ].forEach(({ name, rtt, jitter, fractionLost, expectedMos, expectedQualityScore }) => {
    it(name, () => {
      const mos = calculateMOS(rtt, jitter, fractionLost);
      assert.deepStrictEqual(round2(mos), round2(expectedMos), `mos was ${mos}, expected ${expectedMos}`);
      const qualityScore = mosToScore(mos);
      assert.deepStrictEqual(round2(qualityScore), round2(expectedQualityScore), `qualityScore was ${qualityScore}, expected ${expectedQualityScore}`);
    });
  });
});
