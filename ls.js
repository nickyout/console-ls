"use strict";
var sprintf = require('tiny-sprintf/dist/sprintf.bare.min'),
	isObject = require('lodash.isobject'),
	isArray = require('lodash.isarray'),
	isPlainObject = function(value) {
		return value && typeOf(value) === "Object";
	},
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
	typeOf = function(value) {
		return (Object.prototype.toString.call(value).match(/(\w+)\]/)[1]) || '';
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

var regFnArgs = /(\([^)]*\))/,
	msgDisplaySubset = "\nDisplayed [%s..%s] of %s results",
	columns = ['index','name','value','type','kind','isPrivate','className','isCircular', 'lsLeaf'],
	lsShortcuts = {};

/* ls utils */

function getPropertyDescriptions(target, options, namePrefix, depth, descr, blackList, parent) {
	namePrefix || (namePrefix = '');
	descr || (descr = []);
	blackList || (blackList = []);
	var lsConfig = ls.c,
		entry,
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
		isPrivate = (name[0] === "_");
		// TODO: Prevent private recursion when unnecessary
		owner = target;
		ownerDepth = 0;
		while (!owner.hasOwnProperty(name)) {
			owner = Object.getPrototypeOf(owner);
			ownerDepth++;
		}
		ownerCtorName = owner && owner.constructor && owner.constructor.name || '(anonymous)';
		value = target[name];
		kind = lsConfig.defineKind(value, name, target);
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
			value: '',
			owner: owner,
			ownerDepth: ownerDepth,
			className: ownerCtorName
		};
		if (depth !== 1 && !isCircular) {
			getPropertyDescriptions(
				value,
				options,
				namePrefix + name + lsConfig.nameSep,
				depth - 1,
				descr,
				blackList,
				entry
			);
		}
		entry.lsLeaf = descr.length == previousDescrLength;
		// Option to leave out recursed entirely
		if (filterDescription.call(options, entry)) {
			descr.push(entry);
		}
	}
	// Truncate elements added in the list during this loop
	blackList.length = previousBlackListLength;
	return descr;
}

function getFnHead(fn) {
	var fnMatch = (fn + '').match(regFnArgs);
	return 'function' + (fnMatch ? fnMatch[1] : '()');
}


function sortBy(props, a,b) {
	var prop, aVal, bVal, len,
		fac, ascend,
		i = 0, returnVal = 0;

	while (prop = props[i++]) {
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
		returnVal += Math.pow(2, props.length - i) * fac;
	}
	return returnVal;
}

