#!/bin/bash

set -e

./../index.js --output ./output/ --serve 'pages/**/*.html' --port 8081
