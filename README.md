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

## Quick tour:
Here's an impression of what console-ls can do, illustrated with its console barfs.  Assume it is loaded under the variable `ls`.

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
ls.doc(b, "SlowBuffer");
// yields
className|kind    |name         |type      |value
---------|--------|-------------|----------|----------------------------------------
Buffer   |property|parent       |SlowBuffer|/** * lodash 3.0.0 (Custom Build) <ht..
```

Search for a particular nested property name:
```
ls.find(global, "v8");
// yields
name
---------------------------------------------------------------------------------------------------------------------------------------------------------
process.config.variables.node_shared_v8
process.config.variables.v8_enable_gdbjit
process.config.variables.v8_no_strict_aliasing
process.config.variables.v8_use_snapshot
process.versions.v8
```

Find a string inside path or value recursively. For instance, `SIGINT` in `global`:

```
ls.rgrep(global, "SIGINT");
// yields
...
require.cache./home/nickyout/www/console-ls/node_modules/tiny-sprintf/dist/sprintf.bare.min.js.parent.parent.exports.repl.rli.history.0                  |"ls.rgrep(global, "SIGINT")"
module.exports.REPLServer                                                                                                                                |function REPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined) { if (!(this instanceof REPLServer)) { return new REPLServer(prompt, stream, eval_, useGlobal, ignoreUndefined); } EventEmitter.call(this); var options, input, output; if (typeof prompt == 'object') { // an options object was given options = prompt; stream = options.stream || options.socket; input = options.input; output = options.output; eval_ = options.eval; useGlobal = options.useGlobal; ignoreUndefined = options.ignoreUndefined; prompt = options.prompt; } else if (typeof prompt != 'string') { throw new Error('An options Object, or a prompt String are required'); } else { options = {}; } var self = this; self.useGlobal = !!useGlobal; self.ignoreUndefined =
...
```

Mother of barf. Let's chop the lines:

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

So `SIGINT` is in `module.exports.REPLServer`? Let's find out:

```
ls.cat(module.exports.REPLServer);
// yields
(it's pretty big)
...
			// Display prompt again
			self.displayPrompt();
		};
	});

	rli.on('SIGCONT', function() {
		self.displayPrompt(true);
	});

	self.displayPrompt();
}
```

Son of a barf. Good thing I had my buffer enabled:

```
ls.q('SIGINT');
// yields
    };
  }

  rli.setPrompt(self.prompt);

  rli.on('close', function() {
    self.emit('exit');
  });

 *var sawSIGINT = false; * * *
  rli.on('SIGINT', function() {
    var empty = rli.line.length === 0;
    rli.clearLine();

    if (!(self.bufferedCommand && self.bufferedCommand.length > 0) && empty) {
      if (sawSIGINT) {
        rli.close();
        sawSIGINT = false;
        return;
[From 101 to 119 of 228] Found SIGINT at 110
```

Yup. `SIGINT` is in `module.exports.REPLServer` alright.

## API methods

Listing methods:

*   `ls(target[, ...options])` - List the properties of `target` using the given `options`. Excludes private properties (=name starting with `_`) by default.
*   `ls.a(target[, ...options])` - List properties including private properties.
*   `ls.doc(target[, ...options])` - List the properties of `target` formatted as a documentation.
*   `ls.find(target[, ...options])` - Recursively barfs every property path of `target`, using `"."` as default nameSep.
*   `ls.rgrep(target[, ...options])` - Recursively barfs every property path of `target` as well as its full value onto a single line - excluding objects and arrays that are already being recursed through (trust me, this is NOT funny otherwise).
*   `ls.a.doc.find.rgrep(target[, ...options])` - ...and any subset, in any order. Their behaviors stack/overwrite in order of appearance.

Special methods:

*   `ls.cat(target)` - Output the target as string. Objects|Arrays will look like JSON, functions will be shown with their bodies.
*   `ls.q([action][, fromRow])` - Navigate the last output (if `option.buffer.enabled` is `true`).
*   `ls.setOpt([...options])` - Set new default options based on the standard default options. No arguments means resetting to the standard default options.
*   `ls._add(name, options)` - Define new (chainable) listing method. Rejects overwrites.

## Listing options
The total number of options is outrageous and can be passed on every listing method call. In practice, you will be mostly using shorthands and (configurable) defaults.

### how it works
The options that are used for a list method call is defined as follows:

*   A copy is made of the default options at `ls.opt` to make an options object for the current call.
*   Listing methods other than `ls` have their own options object that is normalized and then deep merged with this options object.
*   Every additional `options` argument gets normalized and is then deep merged with this options object (in order)
*   The resulting options object is used for the call.

### options
Type: `Object|Number|String|RegExp` Default: `{..}`
An object containing any subset of the possible 'options' properties, which will override the default options during the listing method call for which they were specified.
A `Number` is shorthand for setting __options.r__. A `String` or `RegExp` is shorthand for setting __options.grep__.

#### options.r
Type: `Number|Boolean` Default: `1`
Recursion depth. `true`, `0` or less than `0` for exhaustive recursion.

#### options.filter
Type: `String|RegExp|Object` Default: `{ isPrivate: false }`
Filter out any property found that does not match this filter. If `Object`, use any column label as key and the value as match string|RegExp. All column values get casted to string and the filter value simply gets fed to `String#search()`. You could also use `Boolean` and `Number`, though they will effectively be casted to string.
Keep in mind that different filters stack: if `filter.name` is defined in one options object and `filter.value` in another, a property will have to pass both in order to show up. To _unset_ a filter previously set, use `undefined` as value.
If `String`, `RegExp` or any other non-`Object`, the value becomes the filter value for column `name`.

#### options.grep
Type: `String|RegExp` Default: `''`
Filters by line instead of by column. Only the lines that contain this value will be displayed. Matching occurs _before_ lines are chopped (see __options.maxWidth__).

#### options.show
Type: `String|Array` Default: `["kind", "name", "value"]`
Which columns to show. Use the same name as shown as the label at the top of a column. A string instead of an array becomes the single column to show, unless this string is `"all"`. In this case - you guessed it - all columns are shown. Currently there are: name, value, type, kind, isPrivate, className, isCircular, lsLeaf.

#### options.sort
Type: `String|Array` Default: `["-kind", "name", "value"]`
What columns to sort the output on. Names are the same as __options.show__. Always alphabetically. Preceding the name with `-` reverses the sort. Passing a string instead of an array becomes the single column to sort on.

#### options.maxHeight
Type: `Number` Default: `0`
Limits number of output lines. If the limit gets exceeded, the output is ended with a line saying which lines you are viewing out of the total number of lines. If `0`, there is no limit and everything gets barfed.

#### options.maxWidth
Type: `Number` Default: `0`
Limits the width of a line in number of characters. If the limimt gets exceeded, the line is chopped at the end and the __options.chopChar__ is appended to show that it happened. If `0`, there is no limit and the whole line gets barfed.

#### options.chopChar
Type: `String` Default: `".."`
Whenever something gets chopped or left out, display this char. Used for chopping lines with `options.maxWidth`, `options.buffer.maxWidth` and `options.value.mediumDepth`.

#### options.nameSep
Type: `String` Default: `"."`
During recursive listing, property names are displayed as paths. This character is used between the names in such a path. It's really just aesthetics.

#### options.namePrefix
Type: `String` Default: `""`
Every property name gets this string before it. Aesthetics.

#### options.value
Type: `String|Object` Default: `{..}`
Defines several display options for the _value_ column.
If `String`, the value is used to set __options.value.default__.

#### options.value.default
Type: `String` Default: `"medium"`
Dictates default display style, which affects how a value gets displayed, depending on the type of value. Possible values are:

*   `"large"` - Display everything. If `Array|Object`, print value like JSON. If `Function`, display entire function. If __options.value.indent__ is not `''`, newlines are displayed and indented.
*   `"medium"` - Display enough. If `Array|Object`, print value like JSON, but stop at recursion level __options.value.mediumDepth__. If `Function`, display only `function()` with its args. Newlines are not displayed.
*   `"small"` - Display least. If `Array|Object`, print only their braces. If function, only display `function`. Newlines are not displayed.
*   `"none"` - Display nothing.

#### options.value.function
Type: `String` Default: `undefined`
Dictates display style for values of type `Function` only. Possible values are the same as for __options.value.default__. If set to `undefined`, uses __options.value.default__ as its value.

#### options.value.object
Type: `String` Default: `undefined`
Dictates display style for values of type `Object` only. Possible values are the same as for __options.value.default__. If set to `undefined`, uses __options.value.default__ as its value. (copied)

#### options.value.array
Type: `String` Default: `undefined`
Dictates display style for values of type `Array` only. Possible values are the same as for __options.value.default__. If set to `undefined`, uses __options.value.default__ as its value. (copied)

#### options.value.maxWidth
Type: `Number` Default: `40`
Enforces maximum number of characters to display any value, regardless of their display style. Chopped values get the __options.chopChar__ at the place of chopping.
Keep in mind that value chopping occurs _before_ filtering at the moment. You can no longer search for something that has been chopped...

#### options.buffer
Type: `Object`

#### options.quiet
Type: `Boolean` Default: `false`
Whether or not to show informative strings, like column labels and line truncating notifications (see __options.maxWidth__). Not sure if it is going to be useful unless console-ls is going to be plugged into a bigger system.

## The buffer (ls.q)


## What? No unit tests?
Yeah. At the time of writing, this thing is still pretty new. The development was pretty much an iterative process where the best implementation for aesthetics and convenience were often in flux. In fact, if you have an idea on how the API can be improved in someway, explain me the hows and whys and I'll discuss them.

Also, it's meant to be a debug tool, not production code.

Poor excuses for no unit tests at all, but at the moment it's all I'm giving. 