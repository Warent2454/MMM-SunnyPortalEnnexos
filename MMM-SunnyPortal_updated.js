/*
 * MMM-SunnyPortalEnnexos
 * Updated for Ennexos SunnyPortal with cookie-based authentication
 * 
 * Based on original MMM-Sunnyportal by linuxtuxie
 * MIT Licensed.
 */

Module.register("MMM-SunnyPortalEnnexos", {
    defaults: {
        username: "",
        password: "",
        updateInterval: 300000, // 5 minutes
        retryDelay: 30000, // 30 seconds
        animationSpeed: 2000,
        authMethod: "cookies", // "cookies" or "browser" (not yet implemented)
        cookieFile: "cookies.txt",
        apiEndpoints: [
            "/api/v1/plants",
            "/api/v1/navigation",
            "/api/dt/plants/Plant:1/components/all/system-time/v2/properties",
            "/dashboard/data"
        ],
        showTitle: true,
        showStatus: true,
        showPower: true,
        showEnergy: true,
        showDetails: true,
        title: "Solar Portal",
        powerUnit: "W",
        energyUnit: "kWh",
        decimalPlaces: 1,
        tableClass: "small"
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.solarData = null;
        this.error = null;
        this.lastUpdate = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        
        this.scheduleUpdate();
    },

    getStyles: function() {
        return [this.file("MMM-SunnyPortal.css")];
    },

    getTranslations: function() {
        return {
            en: "translations/en.json",
            de: "translations/de.json",
            nl: "translations/nl.json",
            fr: "translations/fr.json"
        };
    },

    scheduleUpdate: function() {
        const self = this;
        
        // Clear any existing timeout
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        // Schedule next update
        this.updateTimer = setTimeout(() => {
            self.getSolarData();
        }, this.config.updateInterval);
        
        // Get initial data
        this.getSolarData();
    },

    getSolarData: function() {
        Log.info(`[${this.name}] Requesting solar data...`);
        this.sendSocketNotification("GET_SOLAR_DATA", this.config);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "SOLAR_DATA") {
            Log.info(`[${this.name}] Solar data received`);
            this.solarData = payload;
            this.error = null;
            this.lastUpdate = new Date();
            this.retryCount = 0;
            this.updateDom(this.config.animationSpeed);
            
        } else if (notification === "SOLAR_DATA_ERROR") {
            Log.error(`[${this.name}] Error: ${JSON.stringify(payload)}`);
            this.error = payload;
            this.retryCount++;
            
            // Show error and schedule retry
            this.updateDom(this.config.animationSpeed);
            
            if (this.retryCount < this.maxRetries) {
                Log.info(`[${this.name}] Retrying in ${this.config.retryDelay/1000} seconds (attempt ${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => {
                    this.getSolarData();
                }, this.config.retryDelay);
            } else {
                Log.error(`[${this.name}] Max retries reached. Check configuration and cookies.`);
            }
        }
    },

    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "sunny-portal-wrapper";

        // Show title if enabled
        if (this.config.showTitle) {
            const title = document.createElement("div");
            title.className = "sunny-portal-title";
            title.innerHTML = this.config.title;
            wrapper.appendChild(title);
        }

        // Show error state
        if (this.error) {
            const errorDiv = this.createErrorDisplay();
            wrapper.appendChild(errorDiv);
            return wrapper;
        }

        // Show loading state
        if (!this.solarData) {
            const loadingDiv = this.createLoadingDisplay();
            wrapper.appendChild(loadingDiv);
            return wrapper;
        }

        // Show solar data
        const dataDiv = this.createDataDisplay();
        wrapper.appendChild(dataDiv);

        return wrapper;
    },

    createErrorDisplay: function() {
        const errorDiv = document.createElement("div");
        errorDiv.className = "sunny-portal-error";

        const errorIcon = document.createElement("div");
        errorIcon.className = "sunny-portal-error-icon";
        errorIcon.innerHTML = "⚠️";
        errorDiv.appendChild(errorIcon);

        const errorText = document.createElement("div");
        errorText.className = "sunny-portal-error-text";
        
        if (typeof this.error === 'string') {
            errorText.innerHTML = this.error;
        } else if (this.error.type === 'authentication') {
            errorText.innerHTML = `
                <div class="error-title">Authentication Failed</div>
                <div class="error-message">${this.error.message}</div>
                <div class="error-hint">Update cookies.txt file</div>
            `;
        } else {
            errorText.innerHTML = this.error.message || "Unknown error";
        }
        
        errorDiv.appendChild(errorText);

        if (this.retryCount < this.maxRetries) {
            const retryInfo = document.createElement("div");
            retryInfo.className = "sunny-portal-retry-info";
            retryInfo.innerHTML = `Retrying... (${this.retryCount}/${this.maxRetries})`;
            errorDiv.appendChild(retryInfo);
        }

        return errorDiv;
    },

    createLoadingDisplay: function() {
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "sunny-portal-loading";
        
        const spinner = document.createElement("div");
        spinner.className = "sunny-portal-spinner";
        spinner.innerHTML = "☀️";
        loadingDiv.appendChild(spinner);
        
        const loadingText = document.createElement("div");
        loadingText.className = "sunny-portal-loading-text";
        loadingText.innerHTML = this.translate("LOADING");
        loadingDiv.appendChild(loadingText);
        
        return loadingDiv;
    },

    createDataDisplay: function() {
        const dataDiv = document.createElement("div");
        dataDiv.className = "sunny-portal-data";

        // Status indicator
        if (this.config.showStatus) {
            const statusDiv = this.createStatusDisplay();
            dataDiv.appendChild(statusDiv);
        }

        // Main data table
        const table = document.createElement("table");
        table.className = `sunny-portal-table ${this.config.tableClass}`;

        // Extract and display meaningful data
        const displayData = this.extractDisplayData(this.solarData);

        for (const [label, value] of displayData) {
            const row = document.createElement("tr");
            
            const labelCell = document.createElement("td");
            labelCell.className = "sunny-portal-label";
            labelCell.innerHTML = label;
            row.appendChild(labelCell);
            
            const valueCell = document.createElement("td");
            valueCell.className = "sunny-portal-value";
            valueCell.innerHTML = value;
            row.appendChild(valueCell);
            
            table.appendChild(row);
        }

        dataDiv.appendChild(table);

        // Last update info
        if (this.lastUpdate) {
            const updateInfo = document.createElement("div");
            updateInfo.className = "sunny-portal-update-info";
            updateInfo.innerHTML = `Last update: ${this.lastUpdate.toLocaleTimeString()}`;
            dataDiv.appendChild(updateInfo);
        }

        return dataDiv;
    },

    createStatusDisplay: function() {
        const statusDiv = document.createElement("div");
        statusDiv.className = "sunny-portal-status";
        
        const statusIcon = document.createElement("span");
        statusIcon.className = "sunny-portal-status-icon";
        statusIcon.innerHTML = "✅";
        
        const statusText = document.createElement("span");
        statusText.className = "sunny-portal-status-text";
        statusText.innerHTML = this.translate("CONNECTED");
        
        statusDiv.appendChild(statusIcon);
        statusDiv.appendChild(statusText);
        
        return statusDiv;
    },

    extractDisplayData: function(data) {
        const displayData = [];
        
        if (!data || typeof data !== 'object') {
            return [["No Data", "Available"]];
        }

        // Group data by type
        const powerData = [];
        const energyData = [];
        const otherData = [];

        for (const [key, value] of Object.entries(data)) {
            // Skip metadata fields
            if (key.startsWith('_')) continue;
            
            const keyLower = key.toLowerCase();
            const label = this.formatLabel(key);
            const formattedValue = this.formatValue(value, key);
            
            if (keyLower.includes('power') || keyLower.includes('watt')) {
                powerData.push([label, formattedValue]);
            } else if (keyLower.includes('energy') || keyLower.includes('kwh') || keyLower.includes('yield')) {
                energyData.push([label, formattedValue]);
            } else {
                otherData.push([label, formattedValue]);
            }
        }

        // Add power data first
        if (this.config.showPower && powerData.length > 0) {
            displayData.push(["Power", ""]);
            displayData.push(...powerData);
        }

        // Add energy data
        if (this.config.showEnergy && energyData.length > 0) {
            if (displayData.length > 0) displayData.push(["", ""]); // Spacer
            displayData.push(["Energy", ""]);
            displayData.push(...energyData);
        }

        // Add other data if enabled
        if (this.config.showDetails && otherData.length > 0) {
            if (displayData.length > 0) displayData.push(["", ""]); // Spacer
            displayData.push(["Details", ""]);
            displayData.push(...otherData);
        }

        // Fallback if no specific data found
        if (displayData.length === 0) {
            displayData.push(["Endpoint", data._endpoint || "Unknown"]);
            displayData.push(["Status", data._status || "Unknown"]);
            
            const dataKeys = Object.keys(data).filter(k => !k.startsWith('_'));
            if (dataKeys.length > 0) {
                displayData.push(["", ""]);
                displayData.push(["Raw Data", ""]);
                dataKeys.slice(0, 5).forEach(key => {
                    displayData.push([this.formatLabel(key), this.formatValue(data[key], key)]);
                });
            }
        }

        return displayData;
    },

    formatLabel: function(key) {
        return key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/[._]/g, ' ') // Replace dots and underscores with spaces
            .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize words
            .trim();
    },

    formatValue: function(value, key) {
        if (typeof value === 'number') {
            const keyLower = key.toLowerCase();
            
            if (keyLower.includes('power') || keyLower.includes('watt')) {
                return this.formatPowerValue(value);
            } else if (keyLower.includes('energy') || keyLower.includes('kwh')) {
                return this.formatEnergyValue(value);
            } else {
                return value.toFixed(this.config.decimalPlaces);
            }
        }
        
        return String(value);
    },

    formatPowerValue: function(watts) {
        if (watts >= 1000000) {
            return (watts / 1000000).toFixed(this.config.decimalPlaces) + " MW";
        } else if (watts >= 1000) {
            return (watts / 1000).toFixed(this.config.decimalPlaces) + " kW";
        } else {
            return watts.toFixed(this.config.decimalPlaces) + " W";
        }
    },

    formatEnergyValue: function(kwh) {
        if (kwh >= 1000) {
            return (kwh / 1000).toFixed(this.config.decimalPlaces) + " MWh";
        } else {
            return kwh.toFixed(this.config.decimalPlaces) + " kWh";
        }
    },

    suspend: function() {
        Log.info(`[${this.name}] Module suspended`);
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
    },

    resume: function() {
        Log.info(`[${this.name}] Module resumed`);
        this.scheduleUpdate();
    }
});
