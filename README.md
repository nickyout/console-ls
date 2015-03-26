# console-ls
Inspect and search instances more effectively in the developer console.

## What is this
Console-ls is a set of tools meant to inspect and search nested objects and instances in node.js and the browser console. Unlike the typical browser console, console-ls focuses on handling lots of nested properties at once and returning only what you were asking for. Without touching the mouse.

*   List, recurse, filter and sort properties based on name, value, type, prototype, interpreted 'kind' and more.
*   Navigate and search long results
*   Handles circular references (duh)
*   Can be browserified (duh)
*   Can create its own bookmarklets that save your settings
*   Currently minified to 11K
*   Did I say no mouse?

## Install

### In node.js
```
npm install console-ls --save-dev
```
...then use:
```
var ls = require('console-ls');
```

### As bookmarklet

[Bookmark this][bmk]

### In the browser
There is an UMD-formatted version in `./dist/ls.js` (and minified as `./dist/ls.min.js`). If you include it as script, you should get it at `window.ls`. UMD means you can use it as module in require-js, CommonJS, pretty much any module manager. Thanks, browserify.

### CDN
Thanks to rawgit.com you can use:

https://cdn.rawgit.com/nickyout/console-ls/0.1.0/dist/ls.min.js

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

### Listing methods:

*   `ls(target[, ...options])` - List the properties of `target` using the given `options`. Excludes private properties (=name starting with `_`) by default.
*   `ls.a(target[, ...options])` - List properties including private properties.
*   `ls.doc(target[, ...options])` - List the properties of `target` formatted as a documentation.
*   `ls.find(target[, ...options])` - Recursively barfs every property path of `target`, using `"."` as default nameSep.
*   `ls.rgrep(target[, ...options])` - Recursively barfs every property path of `target` as well as its full value onto a single line - excluding objects and arrays that are already being recursed through (trust me, this is NOT funny otherwise).
*   `ls.a.doc.find.rgrep(target[, ...options])` - ...and any subset, in any order. Their behaviors stack/overwrite in order of appearance.
*   `ls.cat(target)` - Output the target as string. Objects|Arrays will look like JSON, functions will be shown with their bodies.

### Special methods:

*   `ls.q([action][, fromRow])` - Navigate the last output (if `option.buffer.enabled` is `true`).
*   `ls.setOpt([...options])` - Set new default options based on the standard default options. No arguments means resetting to the standard default options. Returns `ls`.
*   `ls.addShortcut(name, options)` - Define new (chainable) listing method. Rejects overwrites.
*   `ls.toURL([hostURL])` - Create an url that has the changes to the default options embedded like a get var. If ls was loaded as bookmarklet, default hostURL will be the same url used in the bookmarklet.
*   `ls.toBookmarklet([hostURL])` - Like toURL, but wraps the returning url into a bookmarklet. Also uses the default hostURL if set.

### Examples with shortcuts:

*   `ls(target, 2)` - list (kind, name, value) with recursion depth of 2
*   `ls(target, 0)` - list (kind, name, value) with exhaustive recursion
*   `ls(target, 2, "string")` - list (kind, name, value) with recursion depth of 2 and filter on lines that contain the word `string`
*   `ls.a(target, 2, "string")` - list (kind, name, value) including private properties, with recursion depth of 2 and filter on lines that contain the word `string`
*   `ls.find(target, "string")` - list (name) with exhaustive recursion and filter on lines that contain the word `string`
*   `ls.find(target, 2, "string")` - list (name) with recursion depth of 2 and filter on lines that contain the word `string`
*   `ls.rgrep(target, 2, "string")` - list (name, full value) with recursion depth of 2 and filter on lines that contain the word `string`
*   `ls.rgrep(target, { show: "value", filter: { type: "Function" } })` - list (full value) with exhaustive recursion and filter on value type being `Function`

## The buffer (ls.q)
When __options.buffer.enabled__ is set, the last output of _any listing method_ or `ls.cat()` gets stored. You can view this buffer using __ls.q()__. You essentially move a cursor to a certain line of text inside the buffer and the resulting output is centered on that line.