function filterDescription(el){
	var options = this,
		displayValue;

	for (var name in options.filter) {
		if ((el[name]+'').search(options.filter[name]) === -1) {
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

function printLine(el) {
	var options = this,
		force = options.force,
		lsConfig = ls.c,
		maxWidth = +lsConfig.maxWidth,
		maxWidthChar,
		args = columns.map(function(key) { return el[key] }),
		line;
	args.unshift(options.show);
	line = sprintf.apply(null, args); 
	if (!force && options.grep && line.search(options.grep) === -1) {
		return;
	}
	if (maxWidth && line.length > Math.abs(maxWidth)) {
		maxWidthChar = '' + lsConfig.maxWidthChar;
		line = maxWidth > 0 ? line.substr(0, maxWidth - maxWidthChar.length) + maxWidthChar: maxWidthChar + line.substr(maxWidth + maxWidthChar.length);
	}
	lsConfig.log(line);
}

/**
 * Converts a collection to a string.
 * @param {Object|Array} value
 * @param {Object} options
 * @param {Number} depth - recursion depth
 * @param {Array} blackList
 * @param {String} prefix
 * @param {Number} maxLength - maximum length of the string.
 */
function stringifyCollection(value, options, depth, blackList, prefix, maxLength) {
	// Either single line, or all indented
	if (prefix) {
		prefix = '\n' + prefix;
	}
	var isArr = isArray(value),
		str = isArr ? '[' : '{',
		iter = isArr ? value : Object.keys(value),
		isNonEmpty = iter.length > 0,
		i = -1, iterValue;
	if (depth !== 0) {

		if (isNonEmpty) {
			str += ' ';
		}
		while (++i < iter.length) {
			str += prefix;
			if (isArr) {
				iterValue = iter[i];
			} else {
				str += iter[i] + ": ";
				iterValue = value[iter[i]];
			}
			str += stringify(iterValue, options, depth-1, blackList, prefix);
			// Cut off asap
			if (maxLength && str.length > maxLength - 2) {
				str = str.substr(0, maxLength - 5) + '...';
				break;
			}
			if (i !== iter.length -1) {
				str += ', ';
			}
		}
		// remove last comma
		if (isNonEmpty) {
			str += " ";
		}
	} else {
		// What lies inside remains a mystery...
		str += "...";
	}
	str += isArr ? ']' : '}';
	return str;
}

function stringify(value, options, depth, blackList, prefix) {
	blackList || (blackList = []);
	prefix || (prefix = '');
	var showFull = options.showFull,
		maxLength = showFull ? 0 : 50,
		indent = showFull && options.showFullIndent || '',
		str;
	switch (typeof value) {
		case "function":
			if (showFull) {
				str = '' + value;
				if (!indent) {
					str = str.replace(/\s*\n\s*/gm, ' ');
				}
			} else {
				str = getFnHead(value);
			}
			return str;
		case "string":
			return '"' + value + '"';
		case "object":
			// Showing contents
			if (isPlainObject(value) || isArray(value)) {
				if (blackList.indexOf(value) !== -1) {
					return "[Circular]";
				}
				blackList.push(value);
				str = stringifyCollection(value, options, depth, blackList, prefix + indent, maxLength);
				blackList.pop();
				return str;
			}
		default:
			return value;
	}
}

function createColumnsDef(arr, columnWidths) {
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
		index = columns.indexOf(key)+1;
		columnDef.sprintf[key] = "%"+index+"$-"+width+"s";
		columnDef.label[key] = key;
		columnDef.sep[key] = sprintf("%'-"+width+"s", '');
	}
	return columnDef;
}

function createDisplayString(columnsToShow, columnDef) {
	var i = -1,
		showCol,
		str,
		arr = columnsToShow.slice();
	while (showCol = arr[++i]) {
		arr[i] = columnDef.sprintf[showCol] || '';
	}
	// Last one does no spacing
	if (str = arr[arr.length - 1]) {
		str = str.replace(/-\d+/, '');
		arr[arr.length-1] = str;
	}
	return arr.join(ls.c.columnSep);
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
	var descr,
		rowsToPrint,
		rowStart,
		rowEnd,
		fnPrintLine,
		lsConfig = ls.c,
		defaultOptions = lsConfig.defaultOptions,
		options = merge({}, defaultOptions),
		i = 0,
		max = arguments.length,
		arg,
		columnsDef,
		columnWidths = {},
		maxRows = lsConfig.maxRows;
	// Merge arguments into options
	while (++i < max) {
		arg = arguments[i];
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
		merge(options, arg);
	}
	// Interpret options
	if (!isPlainObject(options.filter)) {
		options.filter = { name: options.filter };
	}
	if (!isArray(options.sort)) {
		options.sort = [options.sort];
	}
	if (options.show === "all") {
		options.show = columns.slice();
	} else {
		if (!isArray(options.show)) {
			options.show = [options.show];
		}
		options.show = intersection(options.show, columns);
	}

	if (typeof options.r !== "number" && options.r) {
		options.r = 0;
	}

	// Sort all required descriptions
	descr = getPropertyDescriptions(target, options, lsConfig.namePrefix, options.r, []);
	descr.forEach(function(el) {
		if (el.isCircular) {
			el.value = '[Circular]';
		} else {
			el.value = stringify(el._value, options, options.showFull ? -1 : 1) + '';
		}
	});
	//descr = descr.filter(filterDescription.bind(options));
	descr.sort(sortBy.bind(null, options.sort));

	// Update index properties to 'end result' values
	descr.forEach(function(el, index) {
		el.index = index;
	});

	// Truncate excess
	if (maxRows && Math.abs(maxRows) < descr.length) {
		if (maxRows > 0) {
			rowStart = 0;
			rowEnd = maxRows;
		} else {
			rowStart = descr.length + maxRows;
			rowEnd = descr.length;
		}
		rowsToPrint = descr.slice(rowStart, rowEnd);
	} else {
		rowsToPrint = descr;
	}

	// Create properly sized print method
	options.show.forEach(function(key) {
		columnWidths[key] = key.length;
	});
	rowsToPrint.forEach(getColumnWidths.bind(null, options.show, columnWidths));
	columnsDef = createColumnsDef(options.show, columnWidths);
	options.show = createDisplayString(options.show, columnsDef);
	fnPrintLine = printLine.bind(options);

	// Print
	options.force = true;
	if (!lsConfig.quiet) {
		fnPrintLine(columnsDef.label);
		fnPrintLine(columnsDef.sep);
	}
	delete options.force;
	rowsToPrint.forEach(fnPrintLine);

	// If subset, end message
	if (!lsConfig.quiet && (rowStart || rowEnd)) {
		lsConfig.log(sprintf(msgDisplaySubset, rowStart, rowEnd - 1, descr.length));
	}


}

function lsCombo(arrOptions) {
	return function(target) {
		ls.apply(ls, [target].concat(arrOptions).concat(Array.prototype.slice.call(arguments, 1)));
	}
}

function recursiveAdd(target, keys, arrOptions) {
	var i = 0,
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
			recursiveAdd(target[name], keys, arrOptionsName);
		}
	}
}

