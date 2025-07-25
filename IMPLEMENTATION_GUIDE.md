# Implementation Guide: Browser-Based Authentication for Ennexos

## Overview
This guide provides step-by-step instructions for implementing browser-based authentication for the MMM-SunnyPortal module to work with the new Ennexos portal.

## Prerequisites

### 1. Install Dependencies
```bash
cd /path/to/MMM-SunnyPortalEnnexos
npm install puppeteer
```

### 2. Test Browser Authentication
First, test if the browser automation works:

```bash
# Make sure your credentials are in .env file
echo "SUNNY_USERNAME=your_email@example.com" > .env
echo "SUNNY_PASSWORD=your_password" >> .env

# Run the browser test
node test-browser-auth.js
```

If successful, you should see:
- Browser window opens (unless headless)
- Screenshots saved (ennexos-login-page.png, sma-login-page.png)
- Successful authentication messages
- Cookie extraction and API testing results

## Implementation Steps

### Step 1: Update node_helper.js

Replace the authentication logic in `node_helper.js` with browser-based authentication:

```javascript
const puppeteer = require('puppeteer');

class EnnexosAuthenticator {
    constructor(config) {
        this.config = config;
        this.cookies = null;
        this.browser = null;
    }

    async authenticate() {
        try {
            this.browser = await puppeteer.launch({
                headless: true, // Run in background
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await this.browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

            // Navigate to login
            await page.goto('https://ennexos.sunnyportal.com/login', { waitUntil: 'networkidle0' });

            // Trigger authentication (adapt based on test results)
            await this.triggerAuthentication(page);

            // Handle SMA login
            if (page.url().includes('account.sma.energy')) {
                await this.handleSMALogin(page);
            }

            // Extract cookies
            this.cookies = await page.cookies();
            
            await this.browser.close();
            return true;

        } catch (error) {
            console.error('Authentication failed:', error);
            if (this.browser) await this.browser.close();
            return false;
        }
    }

    async triggerAuthentication(page) {
        // Implementation based on test-browser-auth.js findings
        // Add specific selectors found during testing
    }

    async handleSMALogin(page) {
        // Implementation based on test-browser-auth.js findings
        // Add credential filling and form submission
    }

    getCookieString() {
        if (!this.cookies) return '';
        return this.cookies
            .filter(cookie => cookie.name && cookie.value)
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');
    }
}
```

### Step 2: Update Data Fetching

Modify the data fetching logic to use authenticated cookies:

```javascript
async function fetchSolarData(authenticator) {
    const cookieString = authenticator.getCookieString();
    
    if (!cookieString) {
        throw new Error('No authentication cookies available');
    }

    const axios = require('axios');
    
    // Test multiple endpoints to find working ones
    const endpoints = [
        '/api/v1/plants',
        '/dashboard/data',
        '/api/v1/dashboard',
        '/api/powerflow/livedata'
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await axios.get(`https://ennexos.sunnyportal.com${endpoint}`, {
                headers: {
                    'Cookie': cookieString,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (response.status === 200 && response.data) {
                return response.data; // Return the first successful response
            }
        } catch (error) {
            console.log(`Endpoint ${endpoint} failed:`, error.message);
        }
    }

    throw new Error('No working API endpoints found');
}
```

### Step 3: Session Management

Add session management to handle cookie expiration:

```javascript
class SessionManager {
    constructor(authenticator) {
        this.authenticator = authenticator;
        this.lastAuth = null;
        this.authValidityHours = 8; // Adjust based on Ennexos session timeout
    }

    async ensureValidSession() {
        const now = new Date();
        
        if (!this.lastAuth || 
            (now - this.lastAuth) > (this.authValidityHours * 60 * 60 * 1000)) {
            
            console.log('Re-authenticating due to expired session');
            const success = await this.authenticator.authenticate();
            
            if (success) {
                this.lastAuth = now;
                return true;
            } else {
                throw new Error('Re-authentication failed');
            }
        }
        
        return true;
    }

    async fetchDataWithRetry() {
        try {
            await this.ensureValidSession();
            return await fetchSolarData(this.authenticator);
        } catch (error) {
            // Try re-authenticating once on error
            console.log('Data fetch failed, trying re-authentication...');
            await this.authenticator.authenticate();
            this.lastAuth = new Date();
            return await fetchSolarData(this.authenticator);
        }
    }
}
```

### Step 4: Error Handling and Logging

Add comprehensive error handling:

```javascript
const fs = require('fs');

class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level}: ${message}`;
        
        console.log(logEntry);
        
        // Optional: Save to log file
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    static error(message, error = null) {
        this.log('ERROR', message, error);
    }

    static info(message, data = null) {
        this.log('INFO', message, data);
    }
}

// Usage in authentication
try {
    const success = await authenticator.authenticate();
    if (success) {
        Logger.info('Authentication successful');
    } else {
        Logger.error('Authentication failed');
    }
} catch (error) {
    Logger.error('Authentication error', error.message);
}
```

### Step 5: Configuration

Update the module configuration to support new authentication:

```javascript
// In MMM-SunnyPortal.js
defaults: {
    username: "", // Ennexos username
    password: "", // Ennexos password
    updateInterval: 5 * 60 * 1000, // 5 minutes
    retryDelay: 30 * 1000, // 30 seconds
    maxRetries: 3,
    headless: true, // Run browser in background
    authTimeout: 30000, // 30 seconds for authentication
    sessionValidityHours: 8, // Re-authenticate every 8 hours
}
```

## Testing and Validation

### Test Authentication
```bash
node test-browser-auth.js
```

### Test API Endpoints
After successful authentication, test the API endpoints manually to verify data structure.

### Monitor Logs
Watch the MagicMirror logs for authentication and data fetching status.

## Troubleshooting

### Common Issues

1. **Browser won't start**: Install required dependencies
   ```bash
   sudo apt-get install -y chromium-browser
   ```

2. **Authentication fails**: Check credentials and manual login capability

3. **API endpoints return no data**: Monitor browser network tab during manual login to find correct endpoints

4. **Session expires quickly**: Adjust `sessionValidityHours` configuration

### Debug Mode
Set `headless: false` in configuration to see browser automation in action.

## Security Considerations

1. **Credential Storage**: Store credentials securely, never in plain text
2. **Cookie Management**: Ensure cookies are handled securely
3. **Network Security**: Use HTTPS for all communications
4. **Error Logging**: Avoid logging sensitive information

## Performance Optimization

1. **Shared Browser Instance**: Reuse browser instance across authentications
2. **Cookie Persistence**: Save cookies to file system for module restarts
3. **Conditional Authentication**: Only re-authenticate when necessary
4. **Endpoint Caching**: Cache working endpoint URLs

This implementation provides a robust, maintainable solution for authenticating with Ennexos and fetching solar data for the MagicMirror module.
