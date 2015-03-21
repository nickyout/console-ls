"use strict";

/* common utils */

var sprintf = require('tiny-sprintf/dist/sprintf.bare.min'),
	isObject = require('lodash.isobject'),
	isArray = require('lodash.isarray'),
	isNumber = function(val) { return !isNaN(val) && typeof val === "number" },
	isPlainObject = function(value) { return value && typeOf(value) === "Object"; },
	isCollection = function(val) { return isArray(val) || isPlainObject(val); },
	typeOf = function(value) { return (Object.prototype.toString.call(value).match(/(\w+)\]/)[1]) || ''; },
	merge = function(target, source) {
		var keys = Object.keys(source),
			key,
			i = -1;
		while (++i < keys.length) {
			key = keys[i];
			if (isPlainObject(source[key])) {
				if (!isPlainObject(target[key])) {
					target[key] = {};
				}
				merge(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		}
		return target;
	},
	intersection = function(arr1, arr2) {
		var i=-1, returnArr = [];
		while (++i < arr1.length) {
			if (arr2.indexOf(arr1[i]) !== -1) {
				returnArr.push(arr1[i]);
			}
		}
		return returnArr;
	};

/* ls args */

var regFnArgs = /(\([^)]*\))/,
	privateTestEntry = {},
	msgDisplaySubset = "\nDisplayed [%s..%s] of %s results",
	allColumns = ['index','name','value','type','kind','isPrivate','className','isCircular', 'lsLeaf'],
	buffer = null,
	bufferIndex = 0,
	LARGE = 'large',
	MEDIUM = 'medium',
	SMALL = 'small',
	NONE = 'none';

/* ls utils */

function getPropertyDescriptions(target, options, namePrefix, depth, descr, blackList, parent) {
	namePrefix || (namePrefix = '');
	descr || (descr = []);
	blackList || (blackList = []);
	var entry,
		owner,
		ownerDepth,
		ownerCtorName,
		kind,
		value,
		isCircular,
		isPrivate,
		previousBlackListLength = blackList.length,
		previousDescrLength;

	if (!isObject(target)) {
		return descr;
	}
	blackList.push(target);
	for (var name in target) {
		value = target[name];
		isPrivate = options.definePrivate(value, name, target);
		if (options.filter.isPrivate !== undefined) {
			// Probably worth the extra check
			privateTestEntry.isPrivate = isPrivate;
			if (!filterDescription.call(options, privateTestEntry)) {
				continue;
			}
		}
		owner = target;
		ownerDepth = 0;
		while (!owner.hasOwnProperty(name)) {
			owner = Object.getPrototypeOf(owner);
			ownerDepth++;
		}
		ownerCtorName = owner && owner.constructor && owner.constructor.name || '(anonymous)';
		kind = options.defineKind(value, name, target);
		isCircular = blackList.indexOf(value) !== -1;
		previousDescrLength = descr.length;
		entry = {
			index: descr.length,
			kind: kind,
			type: typeOf(value),
			isPrivate: (parent && parent.isPrivate) || isPrivate,
			isCircular: isCircular,
			lsLeaf: false,
			name: namePrefix + name,
			_value: value,
			value: isCircular ? "[Circular]" : stringify(value, options) + '',
			owner: owner,
			ownerDepth: ownerDepth,
			className: ownerCtorName
		};
		if (depth !== 1 && !isCircular) {
			getPropertyDescriptions(
				value,
				options,
				namePrefix + name + options.nameSep,
				depth - 1,
				descr,
				blackList,
				entry
			);
		}
		entry.lsLeaf = !isCollection(value) || descr.length == previousDescrLength;
		// Option to leave out recursed entirely
		if (filterDescription.call(options, entry)) {
			descr.push(entry);
		}
	}
	// Truncate elements added in the list during this loop
	blackList.length = previousBlackListLength;
	return descr;
}

function sortDescriptions(arrSort, a,b) {
	var prop, aVal, bVal,
		fac, ascend,
		i = 0, returnVal = 0;

	while (prop = arrSort[i++]) {
		if (prop[0] === '-') {
			ascend = false;
			prop = prop.substr(1);
		} else {
			ascend = true;
		}
		aVal = a[prop] + '';
		bVal = b[prop] + '';
		if (aVal == bVal) {
			fac = 0;
		} else {
			fac = (ascend == (aVal > bVal)) * 2 - 1;
		}
		returnVal += Math.pow(2, arrSort.length - i) * fac;
	}
	return returnVal;
}

function filterDescription(el){
	var options = this,
		filter = options.filter;

	for (var name in filter) {
		if (el.hasOwnProperty(name) && filter[name] !== undefined && (el[name]+'').search(filter[name]) === -1) {
			return false;
		}
	}
	return true;
}

function getColumnWidths(keys, columnWidths, el) {
	var i = 0, key, len, val;
	while (key = keys[i++]){
		val = (el[key] + '');
		len = val.indexOf('\n') + 1 || val.length;
		if (columnWidths[key] < len) {
			columnWidths[key] = len;
		}
	}
}

/**
 * Prints a property description using the log function in options.
 * Chops off line if it is too long.
 * @param {Array} lines
 * @param {Object} options
 */
function printLines(lines, options) {
	console.clear && console.clear();
	if (!isArray(lines)) {
		lines = [lines];
	}
	var i = -1,
		max = lines.length,
		log = options.log,
		maxWidth = options.maxWidth,
		maxWidthChar = options.maxWidthChar;
	while (++i < max) {
		log(_chop(lines[i], maxWidth, maxWidthChar));
	}

}

/**
 * Converts a propertyDescription into a string or array of strings and adds them to argument `lines`.
 * @param {Array} lines
 * @param {String} sprintfString
 * @param {Object} propertyDescription
 * @this {Object} options
 */
function descriptionToLines(lines, sprintfString, propertyDescription) {
	var options = this,
		args = [sprintfString],
		force = options.force,
		line,
		i = 0,
		key;

	// Append each value of column to it
	while (key = allColumns[i++]) {
		args.push(propertyDescription[key]);
	}
	line = sprintf.apply(null, args);
	if (!force && options.grep && line.search(options.grep) === -1) {
		return;
	}
	lines.push.apply(lines, line.split('\n'));
}

/**
 * Converts a collection to a string.
 * @param {Object|Array} value
 * @param {Object} options
 * @param {String} prefix
 * @param {Array} blackList
 * @param {Number} depth - recursion depth
 */
function _stringifyCollection(value, options, prefix, blackList, depth) {
	// Either single line, or all indented
	var isArr = isArray(value),
		str = isArr ? '[' : '{',
		iter = isArr ? value : Object.keys(value),
		isNonEmpty = iter.length > 0,
		i = -1,
		iterValue,
		valueFormat = options.value,
		maxWidth = valueFormat.maxWidth,
		maxWidthChar = options.maxWidthChar,
		indent,
		iterPrefix;
	switch (isArr ? valueFormat.array : valueFormat.object) {
		case LARGE:
			if (!isNumber(depth)) {
				depth = -1;
			}
			indent = valueFormat.indent || '';
			break;
		case MEDIUM:
			if (!isNumber(depth)) {
				depth = valueFormat.mediumDepth;
			}
			indent = '';
			break;
		case SMALL:
			if (!isNumber(depth)) {
				depth = 0;
			}
			break;
		case NONE:
		default:
			return '';
	}
	if (indent) {
		iterPrefix = '\n' + prefix + indent;
	} else {
		iterPrefix = ' ';
	}
	if (depth !== 0) {
		while (++i < iter.length) {
			str += iterPrefix;
			if (isArr) {
				iterValue = iter[i];
			} else {
				str += iter[i] + ": ";
				iterValue = value[iter[i]];
			}
			str += stringify(iterValue, options, prefix + indent, blackList, depth-1);
			if (str !== (str = _chop(str, maxWidth && (maxWidth - 2), maxWidthChar))) {
				break;
			}
			if (i !== iter.length -1) {
				str += ', ';
			}
		}
		if (isNonEmpty) {
			str += ' ';
		}
	} else {
		if (isNonEmpty) {
			// What lies inside remains a mystery...
			str += maxWidthChar;
		}
	}
	str += isArr ? ']' : '}';
	return str;
}

/**
 * Chops off the end of a string if its length exceeds the number maxWidth.
 * If maxWidth is a negative number, chops from the beginning of the string.
 * If maxWidth is 0, no chopping happens.
 * @param {String} str - the string to chop
 * @param {Number} [maxWidth=0] - the size limit. If negative, chops from the other beginning
 * @param {String} [maxWidthChar=''] - the string placed where the chopping occurred.
 * @return {String} the resulting string
 */
function _chop(str, maxWidth, maxWidthChar) {
	maxWidthChar || (maxWidthChar = '');
	if (maxWidth && str.length > Math.abs(maxWidth)) {
		if (maxWidth < 0) {
			return maxWidthChar + str.substr(maxWidth + maxWidthChar.length)
		} else {
			return str.substr(0, maxWidth - maxWidthChar.length) + maxWidthChar;
		}
	}
	return str;
}

function _stringifyFunction(value, options) {
	var str = '',
		fnMatch,
		valueFormat = options.value,
		indent = valueFormat.indent,
		maxWidth = valueFormat.maxWidth,
		maxWidthChar = options.maxWidthChar;
	switch (valueFormat.function) {
		case LARGE:
			str += value;
			if (!indent) {
				str = str.replace(/\s*\n\s*/gm, ' ');
			} else {
				str = str.replace(/\t/gm, indent);
			}
			break;
		case MEDIUM:
			fnMatch = (value + '').match(regFnArgs);
			str += (fnMatch ? fnMatch[1] : '()');
		// Fallthrough
		case SMALL:
			str = 'function' + str;
			break;
		case NONE:
		default:
			return '';
	}
	return _chop(str, maxWidth, maxWidthChar);
}

/**
 *
 * @param {*} value
 * @param {Object} options
 * @param {String} [prefix]
 * @param {Array} [blackList]
 * @param {Number} [depth]
 */
function stringify(value, options, prefix, blackList, depth) {
	blackList || (blackList = []);
	prefix || (prefix = '');
	var str,
		valueFormat = options.value,
		maxWidth = valueFormat.maxWidth,
		maxWidthChar = options.maxWidthChar;
	switch (typeof value) {
		case "function":
			return _stringifyFunction(value, options);
		case "string":
			str = '"' + value + '"';
			break;
		case "object":
			// Showing contents
			if (isCollection(value)) {
				// First call
				if (blackList.indexOf(value) !== -1) {
					return "[Circular]";
				}
				blackList.push(value);
				str = _stringifyCollection(value, options, prefix, blackList, depth);
				blackList.pop();
				return str;
			}
		// Fallthrough intended
		default:
			str = "" + value;
	}
	str = _chop(str, maxWidth, maxWidthChar);
	return str;
}

/**
 * Returns an object with the properties sprintf, label and sep that have the same properties
 * as a property description. They can hence be printed in the same way
 * @param {Array} arr - the properties to set.
 * Since only these columns are printed, others do not need to be set.
 * @param {Object} columnWidths - keys are column names, values are column widths
 * @returns {{sprintf: {}, label: {}, sep: {}}}
 */
function createColumnDescriptions(arr, columnWidths) {
	columnWidths || (columnWidths = {/*unused*/});
	var i = 0,
		columnDef = {
			sprintf: {},
			label: {},
			sep: {}
		},
		key,
		width,
		index;
	while (key = arr[i++]) {
		// nonzero
		width = Math.max(columnWidths[key], key.length);
		index = allColumns.indexOf(key)+1;
		columnDef.sprintf[key] = "%"+index+"$-"+width+"s";
		columnDef.label[key] = key;
		columnDef.sep[key] = sprintf("%'-"+width+"s", '');
	}
	return columnDef;
}

/**
 * Creates the string for sprintf used for each row.
 * @param {Object} columnDescriptions
 * @this {Object} options
 * @returns {string}
 */
function createSprintfString(columnDescriptions) {
	var options = this,
		columnsToShow = options.show,
		i = -1,
		showCol,
		str,
		arr = columnsToShow.slice();
	while (showCol = arr[++i]) {
		arr[i] = columnDescriptions.sprintf[showCol] || '';
	}
	// Last one does no spacing
	if (str = arr[arr.length - 1]) {
		str = str.replace(/-\d+/, '');
		arr[arr.length-1] = str;
	}
	return arr.join(options.columnSep);
}

function createOptions(defaultOptions, args, index) {
	if (index === undefined) {
		index = 1;
	}
	var options = {},
		i = index - 1,
		max = args.length,
		arg,
		value,
		cols;
	if (defaultOptions) {
		options = merge(options, defaultOptions);
	}
	while (++i < max) {
		arg = args[i];
		if (!isPlainObject(arg)) {
			// Shortcuts:
			switch (typeOf(arg)) {
				// options as grep
				case "String":
				case "RegExp":
					arg = { grep: arg };
					break;
				// recursion depth (0 is infinite)
				case "Number":
					arg = { r: arg };
					break;
			}
		}
		if (arg.value && !isPlainObject(arg.value)) {
			arg.value = { default: arg.value };
		}
		if (arg.filter && !isPlainObject(arg.filter)) {
			arg.filter = { name: arg.filter };
		}
		merge(options, arg);
	}

	// Interpret options
	if (options.show === "all") {
		options.show = allColumns.slice();
	} else {
		cols = options.show;
		if (!isArray(cols)) {
			cols = [cols];
		}
		options.show = intersection(cols, allColumns);
	}

	if (!isArray(options.sort)) {
		options.sort = [options.sort];
	}

	if (!isNumber(options.r) && options.r) {
		options.r = 0;
	}

	// Normalize value settings
	value = options.value;
	value.default || (value.default = MEDIUM);
	value.function || (value.function = value.default);
	value.object || (value.object = value.default);
	value.array || (value.array = value.default);
	return options;
}

/**
 * Description given for each property found.
 * @typedef {Object} module:console-ls~PropertyDefinition
 * @prop {String} name - the property name on the instance
 * @prop {*} value - the property value
 * @prop {String} type - the type of the property value.
 * @prop {String} kind - the interpreted kind of value. Can be "class", "method" or "property"
 * @prop {Boolean} isPrivate - whether or not the property is considered private/protected.
 * @prop {Boolean} isCircular - whether or not its value is also equal one of its parents.
 * Derived from whether or not the property name starts with a _
 * @prop {*} owner - the actual owner of the property. Can be the target itself, or any instance it its prototype chain.
 * @prop {Number} ownerDepth - the depth in the prototype chain at which the owner was found
 * @prop {String} className - the constructor name of the owner, or "(anonymous)" if not found.
 */

/**
 * All possible options of ls.
 * <p/>
 * The following columns are available:
 * <ul>
 *     <li><code>name</code> - the name of the property</li>
 *     <li><code>value</code> - the value of the property</li>
 *     <li><code>type</code> - the type of the value, as returned by <code>Object.prototype.toString</code></li>
 *     <li><code>kind</code> - interpreted 'kind' of property. See below for explanation.</li>
 *     <li><code>isPrivate</code> - whether the property name starts with a "_". </li>
 *     <li><code>className</code> - the result of an attempt to uncover the name of the constructor
 *      from which this property was inherited.</li>
 * </ul>
 * Column values for <code>kind</code> can be:
 * <ul>
 *     <li><code>class</code> - a function which property name starts with a capital</li>
 *     <li><code>method</code> - any other function</li>
 *     <li><code>property</code> - any other value type</li>
 * </ul>
 * @typedef {Object} module:console-ls~Options
 * @prop {String|RegExp|Object.<String|RegExp>} [filter] - filter by column value, where key is the column name.
 * 									Filter will work even if the column is not shown. If filter is a
 * 									String or RegExp, it will filter by name.
 * @prop {String|RegExp} 			[grep] - filters per output line. Only lines matching will be displayed.
 * @prop {Boolean|Number} 			[r=1] - list recursively. If number > 0, limits recursion depth to that number.
 * 									Circular references are prevented and will have [Circular] as its value.
 * @prop {String|Array.<String>} 	[show] - defines which columns to show. Use "all" to show all columns.
 * @prop {String|Array.<String>} 	[sort] - sort columns ascending. Prepend '-' for descending.
 * 									Default is <code>['-kind', 'name']</code>.
 */

/**
 * List the contents of any object, array, regexp, function, or derivative. Prints output to <code>console.log</code>.
 * @param {Object|Array|RegExp|Function} target - the target to list the contents of
 * @param {...module:console-ls~Options|String|RegExp|Number} [options] - several option specifications are merged into one.
 * If string or regexp, the value is used as used as options.grep.
 * If number, the value is used as options.r.
 * @example
 *
 * ls(u, "property");
 * // kind:      name:                value:
 * // ---------- -------------------- --------------------
 * // property   VERSION              "2.4.1"
 * // property   support              { funcDecomp: true, funcNames: true }
 * // property   templateSettings     { escape: /<%-([\s\S]+?)%>/g, evaluate: /<%([\...}
 * // method     property             function()
 *
 * ls(u, { grep: "property", sort: "kind" });
 * // kind:      name:                value:
 * // ---------- -------------------- --------------------
 * // method     property             function()
 * // property   VERSION              "2.4.1"
 * // property   templateSettings     { escape: /<%-([\s\S]+?)%>/g, evaluate: /<%([\...}
 * // property   support              { funcDecomp: true, funcNames: true }
 *
 * ls(u, { filter: { kind: "property" }, sort: ["kind", "name"] });
 * // kind:      name:                value: * // ---------- -------------------- --------------------
 * // property   VERSION              "2.4.1"
 * // property   support              { funcDecomp: true, funcNames: true }
 * // property   templateSettings     { escape: /<%-([\s\S]+?)%>/g, evaluate: /<%([\...}
 *
 * ls(u, { filter: { isPrivate: "true" }, showPrivate: true, all: true });
 * // kind:      name:                value:               type:      isPrivate: className:
 * // ---------- -------------------- -------------------- ---------- ---------- --------------------
 * // method     _                    function()           Function   true       Function
 * @module {Function} console-ls
 */
function ls(target) {
	var descriptions,
		descriptionsToPrint,
		rowStart,
		rowEnd,
		fnDescriptionToLine,
		options = createOptions(ls.o, arguments),
		columnDescriptions,
		columnWidths = {},
		cols,
		maxRows = options.maxRows,
		allLines = [],
		sprintfString,
		i = 0, el, max;
	// Merge arguments into options

	// Sort all required descriptions
	cols = options.show;
	descriptions = getPropertyDescriptions(target, options, options.namePrefix, options.r, []);
	descriptions.sort(sortDescriptions.bind(null, options.sort));

	// Truncate excess
	if (maxRows && Math.abs(maxRows) < descriptions.length) {
		if (maxRows > 0) {
			rowStart = 0;
			rowEnd = maxRows;
		} else {
			rowStart = descriptions.length + maxRows;
			rowEnd = descriptions.length;
		}
		descriptionsToPrint = descriptions.slice(rowStart, rowEnd);
	} else {
		descriptionsToPrint = descriptions;
	}

	// Create properly sized print method
	i = 0;
	while (el = cols[i++]) {
		columnWidths[el] = el.length;
	}
	i = 0;
	while (el = descriptionsToPrint[i++]) {
		getColumnWidths(cols, columnWidths, el);
	}
	columnDescriptions = createColumnDescriptions(cols, columnWidths);
	sprintfString = createSprintfString.call(options, columnDescriptions);
	fnDescriptionToLine = descriptionToLines.bind(options, allLines, sprintfString);

	// Collect lines
	// Headers force hack, omit grep :^)
	if (!options.quiet) {
		options.force = true;
		fnDescriptionToLine(columnDescriptions.label);
		fnDescriptionToLine(columnDescriptions.sep);
	}
	delete options.force;
	i = 0;
	while (el = descriptionsToPrint[i++]) {
		fnDescriptionToLine(el);
	}

	// Clear immediately
	descriptionsToPrint.length = descriptions.length = 0;

	// If subset, add end message
	if (!options.quiet && (rowStart || rowEnd)) {
		allLines.push(sprintf(msgDisplaySubset, rowStart, rowEnd - 1, descriptions.length));
	}

	// Print lines
	printLines(allLines, options);
	buffer = allLines;
	bufferIndex = 0;
}

ls.reset = function() {
	var c = console;
	ls.o = {
		/**
		 * Prefix used for name paths
		 * @type {String}
		 * @memberof module:console-ls
		 */
		namePrefix: '',
		/**
		 * Separator used for name paths
		 * @type {String}
		 * @memberof module:console-ls
		 */
		nameSep: '.',
		/**
		 * Separator between columns
		 * @type {String}
		 */
		columnSep: '|',
		/**
		 * Set maximum output width in number of characters.
		 * @type {Number}
		 */
		maxWidth: 0,
		/**
		 * This character sequence is used at the place where an output line was cut off.
		 * @type {String}
		 * @see module:console-ls#maxWidth
		 */
		maxWidthChar: '..',
		/**
		 * Set maximum number of output rows.
		 * @type {Number}
		 */
		maxRows: 0,
		/**
		 * If true, only the result is printed (no headers etc).
		 * @type {Boolean}
		 */
		quiet: false,
		/**
		 * The default values of each option.
		 * @type {Object}
		 */
		show: ["kind", "name", "value"],
		/**
		 * Value display settings for non-literals.
		 * @type {Object}
		 */
		value: {
			default: MEDIUM,
			function: undefined,
			object: undefined,
			array: undefined,
			indent: '  ',
			maxWidth: 40,
			mediumDepth: 2
		},
		/**
		 * Sort resulting rows alphabetically by these rows
		 * @type {Array.<String>|String}
		 */
		sort: ['-kind', 'name'],
		/**
		 * Inclusive filter per column value. Only rows that match every filter gets displayed.
		 * Any value except `undefined` is directly fed to the `String#search` method.
		 * Use `undefined` to unset a (previously set) filter. Use the string `"undefined"`
		 * if you want to search for the value.
		 * @type {Object.<*>}
		 */
		filter: {
			isPrivate: false
		},
		/**
		 * Recursion depth. 0 or less is exhaustive (handling circular).
		 * Default is 1, which is only direct properties.
		 * @type {Number}
		 */
		r: 1,
		/**
		 * When a row is printed, the resulting string is filtered with this.
		 * @type {String|RegExp}
		 */
		grep: '',
		/**
		 * Output function. Default is console.log.
		 * @type {Function}
		 */
		log: c && c.log && c.log.bind(c),
		/**
		 * Dictates how the value of "kind" gets derived
		 * @param {*} value
		 * @param {String} key
		 * @param {Object|Array|Function|*} source
		 * @return {String}
		 */
		defineKind: function(value, key, source) {
			if (typeof value === "function") {
				if (/^[A-Z]/.test(key)) {
					return "class";
				} else {
					return "method";
				}
			}
			return "property";
		},
		/**
		 * Dictates how the value of "isPrivate" gets derived
		 * @param {*} value
		 * @param {String} key
		 * @param {Object|Array|Function|*} source
		 * @returns {Boolean}
		 */
		definePrivate: function(value, key, source) {
			return key[0] === "_";
		}

	};
};

// Sets defaults
ls.reset();

/* additional API methods */

ls.cat = function(value) {
	value = { '': value };
	var catOptions = {
		value: {
			default: LARGE,
			function: LARGE,
			object: LARGE,
			array: LARGE,
			maxWidth: 0
		},
		r: 1,
		show: 'value',
		sort: [],
		quiet: true
	};
	ls(value, catOptions)
};

/**
 * Create an ls function preceded by several options objects. Shorthand notations are also supported.
 * @param {Array} arrOptions - option or array of options.
 * @returns {Function}
 */
function lsCombo(arrOptions) {
	return function(target) {
		ls.apply(ls, [target].concat(arrOptions).concat(Array.prototype.slice.call(arguments, 1)));
	}
}

function _addRecursive(target, keys, arrOptions) {
	var lsShortcuts = ls._add,
		i = 0,
		config,
		arrOptionsName,
		name;
	while (name = keys[i++]) {
		config = lsShortcuts[name];
		if (arrOptions.indexOf(config) === -1) {
			arrOptionsName = arrOptions.concat(config);
			if (!target[name]) {
				target[name] = lsCombo(arrOptionsName);
			}
			_addRecursive(target[name], keys, arrOptionsName);
		}
	}
}

ls._add = function(key, options) {
	var lsShortcuts = ls._add,
		arr,
		name,
		i = 0;
	if (isObject(key)) {
		arr = Object.keys(key);
		while (name = arr[i++]) {
			ls._add(name, key[name])
		}
	} else if (ls[key]) {
		ls.o.log(sprintf("Property %s already exists", key));
	} else {
		lsShortcuts[key] = options;
		_addRecursive(ls, Object.keys(lsShortcuts), []);
	}
};

ls._add({
	"find": { r: 0, show: 'name', sort: 'name', value: { function: NONE, object: NONE, array: NONE } },
	"a":	{ filter: { isPrivate: undefined } },
	"doc":	{ show: ['className', 'kind', 'name', 'type', 'value'], sort: ['className', '-kind', 'name'] },
	"rgrep":{ r: 0, filter: { lsLeaf: true }, value: { function: LARGE, indent: '', maxWidth: 0 } },
	"jsonPath": { nameSep: '/', namePrefix: '/' }
});

/* cache navigation */

function _searchLines(lines, searchArg, index, increment) {
	var max = lines.length - 1;
	for (; 0 <= index && index < max; index += increment) {
		if (lines[index].indexOf(searchArg) !== -1) {
			return index;
		}
	}
	return -1;
}

function bufferNavigate(moveTo, absolute) {
	var arr,
		options = createOptions(ls.o, arguments, 2),
		index,
		bufferLength,
		numRows = 38 - 1,
		numRowsTop = ~~(numRows/2),
		line,
		status = '',
		rangeStart,
		rangeEnd;
	if (!buffer) {
		arr = ['No buffer present to browse'];
	} else {
		bufferLength = buffer.length;
		switch (typeOf(moveTo)) {
			case "String":
			case "RegExp":
				index = absolute ? 0 : bufferIndex + 1;
				index = _searchLines(buffer, moveTo, index, 1);
				if (index !== -1) {
					bufferIndex = index;
					status = "Found " + moveTo + " at " + index;
				} else {
					status = "Did not find " + moveTo;
				}
				break;
			default:
				moveTo = 10;
			// Fallthrough
			case "Number":
				if (absolute) {
					bufferIndex = moveTo;
				} else {
					bufferIndex += moveTo;
				}
				if (bufferIndex < 0) {
					bufferIndex = 0;
				} else if (bufferIndex >= bufferLength) {
					bufferIndex = bufferLength - 1;
				}
				status = "Moved to " + bufferIndex;
				break;
		}
		rangeStart = Math.max(0, Math.min(bufferIndex - numRowsTop, bufferLength - numRows));
		rangeEnd = Math.min(rangeStart + numRows, bufferLength);
		arr = buffer.slice(rangeStart, rangeEnd);
		if (line = arr[bufferIndex - rangeStart]) {
			arr[bufferIndex - rangeStart] = line.replace(/  /g, ' *') + ' * * *';
		}
		arr.push('[From ' + rangeStart + " to " + rangeEnd + " of " + bufferLength + '] ' + status);
	}
	printLines(arr, options);
}

ls.b = bufferNavigate;

/* ...and export! */

module.exports = ls;
