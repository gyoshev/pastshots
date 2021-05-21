const webdriver = require('selenium-webdriver');
require('geckodriver');
require('chromedriver');
const By = webdriver.By;
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const looksSame = require('looks-same');
const imageminOptipng = require('imagemin-optipng');

const WIDTH = 1024;
const HEIGHT = 768;

exports.capture = async function capture({ browser, host, pages, output, viewportSize, selector, tolerance, createDiff }) {
  const size = viewportSize || { width: WIDTH, height: HEIGHT };

  const driver = new webdriver.Builder()
    .forBrowser(browser)
    .setChromeOptions(new chrome.Options().windowSize(size))
    .setFirefoxOptions(new firefox.Options().headless().windowSize(size))
    .build();

  await setViewportSize(driver, size);

  mkdirp.sync(output);

  try {
    for (let page of pages) {
      const name = path.basename(page, '.html');
      const url = host + page;
      await runTest({ driver, url, name, output, selector, tolerance, createDiff });
    }
  } catch (e) {
    console.error('Error during capture:', e);
  } finally {
    await driver.quit();
  }
};

async function setViewportSize(driver, size) {
  const { innerSize, outerSize } = await driver.executeScript(`
    return {
      outerSize: {
        width: window.outerWidth,
        height: window.outerHeight
      },
      innerSize: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
  `);

  const chromeSize = {
    width: outerSize.width - innerSize.width,
    height: outerSize.height - innerSize.height
  };
  const width = size.width + chromeSize.width;
  const height = size.height + chromeSize.height;

  await driver.manage().window().setSize(width, height);
}

async function elementOrViewport(driver, selector) {
  let element;

  try {
    element = await driver.findElement(By.css(selector));
    console.log(`  Taking screenshot of element ${selector}`);
    return element;
  } catch(e) {
    console.log('  Taking screenshot of viewport');
    return driver;
  }
}


const writeFile = async (png, filename) => {
  const optimized = await imageminOptipng({ optimizationLevel: 3 })(png);
  fs.writeFileSync(filename, optimized);
};

const exitOnError = fn => (err, result) => {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    fn(result);
  }
};

const createDiffImage = (current, reference, filename, tolerance) => {
  console.log("    Creating diff image");
  const diffImageSettings = {
    reference,
    current,
    highlightColor: '#ff00ff',
    strict: false,
    tolerance: tolerance
  };
  looksSame.createDiff(diffImageSettings, exitOnError(buffer => {
    writeFile(buffer, filename);
  }));
};

async function runTest({ driver, url, name, output, selector, tolerance, createDiff }) {

  console.log(`Loading ${url}...`);
  await driver.get(url);
  await driver.sleep(200);

  const element = await elementOrViewport(driver, selector);
  const data = await element.takeScreenshot();

  const png = Buffer.from(data, 'base64');
  const filename = `./${output}/${name}.png`;
  const diffname = `./${output}/${name}_diff_${Date.now()}.png`;

  if (!fs.existsSync(filename)) {
    // initial run, write file
    writeFile(png, filename);
    return true;
  }

  looksSame(png, filename, { strict: false, tolerance: tolerance }, exitOnError(equal => {
    // overwrite file only if there are visual differences
    if (!equal) {
      console.log('  Difference found!');
      if (createDiff) {
        createDiffImage(png, filename, diffname, tolerance);
      }
      writeFile(png, filename);
    }
  }));

  return true;
}
