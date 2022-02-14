/**
 * A {@link Preflight} represents the object returned from `Video.runPreflight`
 * @property {string} status - The status of the test
 */

import { EventEmitter } from 'events';
import { PreflightTestReport } from '.';

export declare interface PreflightTest {
  on(event: 'progress', listener: (progress: string) => void): this;
  on(event: 'completed', listener: (report: PreflightTestReport)=> void): this;
  on(event: 'failed', listener: (error: Error, report: PreflightTestReport) => void): this;
}

export declare class PreflightTest extends EventEmitter {
  /**
   * Stops the test
   */
  stop(): void;
}