### Invocation
The invocation is `ls.q([action][, fromRow])`, with the arguments used as follows:

#### action
Type: `Number|String|RegExp` Default: `0`

If `Number`, the index is moved by the given value (positive is downward). If `String` or `RegExp`, the index is moved downwards until it reaches a line that yields a match, or it reaches the starting line.

#### fromRow
Type: `Number` Default: `undefined`

If `Number`, the index is set to the given value _before_ the specified action is executed. This value always wraps, so passing `-1` will move the index to the bottom of the buffer. If `undefined`, the index is untouched.

### Examples

*   `ls.q()` - display buffer at the current index
*   `ls.q(10)` - move the index 10 lines down (and display the buffer at the resulting index)
*   `ls.q(-10)` - move the index 10 lines up
*   `ls.q(0, -1)` - go to the last line
*   `ls.q("match")` - find the first line that contains `match` starting at the line _after_ current index, moving down
*   `ls.q("match", 0)` - find the first line that contains `match` starting at the first line, moving down

## Options
The total number of options is outrageous and can be passed on every listing method call. All functions that accept an `options` argument will accept it as repeating argument and including all the same shorthands. In practice, you will be mostly using shorthands and (configurable) defaults.

The options that are used for a list method call is defined as follows:

*   A copy is made of the default options at `ls.opt` to make an options object for the current call.
*   Listing methods other than `ls` have their own options object that is normalized and then deep merged with this options object.
*   Every additional `options` argument gets normalized and is then deep merged with this options object (in order)
*   The resulting options object is used for the call.

### Setting defaults
You can set the default options in `ls.opt` by setting them directly. All possible properties are already set. If you screw up and want to revert to the default options, you can call `ls.setOpt()`. If you pass options to `ls.setOpt()`, these will be applied after the defaults are reset.

When you create a bookmarklet using `ls.toBookmarklet()`, the current options in `ls.opt` are automatically embedded and loaded when you use the bookmarklet. These options will then be the default options, even for `ls.setOpt()`.

### All options

#### options
Type: `Object|Number|String|RegExp` Default: `{..}`

An object containing any subset of the possible 'options' properties, which will override the default options during the listing method call for which they were specified.
A `Number` is shorthand for setting __options.r__. A `String` or `RegExp` is shorthand for setting __options.grep__.

#### options.r
Type: `Number|Boolean` Default: `1`

Recursion depth. `true`, `0` or less than `0` for exhaustive recursion. Can also be set by passing a number as __options__.

#### options.filter
Type: `String|RegExp|Object` Default: `{ isPrivate: false }`

Filter out any property found that does not match this filter. If `Object`, use any column label as key and the value as match string|RegExp. All column values get casted to string and the filter value simply gets fed to `String#search()`. You could also use `Boolean` and `Number`, though they will effectively be casted to string.

Keep in mind that different filters stack: if `filter.name` is defined in one options object and `filter.value` in another, a property will have to pass both in order to show up. To _unset_ a filter previously set, use `undefined` as value.

If `String`, `RegExp` or any other non-`Object`, the value becomes the filter value for column `name`.

#### options.grep
Type: `String|RegExp` Default: `''`

Filters by line instead of by column. Only the lines that contain this value will be displayed. Matching occurs _before_ lines are chopped (see __options.maxWidth__). Grep can also be set by passing a string as __options__.

#### options.show
Type: `String|Array` Default: `["kind", "name", "value"]`

Which columns to show. Use the same name as shown as the label at the top of a column. A string instead of an array becomes the single column to show, unless this string is `"all"`. In this case - you guessed it - all columns are shown. Currently there are: name, value, type, kind, depth, isPrivate, className, isCircular, lsLeaf.

#### options.sort
Type: `String|Array` Default: `["-kind", "name", "value"]`

What columns to sort the output on. Names are the same as __options.show__. Always alphabetically. Preceding the name with `-` reverses the sort. Passing a string instead of an array becomes the single column to sort on.

#### options.maxHeight
Type: `Number` Default: `1000`

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

#### options.includeTarget
Type: `Boolean` Default: `false`

