./node_modules/.bin/browserify ls.js --standalone ls > dist/ls.js && ./node_modules/.bin/uglifyjs -m -c --screw-ie8 dist/ls.js > dist/ls.min.js
