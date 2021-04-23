#!/bin/bash

set -e

start=`date +%s`
./../index.js --output ./output/ --serve 'pages/*.html' --port 8081 --browser firefox
end=`date +%s`
echo Execution time: `expr $end - $start`s.
