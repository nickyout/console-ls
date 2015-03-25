./node_modules/.bin/browserify ls.js --standalone ls >\
	dist/ls.js && ./node_modules/.bin/uglifyjs -m eval -c sequences,dead_code,unsafe,conditionals,comparisons,evaluate,booleans,loops,if_return,join_vars,cascade,negate_iife --screw-ie8 dist/ls.js >\
	dist/ls.min.js
