import { EventEmitter } from 'events';

/**
 * A {@link Transport} represents an interface for communicating
 * between the node process that drives a cross-browser test and
 * the process in which the test is running.
 */
interface Transport extends EventEmitter {
  close(): void;
  open(): Promise<void>;
  send(data: any): void;
}

/**
 * The {@link Transport} was closed.
 * @event Transport#close
 * @param {Error} [error] - Optional Error, if closed unintentionally
 */

/**
 * The {@link Transport} received a message.
 * @event Transport#message
 * @param {object} data
 */

export default Transport;
