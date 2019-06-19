/**
 * Copyright (c) 2019 Oracle and/or its affiliates. All rights reserved.
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
/* globals define,console,Promise */
define([
	"jquery",
	"mustache",
	"marked",
	"css!./design.css"
], function ($, Mustache, Marked, templateHtml, css) {
	"use strict";

	var templateHtml = '<div class="contentItem">\
		{{#fields}}\
		<div class="Starter-Blog-Post">\
			{{#starter-blog-post_header_image}}\
			<div class="post-header" style="background-image: url(\'{{url}}\')">\
				<div class="overlay"></div>\
			{{/starter-blog-post_header_image}}\
				<div class="row">\
				<div class="col">\
				<div class="post-heading">\
					<h1>{{starter-blog-post_title}}</h1>\
					<h2>{{starter-blog-post_summary}}</h2>\
					<span class="metadata">{{metadata}}</span>\
				</div>\
				</div>\
				</div>\
			{{#starter-blog-post_header_image}}\
			</div>\
			{{/starter-blog-post_header_image}}\
			<div class="post-body">\
				<div class="post-content">{{{starter-blog-post_content}}}</div>\
				{{#starter-blog-post_author}}\
				<div class="post-author">\
					{{#avatarUrl}}\
						<img src="{{avatarUrl}}"/>\
					{{/avatarUrl}}\
					<div>{{name}}</div>\
					<div>{{{bio}}}</div>\
				</div>\
				{{/starter-blog-post_author}}\
			</div>\
		</div>\
		{{/fields}}\
	</div>';

	// Content Layout constructor function.
	function ContentLayout(params) {
		this.contentItemData = params.contentItemData || {};
		this.scsData = params.scsData;
		this.contentClient = params.contentClient;
	}

	// Helper function to format a date field by locale.
	function dateToMDY(date) {
		if (!date) {
			return "";
		}

		var dateObj = new Date(date);

		var options = {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		};
		var formattedDate = dateObj.toLocaleDateString("en-US", options);

		return formattedDate;
	}

	// Helper function to parse markdown text.
	function parseMarkdown(mdText) {
		if (mdText && /^<!---mde-->\n\r/i.test(mdText)) {
			mdText = mdText.replace("<!---mde-->\n\r", "");
			mdText = Marked(mdText);
		}

		return mdText;
	}

	// Helper function to make an additional Content REST API call to retrieve all items referenced in the data by their ID.
	function getRefItems(contentClient, ids) {
		// Calling getItems() with no ‘ids’ returns all items.
		// If no items are requested, just return a resolved Promise.
		if (ids.length === 0) {
			return Promise.resolve({});
		} else {
			return contentClient.getItems({
				"ids": ids
			});
		}
	}

	// Content Layout definition.
	ContentLayout.prototype = {
		// Specify the versions of the Content REST API that are supported by the this Content Layout.
		// The value for contentVersion follows Semantic Versioning syntax.
		// This allows applications that use the content layout to pass the data through in the expected format.
		contentVersion: ">=1.0.0 <2.0.0",

		// Main rendering function:
		// - Updates the data to handle any required additional requests and support both v1.0 and v1.1 Content REST APIs
		// - Expand the Mustache template with the updated data
		// - Appends the expanded template HTML to the parentObj DOM element
		render: function (parentObj) {
			var template,
				content = $.extend({}, this.contentItemData),
				contentClient = this.contentClient,
				contentType,
				secureContent = false;

			// If used with CECS Sites, Sites will pass in context information via the scsData property.
			if (this.scsData) {
				content = $.extend(content, {
					"scsData": this.scsData
				});
				contentType = content.scsData.showPublishedContent === true ? "published" : "draft";
				secureContent = content.scsData.secureContent;
			}

			// Support both v1.0 and v1.1 Content REST API response formats.
			// User-defined fields are passed through the 'data' property in v1.0 and 'fields' property in v1.1.
			var data = !contentClient.getInfo().contentVersion || contentClient.getInfo().contentVersion === "v1" ? content.data : content.fields;

			// Massage the data so that the 'fields' property is always there.
			// The corresponding layout.html template only checks for the ‘fields’ property. 
			console.log(contentClient.getInfo());
			if (!contentClient.getInfo().contentVersion || contentClient.getInfo().contentVersion === "v1") {
				content["fields"] = content.data;
			}

			//
			// Handle fields specific to this content type.
			//

			var moreItems;

			var referedIds = [];

			// Get the IDs of any referenced assets, we will do an additional query to retrieve these so we can render them as well.
			// If you don’t want to render referenced assets, remove these block.
			if (data["starter-blog-post_author"]) {
				referedIds[referedIds.length] = data["starter-blog-post_author"].id;
			}

			if (data["starter-blog-post_header_image"]) {
				data["starter-blog-post_header_image"]["url"] = contentClient.getRenditionURL({
					"id": data["starter-blog-post_header_image"].id
				});
			}

			data["starter-blog-post_content"] = contentClient.expandMacros(data["starter-blog-post_content"]);


			moreItems = data["starter-blog-post_download_media"] || [];
			moreItems.forEach(function (nxtItem) {
				nxtItem["url"] = contentClient.getRenditionURL({
					"id": nxtItem.id
				});
			});



			// If any referenced items exist, fetch them before we render.
			getRefItems(contentClient, referedIds).then(function (results) {
				var items = results && results.items || [];

				// Support v1 bulk query.
				if (!Array.isArray(items)) {
					var newItems = [];
					Object.keys(items).forEach(function (key) {
						newItems.push(items[key]);
					});
					items = newItems;
				}
				// Store the retrieved referenced items in the data used by the template.
				items.forEach(function (item) {
					// Massage the data so that the 'fields' property is always there.
					// The corresponding layout.html template only checks for the ‘fields’ property.
					if (!contentClient.getInfo().contentVersion || contentClient.getInfo().contentVersion === "v1") {
						item["fields"] = item.data;
					}
					// Retrieve the reference item from the query result.
					if (data["starter-blog-post_author"] && data["starter-blog-post_author"].id === item.id) {
						var authorName = item && item.fields && item.fields['starter-blog-author_name'];
						data['starter-blog-post_author']['name'] = authorName;
						data['starter-blog-post_author']['bio'] = parseMarkdown(item && item.fields && item.fields['starter-blog-author_bio']);
						console.log(data['starter-blog-post_author']['bio']);
						var authorAvatar = item && item.fields && item.fields['starter-blog-author_avatar'];
						if (authorAvatar) {
							// create the rendition URL
							data['starter-blog-post_author']['avatarUrl'] = contentClient.getRenditionURL({
								'id': authorAvatar.id
							});
						}

						var createdOn = dateToMDY(item.updatedDate.value);
						data['metadata'] = authorName ? 'Posted by ' + authorName + ' on ' + createdOn : 'Posted on ' + createdOn;
					}

				});

				try {
					// Use Mustache to expand the HTML template with the data.
					template = Mustache.render(templateHtml, content);

					// Insert the expanded template into the passed in container.
					if (template) {
						$(parentObj).append(template);
					}
				} catch (e) {
					console.error(e.stack);
				}
			});
		}
	};

	return ContentLayout;
});