'use strict';

const By = require('selenium-webdriver').By;
const chrome = require('selenium-webdriver/chrome');
const StaleElementReferenceError = require('selenium-webdriver/lib/error').StaleElementReferenceError;
const until = require('selenium-webdriver').until;
const webdriver = require('selenium-webdriver');

/**
 * Build a Chrome-based {@link WebDriver}.
 * @returns {WebDriver}
 */
function buildWebDriverForChrome() {
  const chromeOptions = new chrome.Options()
    .addArguments('allow-file-access-from-files')
    .addArguments('use-fake-device-for-media-stream')
    .addArguments('use-fake-ui-for-media-stream');

  if (process.env.CHROME_BIN) {
    chromeOptions.setChromeBinaryPath(process.env.CHROME_BIN);
  }

  return new webdriver.Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();
}

/**
 * This function calls another function that returns a Promise. If that Promise
 * rejects with a {@link StaleElementReferenceError}, the function will be
 * retried (indefinitely).
 * @param {func(): Promise<T>}
 * @returns {Promise<T>}
 */
function retryOnStaleElementReferenceError(func) {
  return func().catch(error => {
    if (error instanceof StaleElementReferenceError) {
      return retryOnStaleElementReferenceError(func);
    }
    throw error;
  });
}

/**
 * Wait until an element is found and its text matches the RegExp. This function
 * will retry on {@link StaleElementReferenceError}s.
 * @param {WebDriver} driver
 * @param {string} querySelector
 * @param {RegExp} regExp
 * @returns {Promise<void>}
 */
function waitUntilElementLocatedAndTextMatches(driver, querySelector, regExp) {
  const by = By.css(querySelector);

  function waitUntilElementTextMatches() {
    return driver
      .wait(until.elementLocated(by))
      .then(element => driver.wait(until.elementTextMatches(element, regExp)));
  }

  return retryOnStaleElementReferenceError(waitUntilElementTextMatches);
}

exports.buildWebDriverForChrome = buildWebDriverForChrome;
exports.waitUntilElementLocatedAndTextMatches = waitUntilElementLocatedAndTextMatches;
