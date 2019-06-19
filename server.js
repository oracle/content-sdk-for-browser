/**
 * Copyright (c) 2019 Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
/* global console, process, __dirname */
/* jshint esversion: 6 */

/**
 * Test CEC Content SDK
 */

var express = require('express'),
	app = express(),
	fs = require('fs'),
	path = require('path'),
	request = require('request'),
	cors = require('cors'),
	componentsRouter = require('./server/componentsRouter.js'),
	contentRouter = require('./server/contentRouter.js');

// project root is the current dir
var projectDir = path.join(__dirname);
var srcDir = path.join(projectDir, 'samples');
var libsDir = path.join(projectDir, 'libs');
var sdkDir = path.join(projectDir, 'sdk');

var port = process.env.CEC_CONTENTSDK_PORT || 7070;

// allow cross-origin requests for all
app.use(cors());

// enable cookies
request = request.defaults({
	jar: true,
	proxy: null
});
app.locals.request = request;

app.use('/', express.static(srcDir));
app.use('/libs', express.static(libsDir));
app.use('/sdk', express.static(sdkDir));
app.use('/node_modules', express.static(path.join(projectDir, 'node_modules')));

// All /content requests are handled by contentRouter
app.get('/content*', contentRouter);
app.post('/content*', contentRouter);
// all /components request are handled by componentsRouter
app.get('/_compdelivery*', componentsRouter);
app.post('/_compdelivery*', componentsRouter);
app.get('/_themes*', componentsRouter);
app.post('/_themes*', componentsRouter);

app.get('*.js', function (req, res) {
	console.log('@@@ js: ' + req.path);

	var name = req.path.substring(req.path.lastIndexOf('/'));
	var filePath = path.join(libsDir, name);
	console.log(' - filePath=' + filePath);
	
	if (fs.existsSync(filePath)) {
		res.write(fs.readFileSync(filePath).toString());
	} else {
		console.log('ERROR: file does not exist');
	}

	res.end();
});

// Handle startup errors
process.on('uncaughtException', function (err) {
	'use strict';
	if (err.code === 'EADDRINUSE' || err.errno === 'EADDRINUSE') {
		console.log('======================================');
		console.error(`Another server is using port ${err.port}. Stop that process and try to start the server again.`);
		console.log('======================================');
	} else {
		console.error(err);
	}
});

// start the server without remote server
app.listen(port, function () {
	"use strict";
	console.log('NodeJS running...:');
	console.log('Local server: http://localhost:' + port);
});
