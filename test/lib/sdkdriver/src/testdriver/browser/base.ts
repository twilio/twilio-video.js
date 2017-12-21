import { EventEmitter } from 'events';
import { Server as HTTPServer } from 'http';
import TestDriver from '../';
import { createWebServer } from '../../util/index';

interface BrowserDriverOptions {
  browser: 'chrome' | 'firefox';
  host: string;
  params?: any;
}

/**
 * Browser process driver.
 * @class
 * @classdesc A {@link BrowserDriver} manages a browser process where the
 *   cross-browser test is running. It also manages a web server which serves
 *   the code that sets up the SDK in the browser.
 */
abstract class BrowserDriver extends EventEmitter implements TestDriver {
  private readonly _webServer: HTTPServer;
  protected readonly _options: BrowserDriverOptions;
  abstract startBrowser(url: string): Promise<void>;
  abstract stopBrowser(): void;

  /**
   * Constructor.
   * @param {BrowserDriverOptions} options
   */
  constructor(options: BrowserDriverOptions) {
    super();
    this._options = options;
    this._webServer = createWebServer();
  }

  /**
   * Get the web server.
   * @returns {HTTPServer}
   */
  get webServer(): HTTPServer {
    return this._webServer;
  }

  /**
   * Close the {@link BrowserDriver}.
   * @returns {void}
   */
  close(): void {
    this.stopBrowser();
    this.emit('close');
  }

  /**
   * Open the {@link BrowserDriver}.
   * @returns {Promise<void>}
   */
  open(): Promise<void> {
    const { host, params } = this._options;
    const { port } = this._webServer.address();

    const extendedParams: any = {
      wsUrl: `ws://${host}:${port}`,
      ...params
    };

    const serializedParams: any = Object.keys(extendedParams).map(key => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(extendedParams[key])}`;
    }).join('&');

    return this.startBrowser(`http://${host}:${port}/?${serializedParams}`);
  }

  /**
   * Start the web server.
   * @returns {Promise<void>}
   */
  startWebServer(): Promise<void> {
    return new Promise(resolve => this._webServer.listen(0, resolve));
  }

  /**
   * Stop the web server.
   * @returns {void}
   */
  stopWebServer(): void {
    this._webServer.close();
  }
}

export default BrowserDriver;