If set, the target to inspect will be included in the listing as recursion level 1. If you wish to also list its direct properties, you must therefore set __options.r__ to `2`.

#### options.includeTargetName
Type: `String` Default: `[target]`

The name to use for the target itself in the listing.

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
Type: `Object|Boolean` Default: `{..}`

Contains properties that dictate the behavior of the buffer. If not an `Object`, the value is set as __options.buffer.enabled__.

#### options.buffer.enabled
Type: `Boolean` Default: `true`

If `true`, the last output gets stored and can be retrieved through __ls.q()__. If `false`, no output gets stored.

#### options.buffer.maxWidth
Type: `Number` Default: `133`

Defines the maximum display width in characters when using __ls.q()__. When set to `undefined`, the value of __options.maxWidth__ gets used instead.

#### options.buffer.maxHeight
Type: `Number` Default: `40`

Defines the maximum display height in rows when using __ls.q()__. When set to `undefined`, the value of __options.maxHeight__ gets used instead.

#### options.buffer.clear
Type: `Boolean` Default: `true`

Dictates whether or not the console should be cleared before __ls.q()__ is used. If set to `undefined`, the value of __options.clear__ is used. If __options.fnClear__ is not set, this setting does nothing.

#### options.buffer.wrap
Type: `Boolean` Default: `true`

Dictates whether relative navigation through __ls.q()__ should continue at the opposite end of the buffer when it meets the beginning or end of the buffer.

#### options.quiet
Type: `Boolean` Default: `false`

Whether or not to show informative strings, like column labels and line truncating notifications (see __options.maxWidth__). Not sure if it is going to be useful unless console-ls is going to be plugged into a bigger system.

#### options.clear
Type: `Boolean` Default: `false`

Whether or not to clear the console before _any_ logging. If __options.fnClear__ is not set, this setting does nothing.

#### options.iterationLimit
Type: `Number` Default: `100000`

Oops, that exhaustive recursion found more than you expected, and now your console is locked up for several seconds. Use this number to limit the maximum amount of total iterations, as in, maximum number of properties to read. When this maximum is reached, the last line of the output will be a message mentioning this. If `0`, no limit is enforced.

#### options.fnLog
Type: `Function` Default: `console.log.bind(console)`

The central log function used to output all logging. Output occurs as a single string containing all lines for a given output.

#### options.fnClear
Type: `Function` Default: `console.clear && console.clear.bind(console)`

The central clear function used when a console clear gets requested. Optional, this does nothing in node.js.

#### options.defineKind
Type: `Function` Default: `function(value, name, source){...}`

By default, the `kind` of property is derived by the value's typeof and its property name, and can be one of `class` (function, property in caps), `method` (function) or `property` (anything else). If you want something else, set this property with your own function.

Expect the arguments: `value` (the property value), `name` (the direct name of the property on the instance on which it was found) and `source` (the instance on which it was found).

#### options.definePrivate
Type: `Function` Default: `function(value, name, source){...}`

By default, a property is marked as private when its name starts with an `_`, or has a parent that is private. The fact that `_` means private is defined here. If you want it to be something else, set property this with your own method to dictate what else this is supposed to be.

Expect the arguments: `value` (the property value), `name` (the direct name of the property on the instance on which it was found) and `source` (the instance on which it was found).

## What? No unit tests?
Yeah. At the time of writing, this thing is still pretty new. The development was pretty much an iterative process where the best implementation for aesthetics and convenience were often in flux. In fact, if you have an idea on how the API can be improved in someway, explain me the hows and whys and I'll discuss them.

Also, it's meant to be a debug tool, not production code.

Poor excuses for no unit tests at all, but at the moment it's all I'm giving.

[bmk]: javascript:(function%20()%7Bvar%20d%3Ddocument%2Cs%3Dd.createElement(%22script%22)%3Bs.onload%3Dfunction()%7Bwindow.ls.opt.fnLog(%22Loaded%20console-ls%22)%7D%3Bs.src%3D%22https%3A%2F%2Fcdn.rawgit.com%2Fnickyout%2Fconsole-ls%2F0.1.0%2Fdist%2Fls.min.js%22%3Bd.body.appendChild(s)%7D)()
