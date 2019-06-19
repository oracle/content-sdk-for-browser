/**
 * Copyright (c) 2019 Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
/* globals app, module, __dirname */
/* jshint esversion: 6 */
/**
 * Router handling /content requests
 */
var express = require('express'),
	serverUtils = require('./serverUtils.js'),
	router = express.Router(),
	fs = require('fs'),
	path = require('path'),
	url = require('url');


var projectDir = path.join(__dirname, "..");

//
// Get requests
//
router.get('/*', (req, res) => {
	let cntPath = req.path.replace(/^\/api/, ''),
		cntURL = url.parse(req.url.replace(/^\/api/, ''));

	console.log('*** Content: ' + req.url);

	// The local server uses published APIs
	cntPath = cntPath.replace('/management/', '/published/');

	var contentDir = path.join(projectDir, 'data', 'assets');

	if (!fs.existsSync(contentDir)) {
		console.log(' - content directory ' + contentDir + ' does not exist');
		res.writeHead(200, {});
		res.end();
		return;
	}

	if (cntPath === '/content/published/api/v1/items/queries' ||
		cntPath === '/content/published/api/v1/items' ||
		cntPath === '/content/published/api/v1.1/items') {
		//
		// handle item query (used by content-list component)
		//
		var params = serverUtils.getURLParameters(cntURL.query),
			contentType = params['contentType'],
			fields = params['fields'],
			fieldName = '',
			fieldValue = '',
			orderBy = decodeURIComponent(params['orderBy'] || '').toLowerCase(),
			limit = Number(params['limit'] || 10),
			offset = Number(params['offset'] || 0),
			q = decodeURIComponent(params['q'] || ''),
			defaultValue = decodeURIComponent(params['default'] || ''),
			contentItemType = params['field:type:equals'] || '',
			language = '',
			otherConditions = [],
			ids = [];

		if (q) {
			var conds = q.indexOf(' and ') > 0 ? q.split(' and ') : [q];
			for (var i = 0; i < conds.length; i++) {
				var cond = conds[i];
				cond = serverUtils.replaceAll(cond, '(', '');
				cond = serverUtils.replaceAll(cond, ')', '');

				if (cond.indexOf(' or ') > 0) {
					var orConds = cond.split(' or ');
					for (var j = 0; j < orConds.length; j++) {
						var namevalue = orConds[j].split(' eq ');
						if (namevalue && namevalue.length === 2 && namevalue[0] && namevalue[1]) {
							if (namevalue[0] === 'id') {
								ids[ids.length] = serverUtils.replaceAll(namevalue[1], '"');
							}
						} else {
							console.log(' - invalid query parameter : ' + orConds[j]);
						}
					}

				} else {
					var namevalue = cond.split(' eq ');
					if (namevalue && namevalue.length === 2 && namevalue[0] && namevalue[1]) {
						if (namevalue[0] === 'id') {
							ids[ids.length] = serverUtils.replaceAll(namevalue[1], '"');
						} else if (namevalue[0] === 'type') {
							contentItemType = serverUtils.replaceAll(namevalue[1], '"');
						} else if (namevalue[0] === 'language') {
							language = serverUtils.replaceAll(namevalue[1], '"');
						} else {
							otherConditions[otherConditions.length] = {
								field: namevalue[0],
								value: serverUtils.replaceAll(namevalue[1], '"')
							};
						}
					} else {
						console.log(' - invalid query parameter : ' + cond);
					}
				}
			}
		}

		// remove wild card
		if (defaultValue) {
			defaultValue = defaultValue.split('*').join('');
		}

		// check if field: is specified
		Object.keys(params).forEach(function (key) {
			var value = params[key];
			if (key.indexOf('field:') === 0 && key !== 'field:type:equals') {
				fieldName = key.substring(6);
				fieldValue = value;
			}
		});
		console.log(' - fields=' + fields + ' field={' + fieldName + ':' + fieldValue + '}' +
			' default="' + defaultValue + '"' +
			' orderBy=' + orderBy + ' limit=' + limit +
			' offset=' + offset + ' contentItemType=' + contentItemType +
			' ids=' + JSON.stringify(ids) +
			' language=' + language +
			' other conditions=' + JSON.stringify(otherConditions));

		if (ids && ids.length > 0) {
			var items = [];
			for (var i = 0; i < ids.length; i++) {
				// find the item type from metadata.json
				var itemType = getItemTypeFromMetadata(contentDir, ids[i])
				// console.log(' - item id: ' + id + ' type: ' + itemType);
				if (itemType) {
					var itemfile = path.join(contentDir, 'ContentItems', itemType, ids[i] + '.json');
					if (fs.existsSync(itemfile)) {
						items[items.length] = JSON.parse(fs.readFileSync(itemfile));
					} else {
						console.log(' - item file ' + itemfiles + ' does not exist');
					}
				} else {
					console.log(' - item type not found for ' + ids[i]);
				}
			}
			for (var i = 0; i < items.length; i++) {
				if (!items[i].fields && items[i].data) {
					items[i]['fields'] = items[i].data;
				}
			}

			var results = {};

			if (cntPath.indexOf('1.1') > 0) {
				results['items'] = items;
			} else {
				var items2 = {};
				for (var i = 0; i < items.length; i++) {
					var id = items[i].id,
						data = items[i];
					items2[id] = data;
				}
				results['items'] = items2;
			}
			// return the result
			console.log(' - returned items: ' + items.length);
			res.write(JSON.stringify(results));
			res.end();
			return;
		} else if (contentItemType) {
			var itemsdir = path.join(contentDir, 'ContentItems', contentItemType);
			if (fs.existsSync(itemsdir)) {
				var itemfiles = fs.readdirSync(itemsdir),
					items = [];
				for (var i = 0; i < itemfiles.length; i++) {
					if (fs.lstatSync(path.join(itemsdir, itemfiles[i])).isDirectory()) {
						continue;
					}
					var itemjson = JSON.parse(fs.readFileSync(path.join(itemsdir, itemfiles[i]))),
						qualified = true;

					var data = itemjson.fields || itemjson.data;

					if (!itemjson.fields && itemjson.data) {
						itemjson['fields'] = itemjson.data;
					}

					// check translation
					if (language && itemjson.language) {
						if (language !== itemjson.language) {
							continue;
						}
					}

					// check query conditions if there are
					for (var j = 0; j < otherConditions.length; j++) {
						if (!data.hasOwnProperty(otherConditions[j].field) ||
							!data[otherConditions[j].field]) {
							// the item does not have the field or field value
							qualified = false;
							break;
						} else {
							var itemfieldvalue = data[otherConditions[j].field];
							if (typeof itemfieldvalue === 'object') {
								var found = false;
								Object.keys(itemfieldvalue).forEach(function (key) {
									var value = itemfieldvalue[key];
									if (value === otherConditions[j].value) {
										found = true;
										console.log(' - match ' + otherConditions[j].field + '/' + key + ' with value ' + value);
									}
								});
								if (!found) {
									qualified = false;
									break;
								}
							} else {
								if (itemfieldvalue !== otherConditions[j].value) {
									qualified = false;
									break;
								}
							}
						}
					}

					if (qualified) {
						// search fields
						if (fieldName && fieldValue) {
							var itemfieldvalue = data[fieldName];
							if (itemfieldvalue && itemfieldvalue === fieldValue) {
								if (!defaultValue || itemfieldvalue.indexOf(defaultValue) >= 0) {
									items[items.length] = itemjson;
								}
							}
						} else {
							if (!defaultValue || JSON.stringify(itemjson).indexOf(defaultValue) >= 0) {
								items[items.length] = itemjson;
							}
						}
					}
				}

				// sort 
				if (orderBy === 'name:asc' || orderBy === 'name:des') {
					var byName = items.slice(0);
					byName.sort(function (a, b) {
						var x = a.name;
						var y = b.name;
						return orderBy === 'name:des' ? (x < y ? 1 : x > y ? -1 : 0) : (x < y ? -1 : x > y ? 1 : 0);
					});
					items = byName;
				} else if (orderBy === 'updateddate:des' || orderBy === 'updateddate:asc') {
					var byDate = items.slice(0);
					byDate.sort(function (a, b) {
						var x = new Date(a.updatedDate ? a.updatedDate.value : a.updateddate.value);
						var y = new Date(b.updatedDate ? b.updatedDate.value : b.updateddate.value);
						return orderBy === 'updateddate:des' ? y - x : x - y;
					});
					items = byDate;
				} else if (orderBy) {
					console.log(' - invalid orderBy ' + orderBy);
				}

				// check limit and offset
				var total = items.length - offset,
					count = total < limit ? total : limit,
					items2 = offset < items.length ? items.slice(offset, offset + count) : [],
					hasMore = offset + count < items.length;
				if (count < items.length) {
					console.log(' - pagination: items ' + offset + ' - ' + (offset + count - 1) + ' has more: ' + hasMore);
				} else {
					console.log(' - returned items: ' + items.length);
				}
				var results = {
					hasMore: hasMore,
					limit: items.length,
					count: count,
					items: items2,
					totalResults: items.length,
					offset: offset
				};
				// return the result
				res.write(JSON.stringify(results));
				res.end();
				return;
			} else {
				console.log(' - content item directory ' + itemsdir + ' does not exist');
			}
		} else {
			console.log(' - no content item is specified, no item is returned')
		}

	} else if (cntPath.indexOf('/content/published/api/v1/items/') === 0 ||
		cntPath.indexOf('/content/published/api/v1.1/items/') === 0) {
		//
		// handle item 
		// 
		var id = cntPath.substring(cntPath.indexOf('/items/') + 7),
			ids = [],
			isBulk = false;

		if (id.indexOf('/') > 0) {
			id = id.substring(0, id.indexOf('/'));
		}
		ids.push(id);

		var language = '';
		var langQuery = '/variations/language/';
		if (cntPath.indexOf(langQuery) > 0) {
			language = cntPath.substring(cntPath.indexOf(langQuery) + langQuery.length);
		}

		var params = serverUtils.getURLParameters(cntURL.query);
		if (id === 'bulk') {
			// get id from url parameters
			ids = params['ids'].split(',');
			isBulk = true;
		}

		var expandFields = params && params['expand'] ? params['expand'].split(',') : [];
		// console.log('expandFields=' + expandFields);

		var items = [],
			total = 0;
		for (var i = 0; i < ids.length; i++) {
			var itemjson = getLocalItem(contentDir, ids[i], '', language, false);
			if (itemjson && itemjson.id) {
				items[total] = itemjson;
				total = total + 1;

				// check to see if needs to expand reference items
				if (expandFields.length > 0) {
					var fields = itemjson.fields || itemjson.data;

					if (expandFields.length === 1 && expandFields[0] === 'all') {
						// Expand all reference items
						Object.keys(fields).forEach(function (key) {
							var fieldValue = fields[key];
							if (fieldValue) {
								if (Array.isArray(fieldValue)) {
									// multiple values field
									for (var k = 0; k < fieldValue.length; k++) {
										if (fieldValue[k].id) {
											// query the reference item
											var refItem = getLocalItem(contentDir, fieldValue[k].id, fieldValue[k].type, language, true);
											if (refItem && refItem.id) {
												if (!refItem.fields && refItem.data) {
													refItem.fields = refItem.data;
												}
												fields[key][k] = refItem;
											}
										}
									}
								} else if (typeof fieldValue === 'object') {
									if (fieldValue.id) {
										// query the reference item
										var refItem = getLocalItem(contentDir, fieldValue.id, fieldValue.type, language, true);
										if (refItem && refItem.id) {
											if (!refItem.fields && refItem.data) {
												refItem.fields = refItem.data;
											}
											fields[key] = refItem;
										}
									}
								}
							}
						});
					} else {
						// Expand selected reference items
						for (var j = 0; j < expandFields.length; j++) {
							var expandField = expandFields[j];
							expandField = expandField.indexOf('fields.') === 0 ? expandField.substring('fields.'.length) : expandField;
							if (fields.hasOwnProperty(expandField) && fields[expandField]) {
								var fieldValue = fields[expandField];
								if (Array.isArray(fieldValue)) {
									// multiple values field
									for (var k = 0; k < fieldValue.length; k++) {
										if (fieldValue[k].id) {
											// query the reference item
											var refItem = getLocalItem(contentDir, fieldValue[k].id, fieldValue[k].type, language, true);
											if (refItem && refItem.id) {
												fields[expandField][k] = refItem;
											}
										}
									}
								} else if (typeof fieldValue === 'object') {
									if (fieldValue.id) {
										// query the reference item
										var refItem = getLocalItem(contentDir, fieldValue.id, fieldValue.type, language, true);
										if (refItem && refItem.id) {
											fields[expandField] = refItem;
										}
									}
								}
							} // expand reference field exists
						} // loop 
					} // expand selected reference items
				}
			} // get local item
		}
		//console.log(items);
		if (total > 0) {
			var results = {};
			if (isBulk) {
				var items2 = {};
				for (var i = 0; i < items.length; i++) {
					var id = items[i].id,
						data = items[i];
					if (!items[i].fields && items[i].data) {
						items[i]['fields'] = items[i].data;
					}
					items2[id] = data;
				}
				results = {
					items: items2
				}
			} else {
				results = items[0];
				if (!results.fields && results.data) {
					results['fields'] = results.data;
				}
			}
			console.log(' - returned item(s): ' + items.length);
			// return the result
			res.write(JSON.stringify(results));
			res.end();
			return;
		} else {
			console.log(' - no item found');
		}

	} else if (cntPath.indexOf('/content/published/api/v1/digital-assets/') === 0 ||
		cntPath.indexOf('/content/published/api/v1.1/assets/') === 0) {
		// 
		// handle digital assets
		//
		var prefix = cntPath.indexOf('/content/published/api/v1/digital-assets/') === 0 ? '/content/published/api/v1/digital-assets/' : '/content/published/api/v1.1/assets/',
			id;

		id = cntPath.substring(prefix.length);
		if (id.indexOf('/') > 0) {
			id = id.substring(0, id.indexOf('/'));
		}
		var assetsdir = path.join(contentDir, 'ContentItems', 'DigitalAsset'),
			assetjsonfile = path.join(assetsdir, id + '.json');
		if (fs.existsSync(assetjsonfile)) {
			var assetjson = JSON.parse(fs.readFileSync(assetjsonfile)),
				assetfile = assetjson && assetjson.name ? path.join(assetsdir, 'files', id, assetjson.name) : '';
			if (fs.existsSync(assetfile)) {
				res.write(fs.readFileSync(assetfile));
				res.end();
				return;
			} else {
				console.log(' - digit asset ' + assetfile + ' does not exist');
			}
		} else {
			console.log(' - digit asset ' + assetjsonfile + ' does not exist');
		}
	} else if (cntPath === '/content/published/api/v1/types' ||
		cntPath === '/content/published/api/v1.1/types') {
		//
		// handle content types
		//
		var params = serverUtils.getURLParameters(cntURL.query),
			limitstr = params['limit'] || '',
			alltypes = serverUtils.getContentTypes(),
			typenames = [],
			types = [];
		for (var i = 0; i < alltypes.length; i++) {
			var type = alltypes[i];
			if (typenames.length === 0 || typenames.indexOf(type.name) < 0) {
				types[types.length] = type;
				typenames[typenames.length] = type.name;
			}
		}
		var limit = limitstr ? Number(limitstr) : 999999999999,
			offset = 0,
			total = types.length,
			count = total < limit ? total : limit,
			types2 = offset < types.length ? types.slice(offset, offset + count) : [],
			hasMore = offset + count < types.length;
		var results = {
			hasMore: hasMore,
			limit: types.length,
			count: count,
			items: types2,
			offset: offset
		};
		// return the result
		res.write(JSON.stringify(results));
		res.end();
		return;
	} else if (cntPath.indexOf('/content/published/api/v1/types') === 0 ||
		cntPath.indexOf('/content/published/api/v1.1/types') === 0) {
		//
		// handle content type
		//
		var params = serverUtils.getURLParameters(cntURL.query),
			typeName = params['typeName'] || '',
			alltypes = serverUtils.getContentTypes(),
			result = {};
		for (var i = 0; i < alltypes.length; i++) {
			var type = alltypes[i];
			if (type.name === typeName) {
				result = alltypes[i];
				break;
			}
		}

		// return the result
		res.write(JSON.stringify(result));
		res.end();
		return;

	} else {
		console.log(' - !!! not supported yet');
	}

	res.writeHead(200, {});
	res.end();

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


var getItemTypeFromMetadata = function (contentDir, id) {
	var itemType = '',
		metadatafile = path.join(contentDir, 'metadata.json');
	if (fs.existsSync(metadatafile)) {
		var metadatajson = JSON.parse(fs.readFileSync(metadatafile)),
			groups = metadatajson.groups;
		for (var i = 0; i < groups; i++) {
			var group = metadatajson['group' + i];
			for (var j = 0; j < group.length; j++) {
				var values = group[j].split(':');
				if (values.length > 1) {
					if (values[1] === id) {
						itemType = values[0];
						break;
					}
				}
			}
		}
	} else {
		console.log(' - content metadata ' + metadatafile + ' does not exist');
	}
	// console.log(' item type: ' + itemType);
	return itemType;
};

var getLocalItem = function (contentDir, id, type, language, isRefItem) {
	var itemType = type || getItemTypeFromMetadata(contentDir, id)
	// console.log(' - item id: ' + id + ' type: ' + itemType);
	var item;
	if (itemType) {
		var itemfile = path.join(contentDir, 'ContentItems', itemType, id + '.json');
		if (fs.existsSync(itemfile)) {
			item = JSON.parse(fs.readFileSync(itemfile));

			if (!language || language === item.language || item.translatable === false) {
				return item;
			}

			var vitem = getLocalItemFromVariation(contentDir, id, itemType, language);

			if (vitem) {
				return vitem;
			}
			if (isRefItem) {
				console.log(' - reference item: no translation found for ' + language + ' ' + id + '/' + itemType);
				return item;
			}

			console.log(' - item: no translation found for ' + language + ' ' + id + '/' + itemType + '. Use the current one');
			return item;
		} else {
			console.log(' - item file ' + itemfile + ' does not exist');
		}
	} else {
		console.log(' - item type not found for ' + id);
	}
	return item;
};

var getLocalItemFromVariation = function (contentDir, id, itemType, language) {

	var item;

	// check the item's variation file
	var found = false,
		itemHasVariationFile = false;
	var variationfile = path.join(contentDir, 'ContentItems', 'VariationSets', id + '.json');
	if (fs.existsSync(variationfile)) {
		itemHasVariationFile = true;
		var variationjson = JSON.parse(fs.readFileSync(variationfile));
		if (variationjson && variationjson.length > 0) {
			for (var k = 0; k < variationjson.length; k++) {
				for (var j = 0; j < variationjson[k].items.length; j++) {
					var vitem = variationjson[k].items[j];
					if (vitem.id !== id && vitem.varType === 'language' && vitem.value === language) {
						console.log(' - found item in ' + language + '(direct variation set) id: ' + vitem.id);
						var variationitemfile = path.join(contentdir, 'ContentItems', itemType, vitem.id + '.json');
						if (fs.existsSync(variationitemfile)) {
							item = JSON.parse(fs.readFileSync(variationitemfile));
							found = true;
							break;
						}
					}
				} // go through the list in variation set file
			}
		}
	}

	// check the variation file the item is in
	if (!found && !itemHasVariationFile) {
		var files = fs.readdirSync(path.join(contentDir, 'ContentItems', 'VariationSets'));
		var vitemId = '';
		for (var i = 0; i < files.length; i++) {
			var variationfile = path.join(contentDir, 'ContentItems', 'VariationSets', files[i]);
			var variationjson = JSON.parse(fs.readFileSync(variationfile));
			var itemInVariation = false;
			for (var k = 0; k < variationjson.length; k++) {
				for (var j = 0; j < variationjson[k].items.length; j++) {
					var vitem = variationjson[k].items[j];
					if (vitem.id === id) {
						itemInVariation = true;
					}
					if (vitem.id !== id && vitem.varType === 'language' && vitem.value === language) {
						vitemId = vitem.id;
					}
				}
			}
			if (itemInVariation && vitemId) {
				break;
			}
		}
		if (vitemId) {
			console.log(' - found item in ' + language + '(cross variation set) id: ' + vitemId);
			var variationitemfile = path.join(contentDir, 'ContentItems', itemType, vitemId + '.json');
			if (fs.existsSync(variationitemfile)) {
				item = JSON.parse(fs.readFileSync(variationitemfile));
			}
		}
	}

	return item;
};

// Export the router
module.exports = router;