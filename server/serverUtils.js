/**
 * Copyright (c) 2019 Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
/* global module, process */
/* jshint esversion: 6 */

/**
 * Utilities for Local Server
 */

var fs = require('fs'),
	path = require('path');

var projectDir = path.join(__dirname, '../');


/**
 * Utility check if a string ends with 
 */
module.exports.endsWith = (str, end) => {
	return str.lastIndexOf(end) === str.length - end.length;
};

/**
 * Utility replace all occurrences of a string
 */
module.exports.replaceAll = (str, search, replacement) => {
	var re = new RegExp(search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
	return str.replace(re, replacement || '');
};

module.exports.fixHeaders = (origResponse, response) => {
	_fixHeaders(origResponse, response);
};
var _fixHeaders = function (origResponse, response) {
	var headers = origResponse.rawHeaders, // array [name1, value1, name2, value2, ...]
		i = 0,
		headerNames = [],
		headerName;

	for (i = 0; i < headers.length; i = i + 2) {
		headerName = headers[i];
		// collect header name
		headerNames.push(headerName);

		// regarding capitalization, we're only taking care of SCS 'ETag-something' headers
		if (headerName.indexOf('ETag-') === 0) {
			// remove the corresponding lower case header from the proxied response object
			// (it otherwise takes precedence when piped to the actual response)
			delete origResponse.headers[headerName.toLowerCase()];
			// set the capitalized header name in the new response object
			response.setHeader(headerName, headers[i + 1]);
		}
	}

	// explicitly declare headers for cross-domain requests
	response.setHeader('Access-Control-Expose-Headers', headerNames.join(','));
};

module.exports.getURLParameters = function (queryString) {
	var params = {};

	if (!queryString || queryString.indexOf('=') < 0) {
		console.log(' queryString ' + queryString + ' is empty or not valid');
		return params;
	}
	var parts = queryString.split('&');
	for (var i = 0; i < parts.length; i++) {
		var nameval = parts[i].split('='),
			name = nameval[0],
			val = nameval[1] || '';
		params[name] = decodeURIComponent(val);
	}
	// console.log(params);
	return params;
};

/**
 * Get all content types (from seeded data)
 */
module.exports.getContentTypes = function () {
	return _getContentTypes();
};
var _getContentTypes = function () {
	var types = [];

	var typespath = path.join(projectDir, 'data', 'assets', 'ContentTypes');
	if (fs.existsSync(typespath)) {
		var typefiles = fs.readdirSync(typespath);
		for (var j = 0; j < typefiles.length; j++) {
			var typejson = JSON.parse(fs.readFileSync(path.join(typespath, typefiles[j])));
			types.push(typejson);
		}
	}

	// console.log(' - getContentTypes: total content types: ' + types.length);
	return types;
};