import DMP from './dmp';
import TestDriver from './testdriver';
import Transport from './transport';

/**
 * SDK driver.
 * @classdesc An {@link SDKDriver} drives the execution of APIs
 *   of the SDK which is loaded in the {@link TestDriver} process
 *   by exchanging messages using the {@link Transport}.
 */
export default class SDKDriver extends DMP {
  private readonly _testDriver: TestDriver;

  /**
   * Create a new {@link SDKDriver}.
   * @static
   * @param {Transport} transport
   * @param {TestDriver} testDriver
   * @returns {Promise<SDKDriver>}
   */
  static async create(transport: Transport, testDriver: TestDriver): Promise<SDKDriver> {
    await Promise.all([
      transport.open(),
      testDriver.open()
    ]);
    return new SDKDriver(transport, testDriver);
  }

  /**
   * Constructor.
   * @param {Transport} transport
   * @param {TestDriver} testDriver
   */
  constructor(transport: Transport, testDriver: TestDriver) {
    super(transport);
    this._testDriver = testDriver;
  };

  /**
   * Close the {@link SDKDriver}.
   */
  close(): void {
    this._testDriver.close();
    super.close();
  }
}
