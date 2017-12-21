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
  private readonly _webDriver: WebDriver;

  /**
   * Constructor.
   * @param {"chrome" | "firefox"} browser
   * @param {string} sdkUrl
   */
  constructor(browser: 'chrome' | 'firefox', sdkUrl: string) {
    super({
      browser,
      host: 'localhost',
      params: { sdkUrl }
    });
    this._webDriver = createWebDriver(browser);
  }

  /**
   * Start the browser process.
   * @param {string} url - URL for running the SDK setup code
   * @returns {Promise<void>}
   */
  async startBrowser(url: string): Promise<void> {
    await this._webDriver.get(url);
    return;
  }

  /**
   * Stop the browser process.
   * @returns {void}
   */
  stopBrowser(): void {
    this._webDriver.quit();
  }
}
