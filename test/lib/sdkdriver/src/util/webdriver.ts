import { dirname } from 'path';
import { Builder, WebDriver } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import { Options as FirefoxOptions, Profile } from 'selenium-webdriver/firefox';

process.env.PATH = process.env.PATH + ':' + dirname(require('chromedriver').path);
process.env.PATH = process.env.PATH + ':' + dirname(require('geckodriver').path);

const chromeOptions = new ChromeOptions()
  .addArguments('allow-file-access-from-files')
  .addArguments('use-fake-device-for-media-stream')
  .addArguments('use-fake-ui-for-media-stream');

const firefoxProfile = new Profile();
firefoxProfile.setPreference('media.navigator.permission.disabled', true);

const firefoxOptions = new FirefoxOptions().setProfile(firefoxProfile);

export function chrome(): WebDriver {
  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();
}

export function firefox(): WebDriver {
  return new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(firefoxOptions)
    .build();
}
