/**
 * Copyright (c) 2019 Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
/* globals app, module, __dirname */
/* jshint esversion: 6 */
/**
 * Router handling /templates requests
 */
var express = require('express'),
	serverUtils = require('./serverUtils.js'),
	router = express.Router(),
	fs = require('fs'),
	path = require('path');

var projectDir = path.join(__dirname, '..');
var componentsDir = path.join(projectDir, 'data', 'components');

//
// Get requests
//
router.get('/*', (req, res) => {
	let app = req.app,
		request = app.locals.request;

	var filePathSuffix = req.path.replace(/\/components\//, '').replace(/\/$/, ''),
		filePath = '',
		compName = filePathSuffix.indexOf('/') > 0 ? filePathSuffix.substring(0, filePathSuffix.indexOf('/')) : filePathSuffix;

	// console.log(' **** filePathSuffix=' + filePathSuffix + ' comp=' + compName);

	console.log('### Component: ' + req.url);

	if (req.path.indexOf('/_compdelivery/') === 0) {
		// 
		// component render
		//
		var compFile = req.path.replace(/\/_compdelivery\//, '').replace(/\/$/, '');
		compName = compFile.substring(0, compFile.indexOf('/'));
		filePath = path.resolve(componentsDir + '/' + compFile);
	} else if (req.path.indexOf('/_themes/') === 0) {
		// 
		// component render
		//
		var compFile = req.path.replace(/\/_themes\/_components\//, '').replace(/\/$/, '');
		compName = compFile.substring(0, compFile.indexOf('/'));
		filePath = path.resolve(componentsDir + '/' + compFile);
	} else{
		filePath = path.resolve(projectDir + '/' + filePathSuffix);
	}

	console.log(' - filePath=' + filePath);

	if (filePath && existsAndIsFile(filePath)) {
		// original file
		res.sendFile(filePath);
	} else {
		console.log('404: ' + filePath);
		res.writeHead(404, {});
		res.end();
	}
});

//
// POST requests
//
router.post('/*', (req, res) => {
	console.log('path ' + req.path + ' not supported yet');
	res.writeHead(200, {});
	res.end();
});

var existsAndIsFile = function (filePath) {
	var ok = false;
	if (fs.existsSync(filePath)) {
		var statInfo = fs.statSync(filePath);
		ok = statInfo && statInfo.isFile();
	}
	return ok;
};


// Export the router
module.exports = router;