"use strict";
var sprintf = require('tiny-sprintf/dist/sprintf.bare.min'),
	regFnArgs = /^function\s*\((.*)\)\s*\{/,
	regFnArgSep = /\s*,\s*/,
	regFnIsClass = /^[A-Z]/,
	msgDisplaySubset = "\nDisplayed [%s..%s] of %s results",
	columns = ['index','name','value','type','kind','isPrivate','className','isCircular'];

var util = {

	mergeShallow: function(target, source) {
		var keys = Object.keys(source),
			i = -1;
		while (++i < keys.length) {
			target[keys[i]] = source[keys[i]];
		}
		return target;
	},

	intersection: function(arr1, arr2) {
		var i=-1, returnArr = [];
		while (++i < arr1.length) {
			if (arr2.indexOf(arr1[i]) !== -1) {
				returnArr.push(arr1[i]);
			}
		}
		return returnArr;
	},

	isObject: require('lodash.isobject'),

	isArray: require('lodash.isarray'),

	isPlainObject: require('lodash.isplainobject')
};


function getDescription(target, namePrefix, depth, descr, blackList) {
	typeof depth === "number" || (depth = 1);
	namePrefix || (namePrefix = '');
	descr || (descr = []);
	blackList || (blackList = []);
	var owner,
		ownerDepth,
		ownerCtorName,
		kind,
		value,
		isCircular,
		parent = descr[descr.length - 1],
		previousBlackListLength = blackList.length;
	if (!util.isObject(target)) {
		return descr;
	}
	blackList.push(target);
	for (var name in target) {
		owner = target;
		ownerDepth = 0;
		while (!owner.hasOwnProperty(name)) {
			owner = Object.getPrototypeOf(owner);
			ownerDepth++;
		}
		ownerCtorName = owner && owner.constructor && owner.constructor.name || '(anonymous)';
		value = target[name];
		switch (typeof value) {
			case "function":
				if (regFnIsClass.test(name)) {
					kind = "class";
				} else {
					kind = "method";
				}
				break;
			default:
				kind = "property";
		}
		isCircular = blackList.indexOf(value) !== -1;
		descr.push({
			index: descr.length,
			isPrivate: (parent && parent.isPrivate) || (name[0] === "_"),
			kind: kind,
			type: typeOf(value),
			isCircular: isCircular,
			name: namePrefix + name,
			_value: value,
			value: '',
			owner: owner,
			ownerDepth: ownerDepth,
			className: ownerCtorName
		});
		if (depth !== 1 && !isCircular) {
			getDescription(value, namePrefix + name + ls.nameSep, depth - 1, descr, blackList);
		}
	}
	// Truncate elements added in the list during this loop
	blackList.length = previousBlackListLength;
	return descr;
}

function typeOf(value) {
	return (Object.prototype.toString.call(value).match(/(\w+)\]/)[1]) || '';
}

function getFnArgs(fn) {
	var fnMatch = (fn + '').match(regFnArgs);
	if (!fnMatch) {
		return '';
	}
	return fnMatch[1].split(regFnArgSep);
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
	if (el.isPrivate && !options.showPrivate) {
		return false;
	}

	for (var name in options.filter) {
		if ((el[name]+'').search(options.filter[name]) === -1) {
			return false;
		}
	}

	// filter that changes its input?
	// Oh yeah.
	if (el.isCircular) {
		displayValue = '[Circular]';
	} else {
		displayValue = getDisplayValue(el._value) + '';
	}

	// Overwrites...
	el.value = displayValue;
	return true;
}

function getColumnWidths(keys, columnWidths, el) {
	var i = 0, key, len;
	while (key = keys[i++]){
		len = (el[key] + '').length;
		if (columnWidths[key] < len) {
			columnWidths[key] = len;
		}
	}
}

function printLine(el) {
	var options = this,
		force = options.force,
		maxWidth = +ls.maxWidth,
		maxWidthChar,
		args = columns.map(function(key) { return el[key] }),
		line;
	args.unshift(options.show);
	line = sprintf.apply(null, args); 
	if (maxWidth && line.length > Math.abs(maxWidth)) {
		maxWidthChar = '' + ls.maxWidthChar;
		line = maxWidth > 0 ? line.substr(0, maxWidth - maxWidthChar.length) + maxWidthChar: maxWidthChar + line.substr(maxWidth + maxWidthChar.length);
	}
	if (!force && options.grep && line.search(options.grep) === -1) {
		return;
	}
	console.log(line);

}

