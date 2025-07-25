/*
 * MMM-SunnyPortalEnnexos
 * Updated for Ennexos SunnyPortal with cookie-based authentication based on original MMM-Sunnyportal by linuxtuxie
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
    start: function() {
        console.log("Starting node helper for: " + this.name);
        this.cookieCache = null;
        this.lastCookieLoad = 0;
        this.config = null;
        this.authenticated = false;
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "GET_SOLAR_DATA") {
            this.config = payload;
            this.getSolarData(payload);
        }
    },

    /**
     * Load session cookies from file
     */
    loadCookies: function() {
        const cookieFile = path.join(__dirname, this.config.cookieFile || 'cookies.txt');
        
        try {
            if (fs.existsSync(cookieFile)) {
                const cookieString = fs.readFileSync(cookieFile, 'utf8').trim();
                if (cookieString && cookieString.length > 0) {
                    this.cookieCache = cookieString;
                    this.lastCookieLoad = Date.now();
                    console.log(`[${this.name}] ✅ Cookies loaded successfully`);
                    return cookieString;
                } else {
                    throw new Error("Cookie file is empty");
                }
            } else {
                throw new Error(`Cookie file not found: ${cookieFile}`);
            }
        } catch (error) {
            console.error(`[${this.name}] ❌ Error loading cookies:`, error.message);
            console.log(`[${this.name}] 📝 Please create ${cookieFile} with your Ennexos session cookies`);
            console.log(`[${this.name}] 📖 See IMPLEMENTATION_GUIDE_UPDATED.md for instructions`);
            return null;
        }
    },

    /**
     * Get cached cookies or reload if expired
     */
    getCookies: function() {
        // Cache cookies for 5 minutes to avoid excessive file reads
        if (this.cookieCache && (Date.now() - this.lastCookieLoad) < 300000) {
            return this.cookieCache;
        }
        return this.loadCookies();
    },

    /**
     * Main function to get solar data from Ennexos
     */
    getSolarData: function(config) {
        const self = this;
        const cookies = this.getCookies();
        
        if (!cookies) {
            this.sendAuthError("No valid cookies found. Please update cookies.txt file.");
            return;
        }

        console.log(`[${this.name}] 🌞 Fetching solar data from Ennexos portal...`);
        
        // Define endpoints to try in order of preference
        const endpoints = config.apiEndpoints || [
            '/api/v1/plants',
            '/api/v1/navigation',
            '/api/dt/plants/Plant:1/components/all/system-time/v2/properties',
            '/api/v1/powerflow/livedata',
            '/dashboard/data',
            '/live/data'
        ];

        this.tryEndpoints(endpoints, cookies, 0, config);
    },

    /**
     * Try multiple endpoints to find working solar data
     */
    tryEndpoints: function(endpoints, cookies, index, config) {
        const self = this;
        
        if (index >= endpoints.length) {
            console.log(`[${this.name}] ⚠️ All endpoints tried, no solar data found`);
            self.sendSocketNotification("SOLAR_DATA_ERROR", "No working endpoints found with solar data");
            return;
        }

        const endpoint = endpoints[index];
        const url = `https://ennexos.sunnyportal.com${endpoint}`;
        
        console.log(`[${this.name}] 🔍 Testing endpoint [${index + 1}/${endpoints.length}]: ${endpoint}`);

        const requestOptions = {
            method: 'GET',
            url: url,
            headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/html, */*',
                'Referer': 'https://ennexos.sunnyportal.com/dashboard',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000,
            validateStatus: function (status) {
                return status < 500; // Don't throw for 4xx errors
            }
        };

        axios(requestOptions)
            .then(response => {
                const contentType = response.headers['content-type'] || '';
                const dataSize = response.data ? JSON.stringify(response.data).length : 0;
                
                console.log(`[${self.name}] 📡 ${endpoint} → Status: ${response.status}, Type: ${contentType}, Size: ${dataSize}b`);
                
                if (response.status === 200) {
                    if (contentType.includes('application/json')) {
                        // Found JSON data - try to extract solar information
                        console.log(`[${self.name}] 📊 JSON data found at ${endpoint}`);
                        const solarData = self.parseSolarData(response.data, endpoint);
                        
                        if (solarData && self.hasMeaningfulData(solarData)) {
                            console.log(`[${self.name}] ✅ Solar data extracted successfully from JSON`);
                            self.sendSocketNotification("SOLAR_DATA_SUCCESS", solarData);
                            return;
                        } else {
                            console.log(`[${self.name}] ℹ️ No meaningful solar data in JSON response`);
                        }
                    } else if (contentType.includes('text/html')) {
                        // HTML response - try to extract embedded data
                        console.log(`[${self.name}] 🔍 Processing HTML response from ${endpoint}...`);
                        const extractedData = self.extractDataFromHTML(response.data, endpoint);
                        if (extractedData && self.hasMeaningfulData(extractedData)) {
                            console.log(`[${self.name}] ✅ Solar data extracted successfully from HTML`);
                            self.sendSocketNotification("SOLAR_DATA_SUCCESS", extractedData);
                            return;
                        } else {
                            console.log(`[${self.name}] ⚠️ HTML processed but no meaningful solar data found`);
                        }
                    }
                } else if (response.status === 401 || response.status === 403) {
                    console.log(`[${self.name}] 🔒 Authentication failed - cookies may have expired`);
                    self.sendAuthError("Authentication failed. Please update your cookies.txt file.");
                    return;
                } else if (response.status === 404) {
                    console.log(`[${self.name}] ❌ Endpoint not found: ${endpoint}`);
                }
                
                // Try next endpoint
                setTimeout(() => {
                    self.tryEndpoints(endpoints, cookies, index + 1, config);
                }, 500); // Small delay between requests
            })
            .catch(error => {
                if (error.code === 'ECONNABORTED') {
                    console.log(`[${self.name}] ⏰ Timeout for endpoint ${endpoint}`);
                } else if (error.response && error.response.status === 401) {
                    console.log(`[${self.name}] 🔒 Authentication failed for ${endpoint}`);
                    self.sendAuthError("Session expired. Please update your cookies.");
                    return;
                } else {
                    console.log(`[${self.name}] ❌ Error for ${endpoint}:`, error.message);
                }
                
                // Try next endpoint
                setTimeout(() => {
                    self.tryEndpoints(endpoints, cookies, index + 1, config);
                }, 500);
            });
    },

    /**
     * Parse JSON data to extract solar-related information
     */
    parseSolarData: function(data, endpoint) {
        try {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }

            const solarData = {
                _endpoint: endpoint,
                _timestamp: new Date().toISOString(),
                _status: 'success'
            };
            
            // Solar-related keywords to search for
            const solarKeywords = [
                'power', 'energy', 'production', 'current', 'voltage', 'plant', 'solar', 'pv',
                'inverter', 'generation', 'yield', 'kwh', 'kw', 'watt', 'live', 'total',
                'today', 'daily', 'monthly', 'yearly', 'accumulated', 'feed'
            ];
            
            // Recursively search object for solar data
            const searchObject = (obj, prefix = '', depth = 0) => {
                if (depth > 5 || typeof obj !== 'object' || obj === null) return;
                
                for (const [key, value] of Object.entries(obj)) {
                    const fullKey = prefix ? `${prefix}.${key}` : key;
                    const keyLower = key.toLowerCase();
                    
                    // Check if key contains solar-related terms
                    const isRelevant = solarKeywords.some(term => keyLower.includes(term));
                    
                    if (isRelevant) {
                        if (typeof value === 'number') {
                            solarData[fullKey] = value;
                        } else if (typeof value === 'string') {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                                solarData[fullKey] = numValue;
                            } else {
                                solarData[fullKey] = value;
                            }
                        }
                    }
                    
                    // Recurse into objects
                    if (typeof value === 'object' && value !== null) {
                        searchObject(value, fullKey, depth + 1);
                    }
                }
            };
            
            searchObject(data);
            
            return solarData;
            
        } catch (error) {
            console.error(`[${this.name}] ❌ Error parsing solar data:`, error.message);
            return null;
        }
    },

    /**
     * Extract data from HTML content (look for embedded JSON and text patterns)
     */
    extractDataFromHTML: function(html, endpoint) {
        try {
            console.log(`[${this.name}] 🔍 Analyzing HTML content (${html.length} chars) from ${endpoint}`);
            
            // Look for solar data in text content (numbers with units)
            const textPatterns = [
                // Power patterns: "1234 W", "12.34 kW", "1,234 W"
                /(\d+(?:[\.,]\d+)*)\s*k?W(?:att)?/gi,
                // Energy patterns: "123.45 kWh", "1,234 kWh"
                /(\d+(?:[\.,]\d+)*)\s*k?Wh/gi,
                // Voltage patterns: "234.5 V"
                /(\d+(?:[\.,]\d+)*)\s*V(?:olt)?/gi,
                // Current patterns: "12.34 A"
                /(\d+(?:[\.,]\d+)*)\s*A(?:mp)?/gi,
                // Percentage patterns: "85.5%", "100 %"
                /(\d+(?:[\.,]\d+)*)\s*%/gi
            ];

            const foundValues = {};
            let valueCount = 0;

            // Search for values in text
            for (const pattern of textPatterns) {
                const matches = html.matchAll(pattern);
                for (const match of matches) {
                    const value = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(value) && value > 0) {
                        const unit = match[0].match(/[a-zA-Z%]+/)[0];
                        const key = `value_${valueCount}_${unit.toLowerCase()}`;
                        foundValues[key] = value;
                        valueCount++;
                    }
                }
            }

            console.log(`[${this.name}] 📊 Found ${valueCount} potential values in HTML text`);

            // Look for various JSON data patterns in HTML
            const jsonPatterns = [
                /window\.data\s*=\s*(\{.*?\});/s,
                /window\.initialData\s*=\s*(\{.*?\});/s,
                /window\.APP_DATA\s*=\s*(\{.*?\});/s,
                /var\s+data\s*=\s*(\{.*?\});/s,
                /const\s+data\s*=\s*(\{.*?\});/s,
                /let\s+data\s*=\s*(\{.*?\});/s,
                /"data":\s*(\{.*?\})/s,
                /data-value="([^"]+)"/gi,
                /data-power="([^"]+)"/gi,
                /data-energy="([^"]+)"/gi,
                /<script[^>]*>[\s\S]*?(\{[\s\S]*?"power"[\s\S]*?\})[\s\S]*?<\/script>/gi,
                /<script[^>]*>[\s\S]*?(\{[\s\S]*?"energy"[\s\S]*?\})[\s\S]*?<\/script>/gi
            ];
            
            for (const pattern of jsonPatterns) {
                const matches = html.matchAll ? html.matchAll(pattern) : [html.match(pattern)].filter(Boolean);
                if (matches) {
                    for (const match of matches) {
                        if (!match[1]) continue;
                        
                        try {
                            let jsonData;
                            let jsonStr = match[1];
                            
                            // Clean up JSON string
                            if (jsonStr.includes('{')) {
                                // Extract just the JSON object
                                const startBrace = jsonStr.indexOf('{');
                                const endBrace = jsonStr.lastIndexOf('}');
                                if (startBrace >= 0 && endBrace > startBrace) {
                                    jsonStr = jsonStr.substring(startBrace, endBrace + 1);
                                }
                                
                                // Try to parse as JSON
                                jsonData = JSON.parse(jsonStr);
                            } else {
                                // Simple value
                                const value = parseFloat(jsonStr);
                                if (!isNaN(value)) {
                                    foundValues[`json_value_${Object.keys(foundValues).length}`] = value;
                                }
                            }
                            
                            if (jsonData) {
                                console.log(`[${this.name}] 🎯 Found JSON data in HTML:`, Object.keys(jsonData));
                                const solarData = this.parseSolarData(jsonData, endpoint + '-html');
                                if (solarData && this.hasMeaningfulData(solarData)) {
                                    return solarData;
                                }
                            }
                        } catch (e) {
                            // Continue to next pattern
                            console.log(`[${this.name}] ⚠️ JSON parse failed for pattern, continuing...`);
                        }
                    }
                }
            }

            // Look for table data with solar information
            const tablePattern = /<table[\s\S]*?<\/table>/gi;
            const tables = html.match(tablePattern);
            if (tables) {
                console.log(`[${this.name}] 🔍 Found ${tables.length} tables in HTML`);
                
                for (const table of tables) {
                    // Extract numbers from table cells
                    const cellPattern = /<td[^>]*>(.*?)<\/td>/gi;
                    const cells = table.matchAll ? table.matchAll(cellPattern) : [];
                    
                    for (const cell of cells) {
                        const cellText = cell[1].replace(/<[^>]*>/g, '').trim();
                        const numberMatch = cellText.match(/(\d+(?:[\.,]\d+)*)\s*(k?W[h]?|V|A|%)/i);
                        if (numberMatch) {
                            const value = parseFloat(numberMatch[1].replace(',', '.'));
                            const unit = numberMatch[2].toLowerCase();
                            if (!isNaN(value) && value > 0) {
                                foundValues[`table_${unit}_${Object.keys(foundValues).length}`] = value;
                            }
                        }
                    }
                }
            }

            // If we found any values, return them
            if (Object.keys(foundValues).length > 0) {
                console.log(`[${this.name}] ✅ Extracted ${Object.keys(foundValues).length} values from HTML:`, foundValues);
                
                // Create a more structured solar data object
                const solarData = {
                    _endpoint: endpoint,
                    _timestamp: new Date().toISOString(),
                    _status: 'success'
                };
                
                // Map found values to standard names
                for (const [key, value] of Object.entries(foundValues)) {
                    if (key.includes('kw') && !key.includes('kwh')) {
                        solarData.currentPower = value * (key.includes('kw') ? 1000 : 1);
                    } else if (key.includes('kwh')) {
                        if (!solarData.dailyEnergy || value > solarData.dailyEnergy) {
                            solarData.dailyEnergy = value;
                        }
                    } else if (key.includes('w') && !key.includes('wh')) {
                        solarData.currentPower = value;
                    } else if (key.includes('v')) {
                        solarData.voltage = value;
                    } else if (key.includes('a')) {
                        solarData.current = value;
                    } else if (key.includes('%')) {
                        solarData.efficiency = value;
                    }
                    
                    // Also keep the raw value
                    solarData[key] = value;
                }
                
                return solarData;
            }

            console.log(`[${this.name}] ⚠️ No solar data patterns found in HTML content`);
            
            // Debug: show a sample of the HTML to understand its structure
            const htmlSample = html.substring(0, 1000);
            console.log(`[${this.name}] 📄 HTML sample (first 1000 chars):`, htmlSample);
            
            return null;
        } catch (error) {
            console.error(`[${this.name}] ❌ Error extracting data from HTML:`, error.message);
            return null;
        }
    },

    /**
     * Check if extracted data contains meaningful solar information
     */
    hasMeaningfulData: function(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Count non-metadata fields
        const metadataFields = ['_endpoint', '_timestamp', '_status'];
        const dataFields = Object.keys(data).filter(key => !metadataFields.includes(key));
        
        return dataFields.length > 0;
    },

    /**
     * Send authentication error with helpful message
     */
    sendAuthError: function(message) {
        console.error(`[${this.name}] 🔐 Authentication Error: ${message}`);
        this.sendSocketNotification("SOLAR_DATA_ERROR", {
            type: "authentication",
            message: message,
            hint: "Check IMPLEMENTATION_GUIDE_UPDATED.md for cookie extraction instructions"
        });
    },

    /**
     * Create mock data for testing/fallback
     */
    createMockData: function() {
        return {
            _endpoint: 'mock',
            _timestamp: new Date().toISOString(),
            _status: 'mock',
            'power.current': Math.round(Math.random() * 5000),
            'energy.today': Math.round(Math.random() * 30),
            'energy.total': Math.round(Math.random() * 50000),
            'plant.status': 'ok'
        };
    }
});
