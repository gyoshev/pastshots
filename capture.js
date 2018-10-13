const webdriver = require('selenium-webdriver');
require('geckodriver');
require('chromedriver');
const By = webdriver.By;
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const fs = require('fs');
const path = require('path');
const urllib = require('url');
const mkdirp = require('mkdirp');
const looksSame = require('looks-same');
const imageminOptipng = require('imagemin-optipng');

const WIDTH = 1024;
const HEIGHT = 768;

exports.capture = async function capture({ browser, host, pages, output, viewportSize, selector, createDiff }) {
  viewportSize = viewportSize || { width: WIDTH, height: HEIGHT };

  const driver = new webdriver.Builder()
    .forBrowser(browser)
    .setChromeOptions(new chrome.Options().windowSize(viewportSize))
    .setFirefoxOptions(new firefox.Options().headless().windowSize(viewportSize))
    .build();

  await setViewportSize(driver, viewportSize);

  mkdirp.sync(output);

  try {
    for (let page of pages) {
      const name = path.basename(page, '.html');
      const url = host + page;
      await runTest({ driver, url, name, output, selector, createDiff });
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
};

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


async function runTest({ driver, url, name, output, selector, createDiff }) {

  console.log(`Loading ${url}...`);
  await driver.get(url);
  await driver.sleep(200);

  const element = await elementOrViewport(driver, selector);
  const data = await element.takeScreenshot();

  const png = Buffer.from(data, 'base64');
  const filename = `./${output}/${name}.png`;
  const diffname = `./${output}/${name}_diff_${Date.now()}.png`;

  const writeFile = async (png, filename) => {
    const optimized = await imageminOptipng({ optimizationLevel: 3 })(png);
    fs.writeFileSync(filename, optimized);
  };

  const diffSettings = {
    strict: true
  };

  if (fs.existsSync(filename)) {
    // do not overwrite file, if there are no visual differences
    looksSame(png, filename, diffSettings, (err, equal) => {
      if (err) {
        console.error(err);
        process.exit(1);
      } else if (!equal) {
        console.log('  Difference found!');
        if (createDiff) {
          console.log("    Creating diff image");
          looksSame.createDiff({
            reference: filename,
            current: png,
            highlightColor: '#ff00ff',
            strict: false
          }, (err, buffer) => {
            if (err) {
              console.error(err);
              process.exit(1);
            }
            writeFile(buffer, diffname);
          });
        }
        writeFile(png, filename);
      }
    });
  } else {
    // initial run, write file
    writeFile(png, filename);
  }

  return true;
}