function arrToStr(arr, recurse, fn) {
	var str = '';
	if (recurse > 0) {
		arr.forEach(function(val, index) {
			str += fn(val, index);
		});
		str = str.substr(0,Math.max(1, str.length - 1));
		if (str.length > 1) {
			str+=" ";
		}
	} else {
		str += "...";
	}
	if (str.length > 50) {
		str = str.substr(0, 50 - 5) + '...';
	}
	return str;
}

function getDisplayValue(value, recurse) {
	var str;
	if (typeof recurse === "undefined") {
		recurse = 1;
	}
	switch (typeof value) {
		case "function":
			return 'function(' + getFnArgs(value) + ')';
		case "string":
			return '"' + value + '"';
		case "object":
			// Showing array contents
			if (util.isArray(value)) {
				str = '[';
				str += arrToStr(value, recurse, function(val) {
					return sprintf(" %s,", getDisplayValue(val, recurse-1));
				});
				return str+ "]";
			}
			// Showing object contents
			if (util.isPlainObject(value)) {
				str = "{";
				str += arrToStr(Object.keys(value), recurse, function(key) {
					return sprintf(" %s: %s,", key, getDisplayValue(value[key], recurse-1));
				});
				return str+ "}";
			}
			return value;
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
	return arr.join(ls.columnSep);
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
 * @prop {Boolean} 					[showPrivate=false] - whether or not to display properties starting with a "_"
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
		defaultOptions = ls.defaultOptions,
		options = util.mergeShallow({}, defaultOptions),
		i = 0,
		max = arguments.length,
		arg,
		columnsDef,
		columnWidths = {},
		maxRows = ls.maxRows;
	// Merge arguments into options
	while (++i < max) {
		arg = arguments[i];
		if (!util.isPlainObject(arg)) {
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
		util.mergeShallow(options, arg);
	}
	// Interpret options
	if (!util.isPlainObject(options.filter)) {
		options.filter = { name: options.filter };
	}
	if (!util.isArray(options.sort)) {
		options.sort = [options.sort];
	}
	if (options.show === "all") {
		options.show = columns.slice();
	} else {
		if (!util.isArray(options.show)) {
			options.show = [options.show];
		}
		options.show = util.intersection(options.show, columns);
	}

	if (typeof options.r !== "number" && options.r) {
		options.r = 0;
	}

	// Sort all required descriptions
	descr = getDescription(target, ls.namePrefix, options.r, []);
	descr = descr.filter(filterDescription.bind(options));
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
	if (!ls.quiet) {
		fnPrintLine(columnsDef.label);
		fnPrintLine(columnsDef.sep);
	}
	delete options.force;
	rowsToPrint.forEach(fnPrintLine);

	// If subset, end message
	if (!ls.quiet && (rowStart || rowEnd)) {
		console.log(sprintf(msgDisplaySubset, rowStart, rowEnd - 1, descr.length));
	}


}

/**
 * Prefix used for name paths
 * @type {String}
 * @memberof module:console-ls
 */
ls.namePrefix = '';

/**
 * Separator used for name paths
 * @type {String}
 * @memberof module:console-ls
 */
ls.nameSep = '.';

/**
 * Separator between columns
 * @type {string}
 */
ls.columnSep = '|';

/**
 * Set maximum output width in number of characters.
 * @type {number}
 */
ls.maxWidth = 0;

/**
 * Set maximum number of output rows.
 * @type {number}
 */
ls.maxRows = 0;

/**
 * This character sequence is used at the place where an output line was cut off.
 * @type {string}
 * @see module:console-ls#maxWidth
 */
ls.maxWidthChar = '..';

/**
 * If true, only the result is printed (no headers etc).
 * @type {boolean}
 */
ls.quiet = false;

ls.defaultOptions = {
	show: ["kind", "name", "value"],
	sort: ['-kind', 'name'],
	filter: {},
	showPrivate: false,
	r: 1,
	grep: '' 
};
function lsShortcut(target, options, args, from) {
	ls.apply(ls, [target, options].concat(Array.prototype.slice.call(args, from || 0)));
}

ls.find = function(target) {
	lsShortcut(target, { r: 0, show: 'name', sort: 'name' }, arguments, 1);
};

ls.a = function(target) {
	lsShortcut(target, { showPrivate: true }, arguments, 1);
};

module.exports = ls;
