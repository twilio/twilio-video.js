SDKDriver
=========

**SDKDriver** is a cross-platform testing framework for Twilio's SDKs. Normally, cross-platform
tests are fragmented, with parts of the test code running in different components of the distributed
execution environment. **SDKDriver**'s architecture allows the developer to drive the test from a
single location (a node process in this case).

Architecture
------------

![Architecture Diagram](https://docs.google.com/drawings/d/e/2PACX-1vQ6yXXnHljFdNEDpsQITiUvxi2eYZxvq8Pi9RGjynOj-Bgs_tZlXwfTwxziQTj05Vdp-3TWf4cm7X92/pub?w=960&h=720)

An instance of **SDKDriver** consists of two components:
* **TestDriver** - Manages the test process
* **Transport** - Manages the communication channel between the node process and test process

The entire test is defined and run from the node process. The test process just loads the SDK and waits for
instructions from the node process. The node process sends messages to the test process specifying which SDK APIs
to execute, and then processes the responses received to determine whether the test succeeded or failed.

Usage
-----

We can create an instance of **SDKDriver** like so:

```javascript
const driver = await SDKDriver.create(transport, testDriver);
```

It is up to the developer to implement the **TestDriver** and **Transport** interfaces:

TestDriver

```typescript
import { EventEmitter } from 'events';
 
/**
 * A {@link TestDriver} represents an interface for starting/stopping
 * a process where the cross-platform test is being executed.
 * @interface
 */
interface TestDriver extends EventEmitter {
  /**
   * Close the test process.
   * @returns {void}
   */
  close(): void;
  
  /**
   * Open the test process.
   * @returns {Promise<void>} - Resolved when successfully opened
   */
  open(): Promise<void>;
}
 
/**
 * The {@link TestDriver} was closed.
 * @event Transport#close
 * @param {Error} [error] - Optional Error, if closed unintentionally
 */
```

Transport

```typescript
import { EventEmitter } from 'events';
 
/**
 * A {@link Transport} represents an interface for communicating
 * between the node process that drives a cross-browser test and
 * the process in which the test is running.
 */
interface Transport extends EventEmitter {
  /**
   * Close the {@link Transport}.
   * @returns {void}
   */
  close(): void;
  
  /**
   * Open the {@link Transport}.
   * @returns {Promise<void>} - Resolved when connection established
   */
  open(): Promise<void>;
  
  /**
   * Send data over the {@link Transport}.
   * @param {*} data
   * @returns {void}
   */
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
```

Driver Messaging Protocol (DMP)
-------------------------------

The **Driver Messaging Protocol** is the language used for communication between the node process and the test process.
There are 3 types of messages:
* **request** - This message instructs the test process to execute an API of the loaded SDK.
* **response** - This message returns the result of a **request** message.
* **event** - This message informs the node process that an event occured in the test process.

The **SDKDriver** class is **DMP**-enabled, so it can send requests, wait for responses and handle events like so:

```javascript
const driver = await SDKDriver.create(transport, testDriver);
 
driver.on('event', data => {
  console.log('New event from the test process:', data);
});
 
const response = await driver.sendRequest({ call: 'some-api' });
console.log('Response from the test process:', response);
```

Test process setup
------------------

The test process should be initialized by executing the following steps:
* Load the SDK to be tested
* Create a DMP client, and connect it to its corresponding DMP server
* Accept requests from the DMP server, and send responses to it

After these steps, the test code which is running in the node process will send API call requests to the test process,
where they are executed. The results are then sent as response messages back to the node process.
