# Ennexos Authentication Analysis Summary

## Overview
After extensive testing and analysis, we've discovered that Ennexos (https://ennexos.sunnyportal.com) uses a modern Single Page Application (SPA) architecture with client-side JavaScript authentication that cannot be easily replicated through server-side HTTP requests.

## Key Findings

### 1. Architecture Analysis
- **SPA Design**: All routes return the same 50070-byte HTML page containing the JavaScript application
- **Client-Side Routing**: Authentication is handled entirely by JavaScript in the browser
- **No Server-Side Auth**: No HTTP redirects or server-side authentication endpoints found

### 2. Authentication Discovery Results
- **Form Analysis**: Found forms with `method="get"` and `action="/"` - purely for JavaScript handling
- **Endpoint Testing**: All auth endpoints (`/auth/login`, `/auth/sma`, `/sso/sma`, etc.) return the same SPA
- **Parameter Testing**: No URL parameters trigger server-side authentication redirects
- **POST Methods**: Blocked with 405 Method Not Allowed errors

### 3. SMA Integration
- **No Direct Redirects**: No automatic redirects to account.sma.energy found
- **JavaScript Triggered**: SMA authentication likely triggered by specific JavaScript events
- **Browser Required**: Requires full browser environment to execute authentication JavaScript

## Technical Implications

### For MagicMirror Module
The current approach of using Node.js HTTP requests won't work because:
1. Ennexos requires JavaScript execution to trigger authentication
2. The authentication flow needs a browser environment
3. SMA redirects are handled by client-side JavaScript, not server responses

## Recommended Solutions

### Option 1: Browser Automation (Recommended)
Use a headless browser to automate the authentication process:

```javascript
// Using Puppeteer or Playwright
const puppeteer = require('puppeteer');

async function authenticateEnnexos(username, password) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto('https://ennexos.sunnyportal.com/login');
    
    // Wait for and click the login button/trigger
    await page.waitForSelector('button[contains(text(), "Login")]');
    await page.click('button[contains(text(), "Login")]');
    
    // Handle SMA authentication
    await page.waitForNavigation();
    await page.type('#username', username);
    await page.type('#password', password);
    await page.click('#login-button');
    
    // Extract cookies after successful authentication
    const cookies = await page.cookies();
    await browser.close();
    
    return cookies;
}
```

### Option 2: Manual Session Management
1. User manually logs in to Ennexos in their browser
2. Extract session cookies from browser
3. Use cookies in the MagicMirror module
4. Refresh cookies periodically

### Option 3: Official API
Contact Ennexos/SMA support to request:
- Official API documentation
- Direct API access credentials
- Integration guidelines for third-party applications

## Next Steps

### Immediate Actions
1. **Test Browser Automation**: Implement Puppeteer-based authentication
2. **Session Management**: Create cookie extraction and refresh mechanism
3. **API Discovery**: Find actual data endpoints that work with authenticated sessions

### MagicMirror Integration
1. **Update Dependencies**: Add Puppeteer to package.json
2. **Modify node_helper.js**: Implement browser-based authentication
3. **Add Configuration**: Allow users to provide credentials securely
4. **Error Handling**: Manage authentication failures and session expiry

## Test Results Archive

### Successful Discoveries
- ✅ Confirmed Ennexos connectivity
- ✅ Identified SPA architecture
- ✅ Found authentication endpoint patterns
- ✅ Confirmed SMA integration exists (references in JS)

### Failed Approaches
- ❌ Direct HTTP authentication
- ❌ Server-side redirects
- ❌ Parameter-based auth triggers
- ❌ Form-based login submission

## Conclusion

Ennexos requires a browser-based authentication approach due to its modern SPA architecture. The most viable solution for the MagicMirror module is to implement headless browser automation for the initial authentication, then use the resulting session cookies for API access.

This approach, while more complex than simple HTTP requests, will provide a reliable way to authenticate with Ennexos and access the solar data for the MagicMirror display.
