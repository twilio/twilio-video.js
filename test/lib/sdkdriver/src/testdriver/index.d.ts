import { EventEmitter } from 'events';

/**
 * A {@link TestDriver} represents an interface for starting/stopping
 * a process where the cross-platform test is being executed.
 * @interface
 */
interface TestDriver extends EventEmitter {
  close(): void;
  open(): Promise<void>;
}

/**
 * The {@link TestDriver} was closed.
 * @event Transport#close
 * @param {Error} [error] - Optional Error, if closed unintentionally
 */

export default TestDriver;
