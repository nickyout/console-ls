# console-ls
Inspect and search instances more effectively in the developer console.

## What is this
Console-ls is a set of tools meant to inspect and search nested objects and instances in node.js and the browser console. Unlike the typical browser console, console-ls focuses on handling lots of nested properties at once and returning only what you were asking for. Without touching the mouse.

*   List, recurse, filter and sort properties based on name, value, type, prototype, interpreted 'kind' and more.
*   Navigate and search long results
*   Handles circular references (duh)
*   Can be browserified (duh)
*   Currently minified to 8K
*   Did I say no mouse?

## Install
In node.js:
```
npm install console-ls --save-dev
```
Use:
```
var ls = require('console-ls');
```

In the browser: there is an UMD-formatted version in `./dist/ls.js` (and minified as `./dist/ls.min.js`). If you include it as script, you should get it at `window.ls`. UMD means you can use it as module in require-js, CommonJS, pretty much any module manager.

// TODO: Include literal examples

## Common use cases:
View the direct properties of any object:
```
ls(ls);
// yields
kind    |name    |value
--------|--------|----------------------------------------
property|opt     |{ namePrefix: "",  nameSep: ".",  co.. }
method  |a       |function(target)
method  |cat     |function(value)
method  |doc     |function(target)
method  |find    |function(target)
method  |jsonPath|function(target)
method  |q       |function(action, fromRow)
method  |rgrep   |function(target)
method  |setOpt  |function(opt)
```

View an instance as if reading a documentation:

```
var b = new Buffer(4);
ls.doc(b);
// yields
className|kind    |name         |type      |value
---------|--------|-------------|----------|----------------------------------------
Buffer   |property|0            |Number    |208
Buffer   |property|1            |Number    |190
Buffer   |property|2            |Number    |250
Buffer   |property|3            |Number    |1
Buffer   |property|length       |Number    |4
Buffer   |property|offset       |Number    |4520
Buffer   |property|parent       |SlowBuffer|/** * lodash 3.0.0 (Custom Build) <ht..
Buffer   |method  |asciiSlice   |Function  |function(start, end)
Buffer   |method  |asciiWrite   |Function  |function(string, offset)
Buffer   |method  |binarySlice  |Function  |function(start, end)
...
(the list keeps on going)
```

...or only the lines that contain `"SlowBuffer"`:

```
ls.doc(b);
// yields
className|kind    |name         |type      |value
---------|--------|-------------|----------|----------------------------------------
Buffer   |property|parent       |SlowBuffer|/** * lodash 3.0.0 (Custom Build) <ht..
```

Search for a particular nested property name:
```
ls.find(global);
// yields
name
-------------------------------------------------------------------------------------..
ArrayBuffer
Buffer
Buffer.byteLength
Buffer.concat
Buffer.isBuffer
Buffer.isEncoding
Buffer.poolSize
DataView
...
(4500+ more)
```

Whoa, barf. I mean:

```
ls.find(global, "v8")
// yields
name
---------------------------------------------------------------------------------------------------------------------------------------------------------
process.config.variables.node_shared_v8
process.config.variables.v8_enable_gdbjit
process.config.variables.v8_no_strict_aliasing
process.config.variables.v8_use_snapshot
process.versions.v8
```

Find a string inside anywhere:

```
ls.rgrep(global, "SIGINT");
// yields
...
require.cache./home/nickyout/www/console-ls/node_modules/tiny-sprintf/dist/sprintf.bare.min.js.parent.parent.exports.repl.rli.history.0                  |"ls.rgrep(global, "SIGINT")"
module.exports.REPLServer                                                                                                                                |function REPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined) { if (!(this instanceof REPLServer)) { return new REPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined); } EventEmitter.call(this); var options, input, output; if (typeof prompt == 'object') { // an options object was given options = prompt; stream = options.stream || options.socket; input = options.input; output = options.output; eval_ = options.eval; useGlobal = options.useGlobal; ignoreUndefined = options.ignoreUndefined; prompt = options.prompt; } else if (typeof prompt != 'string') { throw new Error('An options Object, or a prompt String are required'); } else { options = {}; } var self = this; self.useGlobal = !!useGlobal; self.ignoreUndefined =
...
```

Mother of barf. Let's chop some lines:

```
ls.rgrep(global, "SIGINT", { maxWidth: 100 })
// yields
name                                                                                              ..
--------------------------------------------------------------------------------------------------..
module.exports.repl.rli.history.0                                                                 ..
require.cache./home/nickyout/www/console-ls/ls.js.parent.exports.repl.rli.history.0               ..
require.cache./home/nickyout/www/console-ls/node_modules/lodash.isarray/index.js.parent.parent.exp..
require.cache./home/nickyout/www/console-ls/node_modules/lodash.isobject/index.js.parent.parent.ex..
require.cache./home/nickyout/www/console-ls/node_modules/tiny-sprintf/dist/sprintf.bare.min.js.par..
module.exports.REPLServer                                                                         ..
require.cache./home/nickyout/www/console-ls/ls.js.parent.exports.REPLServer                       ..
require.cache./home/nickyout/www/console-ls/node_modules/lodash.isarray/index.js.parent.parent.exp..
require.cache./home/nickyout/www/console-ls/node_modules/lodash.isobject/index.js.parent.parent.ex..
require.cache./home/nickyout/www/console-ls/node_modules/tiny-sprintf/dist/sprintf.bare.min.js.par..
```

## How does it work?
Console-ls is centered on a single function `ls` paired with a crap ton of :

*   `ls(target[, ...options])` - List the properties of target.
*   `ls.cat(target)` - Display the target as a string
*   `ls.q([action][, fromRow])` - Navigate the last output (if `option.buffer.enabled` is `true`)

## ls
Invoke

## ls.cat

## ls.q

## Options

## Why?

