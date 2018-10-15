#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const package = require('./package.json');

// "pastshots --output tests/output --host tests/visual/*.html --port 8081",

function parseViewportSize(val) {
  val = val.split(',');
  return { width: Number(val[0]), height: Number(val[1]) };
}

program
  .version(package.version)
  .usage('[options] ')
  .option('--output <dir>', 'Output directory for the captured screenshots', 'pastshots')
  .option('--serve <glob>', 'Pages to serve with an embedded HTTP server', false)
  .option('--port <number>', 'Port number for the embedded HTTP server (--serve)', 8081)
  .option('--browser <firefox|chrome>', 'Browser that will take screenshots', 'firefox')
  .option('--viewport-size <width,height>', 'Initial window size (default: 1024,768)', parseViewportSize)
  .option('--selector <css selector>', 'Scope screenshot to specific selector. Leave empty for viewport')
  .option('--create-diff <boolean>', 'Create diff image', false)
  .parse(process.argv);

const { browser, serve, port, output, viewportSize, selector, createDiff } = program;
const glob = require('glob');
const pages = glob.sync(serve);

const createServer = require('http-server').createServer;
const server = createServer({
  root: './',
  showDotfiles: false,
  port
});

server.listen(port);

const capture = require('./capture').capture;

capture({
  host: `http://localhost:${port}/`,
  browser,
  output,
  pages,
  viewportSize,
  selector,
  createDiff
})
  .then(() => server.close());
