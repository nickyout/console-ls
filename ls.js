"use strict";

/////////////////////////////////////// common utils ///////////////////////////////////////

var doc,
	enc = encodeURIComponent,
	browserOpt = {},
	Obj = Object,
	sprintf = require('tiny-sprintf/dist/sprintf.bare.min'),
	isObject = require('lodash.isobject'),
	isArray = require('lodash.isarray'),
	isNumber = function(val) { return !isNaN(val) && typeof val === "number" },
	isPlainObject = function(value) { return value && typeOf(value) === "Object"; },
	isCollection = function(val) { return isArray(val) || isPlainObject(val); },
	typeOf = function(value) { return (Obj.prototype.toString.call(value).match(/(\w+)\]/)[1]) || ''; },
	ObjKeys = Obj.keys.bind(Obj),
	has = function(target, name) {
		return target.hasOwnProperty(name);
	},
	inArray = function(arr, val) {
		return arr.indexOf(val) !== -1;
	},
	merge = function(target, source) {
		var keys = ObjKeys(source),
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
			if (inArray(arr2, arr1[i])) {
				returnArr.push(arr1[i]);
			}
		}
		return returnArr;
	},
	diff = function(example, derivative) {
		var obj = null,
			keys = ObjKeys(example),
			i = 0,
			val,
			name;
		while (name = keys[i++]) {
			if (isPlainObject(example[name]) && (val = diff(example[name], derivative[name]))) {
				obj[name] = val;
			} else {
				val = derivative[name];
				if (val + '' != example[name] + '') {
					obj || (obj = {});
					obj[name] = val;
				}
			}
		}
		return obj;
	};

/////////////////////////////////////// core ls vars ///////////////////////////////////////

var regFnArgs = /(\([^)]*\))/,
	regNewline = /\s*\n\s*/gm,
	msgNoBuffer = 'No buffer present to browse',
	msgNav = '[From %s to %s of %s] ',
	msgFound = "Found %s at %s",
	msgNotFound = "Did not find %s",
	msgMoved = "Moved to %s",
	msgOverflow = " * Iteration limit %s reached. The rest was omitted.",
	msgExists = "Property %s already exists",
	allColumns = ['name','value','type','kind','isPrivate','className','isCircular', 'lsLeaf'],
	buffer = null,
	bufferIndex = 0,
	includeTargetObj = {},
	recycledEntries = [],
	LARGE = 'large',
	MEDIUM = 'medium',
	SMALL = 'small',
	NONE = 'none';

/////////////////////////////////////// core ls utils ///////////////////////////////////////

function _createEntry(name, value, type, kind, isPrivate, isCircular, owner, ownerDepth, ownerCtorName) {
	var val = recycledEntries.length > 0 ? recycledEntries.pop() : {};
	val.name = name;
	val._value = value;
	val.value = '';
	val.type = type;
	val.kind = kind;
	val.isPrivate = isPrivate;
	val.isCircular = isCircular;
	val.lsLeaf = false;
	val.owner = owner;
	val.ownerDepth = ownerDepth;
	val.className = ownerCtorName;
	return val;
}

function _recycleEntry(el) {
	if (recycledEntries.length < 1000) {
		el.value = el._value = el.owner = null;
		// the rest should be ok
		recycledEntries.push(el);
	}
}

/**
 *
 * @param {*} target
 * @param {Object} options
 * @param {String} namePrefix
 * @param {Number} depth
 * @param {Array} descr
 * @param {Array} blackList
 * @param {?*} parent
 * @returns {*}
 */
