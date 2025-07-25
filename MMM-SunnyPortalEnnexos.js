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
        updateInterval: 1800000, // 30 minutes
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
        showDaily: true,
        showMonthly: true,
        showYearly: true,
        showTotal: true,
        showLastUpdate: true,
        showVoltage: true,
        showCurrent: true,
        showEfficiency: true,
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
        
        this.scheduleUpdate(true); // true = allow immediate first load
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

    scheduleUpdate: function(immediate = false) {
        const self = this;
        
        // Clear any existing timeout
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        // If immediate is true, get data now, otherwise wait for the interval
        if (immediate && !this.solarData) {
            // Only get immediate data if we don't have any data yet
            setTimeout(() => {
                self.getSolarData();
            }, 2000); // 2 second delay even for initial load
        }
        
        // Schedule next update
        this.updateTimer = setTimeout(() => {
            self.getSolarData();
        }, this.config.updateInterval);
    },

    getSolarData: function() {
        Log.info(`[${this.name}] Requesting solar data...`);
        this.sendSocketNotification("GET_SOLAR_DATA", this.config);
    },

    socketNotificationReceived: function(notification, payload) {
        Log.info(`[${this.name}] Received notification: ${notification}`);
        
        if (notification === "SOLAR_DATA_SUCCESS") {
            this.solarData = payload;
            this.error = null;
            this.lastUpdate = new Date();
            this.retryCount = 0;
            this.updateDom();
            
            // Schedule next update (no immediate call)
            this.scheduleUpdate(false);
            
        } else if (notification === "SOLAR_DATA_ERROR") {
            this.error = payload;
            this.retryCount++;
            
            Log.error(`[${this.name}] Error: ${payload.message}`);
            
            if (this.retryCount < this.maxRetries) {
                // Retry with exponential backoff - minimum 60 seconds
                const retryDelay = Math.max(60000, Math.min(30000 * Math.pow(2, this.retryCount), 300000)); // Min 1 minute, Max 5 minutes
                Log.info(`[${this.name}] Retry ${this.retryCount}/${this.maxRetries} in ${retryDelay/1000} seconds`);
                
                setTimeout(() => {
                    this.getSolarData();
                }, retryDelay);
            } else {
                Log.error(`[${this.name}] Max retries reached. Scheduling next regular update.`);
                this.scheduleUpdate(false); // No immediate call
            }
            
            this.updateDom();
        }
    },

    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "bright medium";

        // Show title if configured
        if (this.config.showTitle) {
            const title = document.createElement("div");
            title.className = "module-header";
            title.innerHTML = this.config.title || this.translate("MODULE_TITLE");
            wrapper.appendChild(title);
        }

        // Show error if present
        if (this.error) {
            const errorDiv = document.createElement("div");
            errorDiv.className = "error";
            errorDiv.innerHTML = `⚠️ ${this.error.message}`;
            if (this.retryCount > 0) {
                errorDiv.innerHTML += ` (Retry ${this.retryCount}/${this.maxRetries})`;
            }
            wrapper.appendChild(errorDiv);
            
            if (!this.solarData) {
                return wrapper;
            }
        }

        // Show loading if no data yet
        if (!this.solarData) {
            const loading = document.createElement("div");
            loading.className = "loading";
            loading.innerHTML = "🔄 " + this.translate("LOADING");
            wrapper.appendChild(loading);
            return wrapper;
        }

        // Create data table
        const table = document.createElement("table");
        table.className = "solar-data";

        // Current power
        if (this.config.showPower && this.solarData.currentPower !== undefined) {
            const row = this.createDataRow(
                this.translate("CURRENT_POWER"), 
                this.formatPower(this.solarData.currentPower)
            );
            table.appendChild(row);
        }

        // Daily energy
        if (this.config.showDaily && this.solarData.dailyEnergy !== undefined) {
            const row = this.createDataRow(
                this.translate("DAILY_ENERGY"), 
                this.formatEnergy(this.solarData.dailyEnergy)
            );
            table.appendChild(row);
        }

        // Monthly energy
        if (this.config.showMonthly && this.solarData.monthlyEnergy !== undefined) {
            const row = this.createDataRow(
                this.translate("MONTHLY_ENERGY"), 
                this.formatEnergy(this.solarData.monthlyEnergy)
            );
            table.appendChild(row);
        }

        // Yearly energy
        if (this.config.showYearly && this.solarData.yearlyEnergy !== undefined) {
            const row = this.createDataRow(
                this.translate("YEARLY_ENERGY"), 
                this.formatEnergy(this.solarData.yearlyEnergy)
            );
            table.appendChild(row);
        }

        // Total energy
        if (this.config.showTotal && this.solarData.totalEnergy !== undefined) {
            const row = this.createDataRow(
                this.translate("TOTAL_ENERGY"), 
                this.formatEnergy(this.solarData.totalEnergy)
            );
            table.appendChild(row);
        }

        // System voltage
        if (this.config.showVoltage && this.solarData.voltage !== undefined) {
            const row = this.createDataRow(
                "System Voltage", 
                this.formatVoltage(this.solarData.voltage)
            );
            table.appendChild(row);
        }

        // System current
        if (this.config.showCurrent && this.solarData.current !== undefined) {
            const row = this.createDataRow(
                "System Current", 
                this.formatCurrent(this.solarData.current)
            );
            table.appendChild(row);
        }

        // System efficiency
        if (this.config.showEfficiency && this.solarData.efficiency !== undefined) {
            const row = this.createDataRow(
                "Efficiency", 
                this.solarData.efficiency.toFixed(1) + "%"
            );
            table.appendChild(row);
        }

        // If no standard data, show some raw values for debugging
        if (table.children.length === 0 && this.solarData) {
            const dataKeys = Object.keys(this.solarData).filter(key => !key.startsWith('_'));
            if (dataKeys.length > 0) {
                // Show first few meaningful values
                for (let i = 0; i < Math.min(5, dataKeys.length); i++) {
                    const key = dataKeys[i];
                    const value = this.solarData[key];
                    if (typeof value === 'number' && value > 0) {
                        const row = this.createDataRow(
                            key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                            this.formatValue(value, key)
                        );
                        table.appendChild(row);
                    }
                }
            }
        }

        wrapper.appendChild(table);

        // Show last update time
        if (this.config.showLastUpdate && this.lastUpdate) {
            const updateDiv = document.createElement("div");
            updateDiv.className = "last-update";
            updateDiv.innerHTML = this.translate("LAST_UPDATE") + ": " + 
                                this.lastUpdate.toLocaleTimeString();
            wrapper.appendChild(updateDiv);
        }

        return wrapper;
    },

    createDataRow: function(label, value) {
        const row = document.createElement("tr");
        
        const labelCell = document.createElement("td");
        labelCell.className = "label";
        labelCell.innerHTML = label;
        row.appendChild(labelCell);
        
        const valueCell = document.createElement("td");
        valueCell.className = "value";
        valueCell.innerHTML = value;
        row.appendChild(valueCell);
        
        return row;
    },

    formatPower: function(power) {
        if (power === null || power === undefined) return "-";
        
        if (power >= 1000) {
            return (power / 1000).toFixed(2) + " kW";
        }
        return power.toFixed(0) + " W";
    },

    formatEnergy: function(energy) {
        if (energy === null || energy === undefined) return "-";
        
        if (energy >= 1000) {
            return (energy / 1000).toFixed(2) + " MWh";
        }
        return energy.toFixed(2) + " kWh";
    },

    formatVoltage: function(voltage) {
        if (voltage === null || voltage === undefined) return "-";
        
        if (voltage >= 1000) {
            return (voltage / 1000).toFixed(2) + " kV";
        }
        return voltage.toFixed(1) + " V";
    },

    formatCurrent: function(current) {
        if (current === null || current === undefined) return "-";
        
        if (current >= 1000) {
            return (current / 1000).toFixed(2) + " kA";
        }
        return current.toFixed(1) + " A";
    },

    formatValue: function(value, key) {
        if (value === null || value === undefined) return "-";
        
        const keyLower = key.toLowerCase();
        
        if (keyLower.includes('v') && keyLower.includes('voltage')) {
            return this.formatVoltage(value);
        } else if (keyLower.includes('a') && keyLower.includes('current')) {
            return this.formatCurrent(value);
        } else if (keyLower.includes('w') && !keyLower.includes('wh')) {
            return this.formatPower(value);
        } else if (keyLower.includes('wh') || keyLower.includes('energy')) {
            return this.formatEnergy(value);
        } else if (keyLower.includes('%') || keyLower.includes('percentage')) {
            return value.toFixed(1) + "%";
        } else if (keyLower.includes('_v')) {
            return this.formatVoltage(value);
        } else if (keyLower.includes('_a')) {
            return this.formatCurrent(value);
        } else {
            return value.toFixed(1);
        }
    }
});
  
