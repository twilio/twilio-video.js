import { WebDriver } from 'selenium-webdriver';
import { createWebDriver } from '../../util';
import BrowserDriver from './base';

/**
 * Selenium browser process driver.
 * @class
 * @classdesc A {@link SeleniumBrowserDriver} manages a Selenium WebDriver
 *   browser process where the cross-browser test is running.
 */
export default class SeleniumBrowserDriver extends BrowserDriver {
  private _webDriver: WebDriver | null;

  /**
   * Constructor.
   * @param {"chrome" | "firefox"} browser
   * @param {string} webServerRoot - Root folder of the web server
   * @param {Array<string>} scripts - Scripts to be loaded in the browser
   */
  constructor(browser: 'chrome' | 'firefox', webServerRoot: string, scripts: Array<string>) {
    super({
      browser,
      host: 'localhost',
      params: { scripts },
      webServerRoot
    });
    this._webDriver = null;
  }

  /**
   * Start the browser process.
   * @param {string} url - URL for running the SDK setup code
   * @returns {Promise<void>}
   */
  async startBrowser(url: string): Promise<void> {
    const { _options: { browser } } = this;
    this._webDriver = this._webDriver || createWebDriver(browser);
    await this._webDriver.get(url);
    return;
  }

  /**
   * Stop the browser process.
   * @returns {void}
   */
  stopBrowser(): void {
    if (this._webDriver) {
      this._webDriver.quit().then(() => {
        // Do nothing.
      }, () => {
        // Do nothing.
      });
    }
    this._webDriver = null;
  }
}
