#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');
const program = require('commander');
const { createServer } = require('http-server');
const version = JSON.parse(fs.readFileSync(`${__dirname}/package.json`, { encoding: 'utf-8' })).version;
const configName = `${process.cwd()}/.pastshotsrc`;

const { capture } = require('./capture');

function readConfig() {

  if (!fs.existsSync(configName)) {
    console.info('No config file found. Using defaults.');

    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configName, { encoding: 'utf-8' }));
  } catch (e) {
    console.error('Can not parse .pasthostsrc');
    console.error(e);
    process.exit(1);
  }
}
const pastshotsrc = readConfig();

// "pastshots --output tests/output --serve 'tests/visual/*.html' --port 8081",

function parseViewportSize(val) {
  val = val.split(',');

  return { width: Number(val[0]), height: Number(val[1]) };
}

program
  .version(version)
  .usage('[options] ')
  .option('--output <dir>', 'Output directory for the captured screenshots', pastshotsrc.output || 'pastshots')
  .option('--serve <glob>', 'Pages to serve with an embedded HTTP server', pastshotsrc.serve || false)
  .option('--port <number>', 'Port number for the embedded HTTP server (--serve)', pastshotsrc.port || 8081)
  .option('--browser <firefox|chrome>', 'Browser that will take screenshots', pastshotsrc.browser || 'firefox')
  .option('--viewport-size <width,height>', 'Initial window size (default: 1024,768)', parseViewportSize)
  .option('--selector <css selector>', 'Scope screenshot to specific selector. Leave empty for viewport', pastshotsrc.selector || '')
  .option('--tolerance <number>', 'Tolerance to use when comparing', pastshotsrc.tolerance || 0)
  .option('--create-diff <boolean>', 'Create diff image', pastshotsrc.createDiff || false)
  .parse(process.argv);

const { browser, serve, port, output, viewportSize, selector, tolerance, createDiff } = { ...pastshotsrc, ...program };
const pages = glob.sync(serve);
const root = serve.substring(0, serve.indexOf('*') - 1);

const server = createServer({
  root: './',
  showDotfiles: false,
  port
});

server.listen(port);

capture({
  host: `http://localhost:${port}/`,
  browser,
  output,
  pages,
  root,
  viewportSize,
  selector,
  tolerance,
  createDiff
})
  .then(() => {
    server.close();
  });