function getPropertyDescriptions(target, options, namePrefix, depth, descr, blackList, parent) {
	var entry,
		owner,
		ownerDepth,
		ownerCtorName,
		kind,
		value,
		isCircular,
		isPrivate,
		previousBlackListLength = blackList.length,
		previousDescrLength,
		limit = options.iterationLimit;

	if (!isObject(target)) {
		return descr;
	}
	blackList.push(target);
	for (var name in target) {
		if (limit && limit <= options._it) {
			break;
		} else {
			options._it++;
		}

		value = target[name];
		isPrivate = options.definePrivate(value, name, target);
		if (!filterByValue.call(options, "isPrivate", isPrivate)) {
			continue;
		}
		owner = target;
		ownerDepth = 0;
		while (!has(owner, name)) {
			owner = Obj.getPrototypeOf(owner);
			ownerDepth++;
		}
		ownerCtorName = owner && owner.constructor && owner.constructor.name || '(anonymous)';
		kind = options.defineKind(value, name, target);
		isCircular = inArray(blackList, value);
		previousDescrLength = descr.length;
		entry = _createEntry(
			namePrefix + name,
			value,
			typeOf(value),
			kind,
			(parent && parent.isPrivate) || isPrivate,
			isCircular,
			owner,
			ownerDepth,
			ownerCtorName
		);
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

		// Prevent unnecessary value making
		if (!filterByValue.call(options, "lsLeaf", entry.lsLeaf)) {
			_recycleEntry(entry);
			continue;
		}

		// Okay, make the string
		entry.value = isCircular ? "[Circular]" : stringify(value, options) + '';

		// Option to leave out recursed entirely
		if (filterDescription.call(options, entry)) {
			descr.push(entry);
		} else {
			_recycleEntry(entry);
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

function filterByValue(type, value) {
	var options = this,
		filter = options.filter;

	return !(filter[type] !== undefined && (value+'').search(filter[type]) === -1)
}


function filterDescription(el){
	var options = this,
		filter = options.filter;

	for (var name in filter) {
		if (has(el, name) && filter[name] !== undefined && (el[name]+'').search(filter[name]) === -1) {
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
 * @param {String|Array} lines
 * @param {Object} options
 */
function printLines(lines, options) {
	if (!isArray(lines)) {
		lines = [lines];
	}
	var i = -1,
		max = lines.length,
		fnLog = options.fnLog,
		fnClear = options.fnClear,
		clear = options.clear,
		maxWidth = options.maxWidth,
		chopChar = options.chopChar,
		printStr = '';
	while (++i < max) {
		printStr += (printStr && '\n') + _chop(lines[i], maxWidth, chopChar);
	}
	if (clear) {
		fnClear && fnClear();
	}
	fnLog(printStr);

}

/**
 * Converts a propertyDescription into a string or array of strings and adds them to argument `lines`.
 * @param {Array} allLines
 * @param {String} sprintfString
 * @param {?Function} fnGrep
 * @param {Object} propertyDescription
 * @this {Object} options
 */
function descriptionToLines(allLines, sprintfString, fnGrep, propertyDescription) {
	var options = this,
		args = [sprintfString],
		force = options.force,
		lines,
		i = 0,
		key;

	// Append each value of column to it
	while (key = allColumns[i++]) {
		args.push(propertyDescription[key]);
	}
	lines = sprintf.apply(null, args).split('\n');
	if (!force && fnGrep) {
		lines = lines.filter(fnGrep);
	}
	allLines.push.apply(allLines, lines);
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
		iter = isArr ? value : ObjKeys(value),
		isNonEmpty = iter.length > 0,
		i = -1,
		iterValue,
		valueFormat = options.value,
		maxWidth = valueFormat.maxWidth,
		chopChar = options.chopChar,
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
			if (str !== (str = _chop(str, maxWidth && (maxWidth - 2), chopChar))) {
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
			str += chopChar;
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
 * @param {String} [chopChar=''] - the string placed where the chopping occurred.
 * @return {String} the resulting string
 */
function _chop(str, maxWidth, chopChar) {
	chopChar || (chopChar = '');
	if (maxWidth && str.length > Math.abs(maxWidth)) {
		if (maxWidth < 0) {
			return chopChar + str.substr(maxWidth + chopChar.length)
		} else {
			return str.substr(0, maxWidth - chopChar.length) + chopChar;
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
		chopChar = options.chopChar;
	switch (valueFormat.function) {
		case LARGE:
			str += value;
			if (!indent) {
				str = str.replace(regNewline, ' ');
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
	return _chop(str, maxWidth, chopChar);
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
		defaultFormat = valueFormat.default,
		maxWidth = valueFormat.maxWidth,
		chopChar = options.chopChar;
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
				if (inArray(blackList, value)) {
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
	str = _chop(str, maxWidth, chopChar);
	// Unless default format is large, remove newlines
	if (defaultFormat !== LARGE) {
		str = str.replace(regNewline, ' ');
	}
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
		if (has(arg, 'filter') && !isPlainObject(arg.filter)) {
			arg.filter = { name: arg.filter };
		}
		if (has(arg, 'buffer') && !isPlainObject(arg.buffer)) {
			arg.buffer = { enabled: arg.buffer };
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

	// Iteration counter. No judge.
	options._it = 0;
	return options;
}

/////////////////////////////////////// main function ///////////////////////////////////////

/**
 * Description given for each property found.
 * @typedef {Object} module:console-ls~PropertyDefinition
 * @prop {String} name - the property name on the instance
 * @prop {String} value - the string representation of the property value
 * @prop {*} _value - the actual value
 * @prop {String} type - the type of the property value (Object.prototype.toString).
 * @prop {String} kind - the interpreted kind of value, as defined by <code>options.defineKind</code>.
 * Can be "class", "method" or "property".
 * @prop {Boolean} isPrivate - whether or not the property is considered private/protected,
 * as defined by <code>options.defineKind</code>.
 * @prop {Boolean} isCircular - whether or not its value is also equal one of its parents.
 * @prop {*} owner - the actual owner of the property. Can be the target itself, or any instance it its prototype chain.
 * @prop {Number} ownerDepth - the depth in the prototype chain at which the owner was found
 * @prop {String} className - the constructor name of the owner, or "(anonymous)" if not found.
 * @prop {Boolean} lsLeaf - Objects and Arrays which are iterated over get <code>lsLeaf == false </code>. All others
 * get <code>true</code>. This is used to filter on to prevent redundant display of objects/arrays as values.
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
 * List the contents of any object, array, regexp, function, or derivative.
 * Prints output to <code>options.fnLog</code>.
 * @param {Object|Array|RegExp|Function} target - the target to list the contents of
 * @param {...module:console-ls~Options|String|RegExp|Number} [options] - several option specifications are merged into one.
 * If string or regexp, the value is used as used as options.grep.
 * If number, the value is used as options.r.
 * @module {Function} console-ls
 */
function ls(target) {
	var descriptions,
		chopAt,
		fnDescriptionToLine,
		fnGrep,
		options = createOptions(ls.opt, arguments),
		columnDescriptions,
		columnWidths = {},
		cols = options.show,
		maxHeight = options.maxHeight,
		bufferEnabled = options.buffer.enabled,
		allLines = [],
		sprintfString,
		lines,
		chopMsg,
		limit = options.iterationLimit,
		limitReached = false,
		includeTarget = options.includeTarget,
		includeTargetName = options.includeTargetName + '',
		quiet = options.quiet,
		grep = options.grep,
		optValue = options.value,
		i,
		el;


	// Normalize value settings
	optValue.default || (optValue.default = MEDIUM);
	optValue.function || (optValue.function = optValue.default);
	optValue.object || (optValue.object = optValue.default);
	optValue.array || (optValue.array = optValue.default);

	// To include self
	if (includeTarget) {
		includeTargetObj[includeTargetName] = target;
		target = includeTargetObj;
	}
	// Sort all required descriptions
	descriptions = getPropertyDescriptions( target, options, options.namePrefix || '', options.r, [], [], null);
	descriptions.sort(sortDescriptions.bind(null, options.sort));

	if (limit && limit <= options._it) {
		limitReached = true;
	}
	// Create properly sized print method
	i = 0;
	while (el = cols[i++]) {
		columnWidths[el] = el.length;
	}
	i = 0;
	while (el = descriptions[i++]) {
		getColumnWidths(cols, columnWidths, el);
	}
	columnDescriptions = createColumnDescriptions(cols, columnWidths);
	sprintfString = createSprintfString.call(options, columnDescriptions);
	fnGrep = grep ? function(line) { return line.search(grep) !== -1 } : null;
	fnDescriptionToLine = descriptionToLines.bind(options, allLines, sprintfString, fnGrep);

	// Collect lines
	// Headers force hack, omit grep :^)
	if (!quiet) {
		options.force = true;
		fnDescriptionToLine(columnDescriptions.label);
		fnDescriptionToLine(columnDescriptions.sep);
	}
	delete options.force;
	i = 0;
	while (el = descriptions[i++]) {
		fnDescriptionToLine(el);

		// w/o bufferEnabled, check for fast chop
		if (!bufferEnabled && maxHeight && allLines.length > maxHeight) {
			chopAt = allLines.length = maxHeight;
			break;
		}
	}

	// Clear immediately
	descriptions.length = 0;

	if (!quiet && limitReached) {
		allLines.push(sprintf(msgOverflow, limit));
	}

	// w/ bufferEnabled, check for chop
	if (bufferEnabled && maxHeight && maxHeight < allLines.length) {
		chopAt = maxHeight;
	}

	// If subset, add end message
	if (!quiet && chopAt) {
		// Last row is status message
		chopMsg = sprintf(msgNav, 0, chopAt - 2, allLines.length);
	}

	// Print lines
	if (chopAt) {
		lines = bufferEnabled ? allLines.slice(0, chopAt) : allLines;
		if (!quiet) {
			lines[chopAt - 1] = chopMsg;
		}
	} else {
		lines = allLines;
	}
	printLines(lines, options);

	if (bufferEnabled) {
		// Either store lines into buffer
		buffer = allLines;
		bufferIndex = 0;
	} else {
		// Or clear lines
		allLines.length = 0;
	}

	if (options.includeTarget) {
		delete includeTargetObj[includeTargetName];
	}
}

/////////////////////////////////////// all settings ///////////////////////////////////////

ls.setOpt = function(opt) {
	var c = console, args = arguments, defaultOptions = {
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
		chopChar: '..',
		/**
		 * Set maximum number of output rows.
		 * @type {Number}
		 */
		maxHeight: 1000,
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
			/**
			 * Fallback display style. "large", "medium", "small" or "none"
			 * @type {String}
			 */
			default: MEDIUM,
			/**
			 * Display style for functions. If undefined, fallback to default
			 * @type {String}
			 */
			function: undefined,
			/**
			 * Display style for Objects. If undefined, fallback to default
			 * @type {String}
			 */
			object: undefined,
			/**
			 * Display style for Arrays. If undefined, fallback to default
			 * @type {String}
			 */
			array: undefined,
			/**
			 * Indenting for display style "large". No indenting implies all on a single line.
			 * @type {String}
			 */
			indent: '  ',
			/**
			 * Maximum width of a value, regardless of its display style. Excess gets chopped and added
			 * chopChar at the place of chopping.
			 * @type {Number}
			 */
			maxWidth: 40,
			/**
			 * Recursion limit for displaying objects and arrays using display style "medium".
			 * @type {Number}
			 */
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
		fnLog: c && c.log && c.log.bind(c),
		/**
		 * Clear function. In case you want your console cleared before logging.
		 */
		fnClear: c && c.clear && c.clear.bind(c),
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
		},
		/**
		 * Whether or not to clear before logging
		 * @type {Boolean}
		 */
		clear: false,

		/**
		 * Maximum number of properties to iterate over.
		 * 0 to enforce no limit
		 * @type {Number}
		 */
		iterationLimit: 100000,

		/**
		 * Whether or not to include the target as part of the listing
		 * @type {Boolean}
		 */
		includeTarget: false,

		/**
		 * What label to use when the target gets included
		 * @type {String}
		 */
		includeTargetName: '[target]',

		buffer: {
			/**
			 * If true, the last result is stored in a buffer which can be viewed using ls.q
			 * @type {Boolean}
			 */
			enabled: true,
			/**
			 * Maximum number of characters on a line, for buffer view only
			 * @type {Number}
			 */
			maxWidth: 133,
			/**
			 * Maximum rows printed at once, for buffer view only
			 * @type {Number}
			 */
			maxHeight: 38,
			/**
			 * Wrap search and navigation during buffer navigation (ls.q)
			 * @type {Boolean}
			 */
			wrap: true,
			/**
			 * Clear console before each log, if possible
			 * @type {Boolean}
			 */
			clear: true
		}
	};
	defaultOptions = merge(defaultOptions, browserOpt);
	ls.opt = args.length > 0 ? createOptions(defaultOptions, args, 0) : defaultOptions;
	return ls;
};

/////////////////////////////////////// shortcuts ///////////////////////////////////////

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
	var lsShortcuts = ls.addShortcut,
		i = 0,
		config,
		arrOptionsName,
		name;
	while (name = keys[i++]) {
		config = lsShortcuts[name];
		if (!inArray(arrOptions, config)) {
			arrOptionsName = arrOptions.concat(config);
			if (!target[name]) {
				target[name] = lsCombo(arrOptionsName);
			}
			_addRecursive(target[name], keys, arrOptionsName);
		}
	}
}

ls.addShortcut = function(key, options) {
	var lsShortcuts = ls.addShortcut,
		arr,
		name,
		i = 0;
	if (isObject(key)) {
		arr = ObjKeys(key);
		while (name = arr[i++]) {
			ls.addShortcut(name, key[name])
		}
	} else if (ls[key]) {
		printLines(sprintf(msgExists, key), ls.opt);
	} else {
		lsShortcuts[key] = options;
		_addRecursive(ls, ObjKeys(lsShortcuts), []);
	}
};

ls.addShortcut({
	"find": {
		r: 0,
		show: 'name',
		sort: 'name',
		value: { function: NONE, object: NONE, array: NONE }
	},
	"a":	{
		filter: { isPrivate: undefined }
	},
	"doc":	{
		show: ['className', 'kind', 'name', 'type', 'value'],
		sort: ['className', '-kind', 'name']
	},
	"rgrep":{
		r: 0,
		show: ['name', 'value'],
		filter: { lsLeaf: true },
		value: { function: LARGE, indent: '', maxWidth: 0 }
	},
	"cat": {
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
		quiet: true,
		includeTarget: true
	}
});

/////////////////////////////////////// buffer navigation ///////////////////////////////////////

function _searchLines(lines, searchArg, index, increment, doWrap) {
	var max = lines.length,
		i = index;
	while (1) {
		if (i < 0) {
			if (doWrap) {
				i += lines.length;
			} else {
				break;
			}
		} else if (i >= max) {
			if (doWrap) {
				i -= lines.length;
			} else {
				break;
			}
		}
		if (doWrap && i === index - increment) {
			// all round
			break;
		}

		if (inArray(lines[i], searchArg)) {
			return i;
		}
		i += increment;
	}
	return -1;
}

function bufferNavigate(action, fromRow) {
	var arr,
		options = createOptions(ls.opt, arguments, 2),
		bufOpts = options.buffer,
		defaultStep = bufOpts.step || 0,
		numRows = (isNumber(bufOpts.maxHeight) ? bufOpts.maxHeight : options.maxHeight) - 1,
		numRowsTop = ~~(numRows/2),
		isAbsolute = isNumber(fromRow),
		doWrap = bufOpts.wrap,
		currentIndex,
		searchIndex,
		bufferLength,
		status = '',
		rangeStart,
		rangeEnd;

	if (!buffer) {
		arr = [msgNoBuffer];
	} else {
		bufferLength = buffer.length;
		if (isAbsolute) {
			currentIndex = fromRow < 0 ? bufferLength + fromRow : fromRow;
		} else {
			currentIndex = bufferIndex;
		}
		switch (typeOf(action)) {
			case "String":
			case "RegExp":
				searchIndex = !isAbsolute && (bufferIndex === currentIndex) ? currentIndex + 1 : currentIndex;
				searchIndex = _searchLines(buffer, action, searchIndex, 1, doWrap);
				if (searchIndex !== -1) {
					// Found it
					currentIndex = searchIndex;
					status = sprintf(msgFound, action, searchIndex);
				} else {
					status = sprintf(msgNotFound, action);
				}
				break;
			// Anything non-parseable becomes a move with default step
			default:
				action = defaultStep;
			// Fallthrough
			case "Number":
				currentIndex += action;
				if (currentIndex < 0) {
					if (doWrap) {
						currentIndex += bufferLength;
					} else {
						currentIndex = 0;
					}
				} else if (currentIndex >= bufferLength) {
					if (doWrap) {
						currentIndex -= bufferLength;
					} else {
						currentIndex = bufferLength - 1;
					}
				}
				status = sprintf(msgMoved, currentIndex);
				break;
		}

		// Range select
		rangeStart = Math.max(0, Math.min(currentIndex - numRowsTop, bufferLength - numRows));
		rangeEnd = Math.min(rangeStart + numRows, bufferLength);
		arr = buffer.slice(rangeStart, rangeEnd);

		// Marker
		if (arr[currentIndex - rangeStart]) {
			arr[currentIndex - rangeStart] = arr[currentIndex - rangeStart].replace(/  /g, ' *') + ' * * *';
		}

		// Status text
		arr.push(sprintf(msgNav, rangeStart, rangeEnd -1, bufferLength) + status);

		// Save current index
		bufferIndex = currentIndex;
	}
	// printLines must chop off this
	if (isNumber(bufOpts.maxWidth)) {
		options.maxWidth = bufOpts.maxWidth;
	}
	if (bufOpts.clear !== undefined) {
		options.clear = bufOpts.clear;
	}
	printLines(arr, options);
}

ls.q = bufferNavigate;

/////////////////////////////////////// handy loads ///////////////////////////////////////

/**
 * Logs an url that, if loaded, will load in the options set in opt
 * @param {String} hostURL - the url to this script
 */
function toURL(hostURL) {
	hostURL || (hostURL = '');
	var currentOpt = ls.opt,
		currentBrowserOpt = browserOpt,
		defaultOpt = (browserOpt = {}) && ls.setOpt().opt,
		optDiff = diff(defaultOpt, currentOpt),
		argStr;

	// Revert.
	ls.opt = currentOpt;
	browserOpt = currentBrowserOpt;

	if (optDiff) {
		argStr = "?" + enc(stringify(optDiff, {
			value: {
				default: "large",
				object: "large",
				array: "large",
				function: "large"
			}
		}));
	} else {
		argStr = "";
	}
	return hostURL + argStr;
}

ls.toURL = function(hostURL) {
	ls.opt.fnLog(toURL(hostURL));
};

/**
 * Function that gets stringified. [url] gets swapped with the actual url.
 * Only use onload, ls is not IE8-compliant anyway, and:
 * https://pie.gd/test/script-link-events/
 */
var fnBookmarklet = function(){var d=document,s=d.createElement("script");s.onload=function(){ls.opt.fnLog("Loaded console-ls")};s.src="[url]";d.body.appendChild(s)};

/**
 * Double encode seems to work
 * @param {String} hostURL - the url to the script
 * @returns {String}
 */
ls.toBookmarklet = function(hostURL) {
	ls.opt.fnLog('javascript:(' + enc( fnBookmarklet.toString().replace('[url]', toURL(hostURL)) ) + ')()');
};

// In case of browser start, check for args in own script src
if (doc = global.document) {
	var script = doc.getElementsByTagName("script"),
		url = script.length > 0 && script[script.length - 1].src,
		opt = url && url.split('?')[1];
	if (opt) {
		browserOpt = eval("(" + decodeURIComponent(opt) + ")");
	}
}
	 
// Set default opt (including optional browserOpt)
ls.setOpt();

/////////////////////////////////////// export ///////////////////////////////////////

module.exports = ls;
