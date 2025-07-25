/*
 *
 * MMM-Sunnyportal
 *
 * Author: linuxtuxie
 * MIT Licensed.
 *
 */
var NodeHelper = require('node_helper');
var request = require('request');
var flow = require('flow');

// Uncomment the following 2 lines to perform a network capture with tcpdump for debugging purposes
// Start a network capture by running the below command
//  tcpdump -i [interface name eg. eth0] -w captured-packets.pcap
// Next run 
//  npm start debug
// Once you have captured the packets you can decode the HTTPS traffic with Wireshark by opening the captured-packets.pcap file
// Use the following settings in Wireshark: 
//  - Set 'tls' as display filter
//  - Select the /tmp/sslkey.log file in Preferences -> Protocols -> TLS -> (Pre)-Master-Secret log filename

//var sslkeylog = require('sslkeylog');
//sslkeylog.setLog('/tmp/sslkey.log').hookAll();

// The Ennexos SunnyPortal website - updated for the new portal
var USERAGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0';
var LOGIN_URL = '/login';
var DASHBOARD_URL = '/dashboard';
var API_BASE_URL = '/api/v1';
var CURRENT_PRODUCTION_URL = '/api/v1/powerflow/livedata';
var HISTORICAL_DATA_URL = '/api/v1/plants/{plantId}/measurements';
var PLANTS_URL = '/api/v1/plants';
var NEXT_URL = ['/dashboard', '/plants', '/monitoring'];

/**
 * Sunny Portal API Node Library
 * For interfacing with Sunny Portal.
 *
 * @module
 * @param {Object} opts  Need to pass a url, username and password.
 */
