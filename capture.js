const webdriver = require('selenium-webdriver');
const { Builder, By } = webdriver;
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const fs = require('fs');
const path = require('path');
const looksSame = require('looks-same');
const imageminOptipng = require('imagemin-optipng');

const WIDTH = 1024;
const HEIGHT = 768;

exports.capture = async function capture({ browser, host, pages, root, output, viewportSize, selector, tolerance, createDiff }) {
  const size = viewportSize || { width: WIDTH, height: HEIGHT };

  const ChromeOptions = new chrome.Options()
    .headless()
    .windowSize(size);

  const FirefoxOptions = new firefox.Options()
    .headless()
    .setBinary(firefox.Channel.RELEASE)
    .windowSize(size);

  const driver = new Builder()
    .forBrowser(browser)
    .setChromeOptions(ChromeOptions)
    .setFirefoxOptions(FirefoxOptions)
    .build();

  await setViewportSize(driver, size);

  // console.time('runTests');
  try {
    for (let page of pages) {
      const name = path.basename(page, '.html');
      const url = host + page;

      const relativePath = path.relative(root, page);
      const outputPath = path.dirname(path.join(output, relativePath));

      fs.mkdirSync(outputPath, { recursive: true });

      console.group(`Running test for ${url}...`);
      // console.time('runTest');
      await runTest({ driver, url, name, outputPath, selector, tolerance, createDiff });
      // console.timeEnd('runTest');
      console.groupEnd();
    }
  } catch (e) {
    console.error('Error during capture:', e);
  } finally {
    // console.time('driver quit');
    await driver.quit();
    // console.timeEnd('driver quit');
  }
  // console.timeEnd('runTests');
};

async function setViewportSize(driver, size) {
  // console.time('driver.setSize');

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

  await driver.manage().window().setRect(width, height);

  // console.timeEnd('driver.setSize');
}

async function elementOrViewport(driver, selector) {
  let element;

  try {
    element = await driver.findElement(By.css(selector));
    console.log(`Taking screenshot of element ${selector}`);

    return element;
  } catch (e) {
    console.log('Taking screenshot of viewport');

    return driver;
  }
}


const writeFile = async(png, filename) => {
  // console.time('optimizing image');
  const optimized = await imageminOptipng({ optimizationLevel: 3 })(png);
  // console.timeEnd('optimizing image'); // eslint-disable-line padding-line-between-statements

  fs.writeFileSync(filename, optimized);
};

const createDiffImage = (current, reference, filename, tolerance) => {
  console.log('    Creating diff image');
  const diffImageSettings = {
    reference,
    current,
    diff: filename,
    highlightColor: '#ff00ff',
    strict: false,
    tolerance: tolerance
  };

  looksSame.createDiff(diffImageSettings);
};

async function runTest({ driver, url, name, outputPath, selector, tolerance, createDiff }) {

  // console.time('driver.get url');
  await driver.get(url);
  // console.timeEnd('driver.get url');

  // console.time('driver.findElement');
  const element = await elementOrViewport(driver, selector);
  // console.timeEnd('driver.findElement'); // eslint-disable-line padding-line-between-statements

  // console.time('driver.takeScreenshot');
  const data = await element.takeScreenshot();
  // console.timeEnd('driver.takeScreenshot'); // eslint-disable-line padding-line-between-statements

  const png = Buffer.from(data, 'base64');
  const filename = `./${outputPath}/${name}.png`;
  const diffname = `./${outputPath}/${name}_diff_${Date.now()}.png`;

  if (!fs.existsSync(filename)) {
    // initial run, write file
    writeFile(png, filename);

    return true;
  }

  // console.time('looksSame.compare');
  const { equal } = await looksSame(png, filename, { strict: false, tolerance: tolerance });
  // console.timeEnd('looksSame.compare'); // eslint-disable-line padding-line-between-statements

  // overwrite file only if there are visual differences
  if (!equal) {
    console.log('Difference found!');

    if (createDiff) {
      // console.time('looksSame.createDiff');
      createDiffImage(png, filename, diffname, tolerance);
      // console.timeEnd('looksSame.createDiff'); // eslint-disable-line padding-line-between-statements
    }

    writeFile(png, filename);
  }

  return true;
}
