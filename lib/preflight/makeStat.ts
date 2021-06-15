
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Stats } from '../../tsdef/PreflightTypes';

/**
 * Computes min, max, average for given array.
 * @param {Array<number>} values
 * @returns {{min: number, max: number: average: number}|null}
 */
export function makeStat(values: number[]) : Stats|null {
  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    return { min, max, average };
  }
  return null;
}