var SunnyPortal = function(opts) {

	if(!opts.url) {
		throw new Error('URL Option Must Be Defined');
	}
	if(!opts.username) {
		throw new Error('Username Must Be Defined');
	}
	if(!opts.password) {
		throw new Error('Password Must Be Defined');
	}

	var url = opts.url;
	var username = opts.username;
	var password = opts.password;
	var plantOID = "";

	var _login = function(datetype, callback) {
		var jar = request.jar(); // create new cookie jar
		
		var requestOpts = {
			headers : {
				'User-Agent': USERAGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5',
				'Accept-Encoding': 'gzip, deflate',
				'Connection': 'keep-alive'
			},
			jar: jar,
			gzip: true,
			followRedirect: true,
			agentOptions: {
				rejectUnauthorized: false
			}
		};

		console.log("[_login] Starting SMA/Ennexos authentication flow for " + datetype + " data");
		
		// Step 1: Access Ennexos portal to get redirect to SMA
		request.get(url + '/login', requestOpts, function (err, httpResponse, body) {
			if (err) {
				console.error('[_login] Failed to access Ennexos portal: ', err);
				callback(err);
				return;
			}

			console.log("[_login] Ennexos portal response status: " + httpResponse.statusCode);
			
			// Check if we got redirected to SMA
			var finalUrl = httpResponse.request.uri.href;
			console.log("[_login] Final URL after redirects: " + finalUrl);
			
			if (finalUrl.includes('account.sma.energy')) {
				console.log("[_login] Redirected to SMA authentication - proceeding with SMA login");
				_performSMALogin(jar, finalUrl, body, datetype, callback);
			} else {
				console.log("[_login] No redirect to SMA detected - trying direct authentication");
				_tryDirectAuth(jar, body, datetype, callback);
			}
		});
	};

	var _performSMALogin = function(jar, smaUrl, smaPageBody, datetype, callback) {
		console.log("[_performSMALogin] Analyzing SMA login page");
		
		// Extract form data from SMA login page
		var formAction = '';
		var hiddenFields = {};
		
		// Extract form action URL
		var actionMatch = smaPageBody.match(/<form[^>]*action=["']([^"']*)["']/i);
		if (actionMatch) {
			formAction = actionMatch[1];
			if (!formAction.startsWith('http')) {
				formAction = 'https://account.sma.energy' + formAction;
			}
		} else {
			formAction = 'https://account.sma.energy/login';
		}
		
		console.log("[_performSMALogin] Form action URL: " + formAction);
		
		// Extract hidden form fields
		var hiddenInputMatches = smaPageBody.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi);
		for (const match of hiddenInputMatches) {
			var nameMatch = match[0].match(/name=["']([^"']*)["']/i);
			var valueMatch = match[0].match(/value=["']([^"']*)["']/i);
			if (nameMatch && valueMatch) {
				hiddenFields[nameMatch[1]] = valueMatch[1];
				console.log("[_performSMALogin] Found hidden field: " + nameMatch[1]);
			}
		}
		
		// Prepare login form data
		var formData = Object.assign({
			username: username,
			password: password,
			email: username, // Some forms use email field
			login: username  // Some forms use login field
		}, hiddenFields);
		
		var loginOpts = {
			headers: {
				'User-Agent': USERAGENT,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Referer': smaUrl,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
			},
			jar: jar,
			gzip: true,
			followRedirect: true,
			form: formData,
			agentOptions: {
				rejectUnauthorized: false
			}
		};
		
		console.log("[_performSMALogin] Submitting login form to SMA");
		request.post(formAction, loginOpts, function (err, httpResponse, body) {
			if (err) {
				console.error('[_performSMALogin] SMA login failed: ', err);
				callback(err);
				return;
			}
			
			console.log("[_performSMALogin] SMA login response status: " + httpResponse.statusCode);
			var finalUrl = httpResponse.request.uri.href;
			console.log("[_performSMALogin] Final URL after SMA login: " + finalUrl);
			
			// Check if we're back at Ennexos (successful login)
			if (finalUrl.includes('ennexos.sunnyportal.com') || httpResponse.statusCode === 200) {
				console.log("[_performSMALogin] Successfully authenticated with SMA!");
				callback(null, jar);
			} else if (body.includes('error') || body.includes('invalid')) {
				console.log("[_performSMALogin] SMA login failed - invalid credentials");
				callback(new Error('Invalid SMA credentials'));
			} else {
				console.log("[_performSMALogin] Unexpected response from SMA login");
				callback(new Error('SMA authentication flow failed'));
			}
		});
	};

	var _tryDirectAuth = function(jar, pageBody, datetype, callback) {
		console.log("[_tryDirectAuth] Attempting direct Ennexos authentication");
		
		// This is a fallback - try to find a direct login form on Ennexos
		var formAction = '';
		var actionMatch = pageBody.match(/<form[^>]*action=["']([^"']*)["']/i);
		if (actionMatch) {
			formAction = url + actionMatch[1];
		} else {
			formAction = url + '/auth/login';
		}
		
		var formData = {
			username: username,
			password: password
		};
		
		var authOpts = {
			headers: {
				'User-Agent': USERAGENT,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			jar: jar,
			gzip: true,
			form: formData,
			agentOptions: {
				rejectUnauthorized: false
			}
		};
		
		request.post(formAction, authOpts, function (err, httpResponse, body) {
			if (err) {
				console.error('[_tryDirectAuth] Direct auth failed: ', err);
				callback(err);
				return;
			}
			
			console.log("[_tryDirectAuth] Direct auth response status: " + httpResponse.statusCode);
			
			if (httpResponse.statusCode === 200) {
				console.log("[_tryDirectAuth] Direct authentication successful");
				callback(null, jar);
			} else {
				console.log("[_tryDirectAuth] Direct authentication failed");
				callback(new Error('Direct authentication failed'));
			}
		});
	};

	var _getPlants = function(jar, token, callback) {
		var requestOpts = {
			headers: {
				'User-Agent': USERAGENT,
				'Authorization': 'Bearer ' + token,
				'Accept': 'application/json',
			},
			method: 'GET',
			jar: jar,
			gzip: true,
			json: true,
			agentOptions: {
				rejectUnauthorized: false
			},
		}

		request(url + PLANTS_URL, requestOpts, function (err, httpResponse, body) {
			if (err) {
				console.error('[_getPlants] Could not get plants list:', err);
				callback(err);
				return;
			}
			
			console.log("[_getPlants] HTTP Result: " + httpResponse.statusCode);
			
			if (httpResponse.statusCode === 200 && body && body.length > 0) {
				// Get the first plant ID
				plantOID = body[0].id || body[0].plantId || body[0].oid;
				console.log("[_getPlants] Found plant ID: " + plantOID);
				callback(null, body);
			} else {
				console.error('[_getPlants] No plants found or invalid response');
				callback(new Error('No plants found'));
			}
		});
	};

	var _getHistoricalData = function(datetype, month, day, year, jar, token, callback) {
		var startDate, endDate;
		var now = new Date();
		
		// Calculate date ranges based on data type
		if (datetype === 'day') {
			startDate = new Date(year, month - 1, day);
			endDate = new Date(year, month - 1, day + 1);
		} else if (datetype === 'month') {
			startDate = new Date(year, month - 1, 1);
			endDate = new Date(year, month, 1);
		} else if (datetype === 'year') {
			startDate = new Date(year, 0, 1);
			endDate = new Date(year + 1, 0, 1);
		} else if (datetype === 'total') {
			// For total, get data from the beginning of the first year with data
			startDate = new Date(year - 10, 0, 1);
			endDate = new Date(year + 1, 0, 1);
		}

		var requestOpts = {
			headers: {
				'User-Agent': USERAGENT,
				'Authorization': 'Bearer ' + token,
				'Accept': 'application/json',
			},
			jar: jar,
			gzip: true,
			json: true,
			agentOptions: {
				rejectUnauthorized: false
			}
		};

		// Build the API URL with parameters
		var apiUrl = url + HISTORICAL_DATA_URL.replace('{plantId}', plantOID);
		var queryParams = '?from=' + startDate.toISOString() + '&to=' + endDate.toISOString();
		
		if (datetype === 'day') {
			queryParams += '&resolution=15min';
		} else if (datetype === 'month') {
			queryParams += '&resolution=day';
		} else if (datetype === 'year') {
			queryParams += '&resolution=month';
		} else if (datetype === 'total') {
			queryParams += '&resolution=year';
		}

		request.get(apiUrl + queryParams, requestOpts, function (err, httpResponse, body) {
			if (err) {
				console.error('[_getHistoricalData] Getting historical data failed: ', err);
				callback(err);
				return;
			}
			
			console.log("[_getHistoricalData] HTTP Result " + datetype + " for " + month + "/" + day +"/" + year + ": " + httpResponse.statusCode);
			
			if (httpResponse.statusCode === 200) {
				callback(null, body);
			} else {
				callback(new Error('Failed to get historical data: ' + httpResponse.statusCode));
			}
		});
	};

	var _processHistoricalData = function(datetype, data, month, day, year, callback) {
		try {
			var response = [[]];
			var power = [];
			var times = [];
			var date;

			console.log("[_processHistoricalData] Processing " + datetype + " data");
			
			if (!data || !data.measurements || !Array.isArray(data.measurements)) {
				console.log("[_processHistoricalData] No measurements data found");
				callback(null, [[], []]);
				return;
			}

			// Process the measurements data
			data.measurements.forEach(function(measurement) {
				if (measurement.timestamp && (measurement.power !== undefined || measurement.energy !== undefined)) {
					var timestamp = new Date(measurement.timestamp);
					var value = measurement.power || measurement.energy || 0;
					
					// Convert energy to power for consistency (if needed)
					if (measurement.energy !== undefined && measurement.power === undefined) {
						// For energy measurements, convert to average power
						value = parseFloat(value);
					} else {
						value = parseFloat(value) || 0;
					}

					times.push(timestamp);
					power.push(value);
				}
			});

			response[0] = times;
			response[1] = power;
			
			console.log("[_processHistoricalData] Processed " + times.length + " data points for " + datetype);
			callback(null, response);
			
		} catch (error) {
			console.error('[_processHistoricalData] Error processing data:', error);
			callback(error);
		}
	};

	/**
	* Returns the current production at this moment in time.
	*
	* @method currentProduction
	* @param {Function} callback A callback function once current production is received.  Will return a JSON object of the current status.
	*/
	var currentProduction = function(callback) {
		flow.exec(
			function() {
				_login('current', this);	
			},
			function(err, jar) {
				if (err) {
					callback(err);
					return;
				}

				var requestOpts = {
					headers: {
						'User-Agent': USERAGENT,
						'Accept': 'application/json, text/javascript, */*; q=0.01',
						'X-Requested-With': 'XMLHttpRequest'
					},
					method: 'GET',
					jar: jar,
					gzip: true,
					agentOptions: {
						rejectUnauthorized: false
					},		
				}

				// Try different potential current production endpoints
				var endpoints = [
					'/api/v1/powerflow/livedata',
					'/api/powerflow/livedata', 
					'/dashboard/livedata',
					'/api/dashboard/current',
					'/live'
				];

				var tryEndpoint = function(index) {
					if (index >= endpoints.length) {
						callback(new Error('No working current production endpoint found'));
						return;
					}

					var endpoint = endpoints[index];
					console.log("[currentProduction] Trying endpoint: " + endpoint);

					request(url + endpoint, requestOpts, function (err, httpResponse, body) {
						if (err) {
							console.log('[currentProduction] Endpoint ' + endpoint + ' failed: ' + err.message);
							tryEndpoint(index + 1);
							return;
						}
						
						if (httpResponse.statusCode === 200) {
							console.log('[currentProduction] Successfully retrieved current production data from: ' + endpoint);
							try {
								var data = typeof body === 'string' ? JSON.parse(body) : body;
								callback(null, data);
							} catch (parseError) {
								console.log('[currentProduction] Failed to parse JSON from ' + endpoint);
								tryEndpoint(index + 1);
							}
						} else {
							console.log('[currentProduction] Endpoint ' + endpoint + ' returned status: ' + httpResponse.statusCode);
							tryEndpoint(index + 1);
						}
					});
				};

				tryEndpoint(0);
			}
		);
	};

	/**
	* Returns historical production for a given day.
	*
	* @method historicalProduction
	* @param {String} datetype Determines if we need to fetch day, month or year data
	* @param {Number} month
	* @param {Number} day
	* @param {Number} year
	* @param {Function} callback A callback function once historical production is received. Will return a JSON object of the days production.
	*/
	var historicalProduction = function(datetype, month, day, year, callback) {
		var finalJar, finalToken;
		
		flow.exec(
			function() {
				_login(datetype, this);
			},
			function(err, jar, token) {
				if (err) {
					callback(err);
					return;
				}
				finalJar = jar;
				finalToken = token;
				_getPlants(finalJar, finalToken, this);
			},
			function(err, plants) {
				if (err) {
					callback(err);
					return;
				}
				_getHistoricalData(datetype, month, day, year, finalJar, finalToken, this);
			},
			function(err, data) {
				if (err) {
					callback(err);
					return;
				}
				_processHistoricalData(datetype, data, month, day, year, this);
			},
			function(err, processedData) {
				if (err) {
					console.error('[historicalProduction] Error processing historical data:', err);
					callback(err);
					return;
				}
				
				console.log("[historicalProduction] Successfully processed " + datetype + " data");
				callback(null, processedData);
			}
		);
	};

	return {
		currentProduction : currentProduction,
        historicalProduction : historicalProduction
	};

};