ls._add = function(key, options) {
	var arr,
		name, 
		i = 0;
	if (isObject(key)) {
		arr = Object.keys(key);
		while (name = arr[i++]) {
			ls._add(name, key[name])
		}
	} else if (ls[key]) {
		ls.c.log(sprintf("Property %s already exists", key));
	} else {
		lsShortcuts[key] = options;
		recursiveAdd(ls, Object.keys(lsShortcuts), []);
	}
};

ls.c = {
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
	 * @type {string}
	 */
	columnSep: '|',
	/**
	 * Set maximum output width in number of characters.
	 * @type {number}
	 */
	maxWidth: 0,
	/**
	 * This character sequence is used at the place where an output line was cut off.
	 * @type {string}
	 * @see module:console-ls#maxWidth
	 */
	maxWidthChar: '..',
	/**
	 * Set maximum number of output rows.
	 * @type {number}
	 */
	maxRows: 0,
	/**
	 * If true, only the result is printed (no headers etc).
	 * @type {boolean}
	 */
	quiet: false,

	/**
	 * The default values of each option.
	 * @type {Object}
	 */
	defaultOptions: {
		show: ["kind", "name", "value"],
		sort: ['-kind', 'name'],
		filter: { isPrivate: false },
		showFull: false,
		showFullIndent: '',
		showRecursed: true,
		r: 1,
		grep: '' 
	},
	/**
	 * Dictates how the value of "kind" gets interpreted
	 * @param {*} value
	 * @param {String} key
	 * @param {Object|Array|Function|*} source
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

	log: console.log.bind(console)
};

ls._add({
	"find": { r: 0, show: 'name', sort: 'name' },
	"a":	{ filter: { isPrivate: /./ } },
	"doc":	{ show: ['className', 'kind', 'name', 'type', 'value'], sort: ['className', '-kind', 'name'] },
	"rgrep":{ r: 0, showFull: true }
});

ls.cat = function(value) {
	ls.c.log(stringify(value, { showFull: true, showFullIndent: '  ' }, -1));
};

module.exports = ls;