module.exports = NodeHelper.create({
    // Override start method.
    start: function() {
	  console.log("Starting node helper for: " + this.name);
	  this.started = false;
      return;
    },

	// Override socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {

		// We save this.started (update timer) status, to prevent mutiple timer restarts
        // for each new client connection/instance.
		var self = this;

		var include = payload.includeGraphs;
		var includeDayIndex, includeMonthIndex, includeYearIndex, includeTotalIndex;
		// Get the indexes of the includeGraphs
		if ((Array.isArray(include)) && (include.length <= 4) && (include[0].toLowerCase() !== "all")) {
			includeDayIndex = include.findIndex(item =>
				"Day".toLowerCase() === item.toLowerCase());
			includeMonthIndex = include.findIndex(item =>
				"Month".toLowerCase() === item.toLowerCase());
			includeYearIndex = include.findIndex(item =>
				"Year".toLowerCase() === item.toLowerCase());
			includeTotalIndex = include.findIndex(item =>
				"Total".toLowerCase() === item.toLowerCase());
			if (includeTotalIndex !== -1) self.processTotalData(self);
		} else {
			includeDayIndex = 0;
			includeMonthIndex = 1;
			includeYearIndex = 2;
			includeTotalIndex = 3;
		}

		function startup(payload) {
			var sunnyPortal = new SunnyPortal(payload);

			var now = new Date();
			var month = now.getMonth()+1;
			var day = now.getDate();
			var year = now.getFullYear();
			if (includeDayIndex !== -1) {
				sunnyPortal.historicalProduction('day', month, day, year, function(err, data) {
					self.dayData = data;
					self.processDayData(self);
				});
				}

			if (includeMonthIndex !== -1) {
				sunnyPortal.historicalProduction('month', month, day, year, function(err, data) {
					self.monthData = data;
					self.processMonthData(self);
				});
			}

			if (includeYearIndex !== -1) {
				sunnyPortal.historicalProduction('year', month, day, year, function(err, data) {
					self.yearData = data;
					self.processYearData(self);
				});
			}

			if (includeTotalIndex !== -1) {
				sunnyPortal.historicalProduction('total', month, day, year, function(err, data) {
					self.totalData = data;
					self.processTotalData(self);
				});
			}
		}

		if (notification === "START_SUNNYPORTAL" && this.started == false) {				
			console.log("SocketNotification START_SUNNYPORTAL received for the first time...setting updateInterval to " + payload.updateInterval + "ms");
			startup(payload); // When the MagicMirror module is called the first time, we are immediatly going to fetch data
   			setInterval(function() { startup(payload) }, payload.updateInterval); // Now let's schedule the job
			self.started = true;
		} else if (notification === "START_SUNNYPORTAL" && this.started == true) {
			console.log("SocketNotification START_SUNNYPORTAL received");
			if (includeDayIndex !== -1) self.processDayData(self);
			if (includeMonthIndex !== -1) self.processMonthData(self);
			if (includeYearIndex !== -1) self.processYearData(self);
			if (includeTotalIndex !== -1) self.processTotalData(self);
		}
  },

  processDayData: function(self) {
    console.log("Starting function processDayData with data: " + self.dayData);

    // Send all to script
    self.sendSocketNotification('SUNNYPORTAL_DAY', {
        data: self.dayData
    });
  },

  processMonthData: function(self) {
    console.log("Starting function processMonthData with data: " + self.monthData);

    // Send all to script
    self.sendSocketNotification('SUNNYPORTAL_MONTH', {
        data: self.monthData
    });
  },

  processYearData: function(self) {
    console.log("Starting function processYearData with data: " + self.yearData);

    // Send all to script
    self.sendSocketNotification('SUNNYPORTAL_YEAR', {
        data: self.yearData
    });
  },

  processTotalData: function(self) {
    console.log("Starting function processTotalData with data: " + self.totalData);

    // Send all to script
    self.sendSocketNotification('SUNNYPORTAL_TOTAL', {
        data: self.totalData
    });
  },

});
