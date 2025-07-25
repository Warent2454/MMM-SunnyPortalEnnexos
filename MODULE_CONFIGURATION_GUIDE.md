# MMM-SunnyPortalEnnexos Configuration Guide

## Overview
This updated version of MMM-SunnyPortal works with the new Ennexos SunnyPortal platform using cookie-based authentication. This guide will help you configure and deploy the module.

## Installation

### 1. Replace Module Files
Replace these files in your MagicMirror modules directory:

```bash
# Copy updated files
cp MMM-SunnyPortal_updated.js MMM-SunnyPortal.js
cp node_helper_updated.js node_helper.js
```

### 2. Configure Module
Add this configuration to your MagicMirror `config.js`:

```javascript
{
    module: "MMM-SunnyPortalEnnexos",
    position: "top_right", // or your preferred position
    config: {
        // Authentication (required)
        username: "your-ennexos-username",
        password: "your-ennexos-password", // Only needed for future automation
        cookieFile: "cookies.txt", // Path relative to module directory
        
        // Update intervals (optional)
        updateInterval: 300000, // 5 minutes (in milliseconds)
        retryDelay: 30000, // 30 seconds
        
        // Display options (optional)
        showTitle: true,
        showStatus: true,
        showPower: true,
        showEnergy: true,
        showDetails: true,
        title: "Solar Portal",
        
        // Formatting options (optional)
        powerUnit: "W",
        energyUnit: "kWh",
        decimalPlaces: 1,
        tableClass: "small", // or "medium", "large"
        
        // API endpoints to try (optional - uses defaults if not specified)
        apiEndpoints: [
            "/api/v1/plants",
            "/api/v1/navigation",
            "/api/dt/plants/Plant:1/components/all/system-time/v2/properties",
            "/dashboard/data"
        ]
    }
}
```

## Cookie Setup

### Required Step: Extract Cookies
You must extract cookies from your browser session to authenticate with Ennexos:

1. **Login to Ennexos**
   - Go to https://ennexos.sunnyportal.com/
   - Log in with your credentials
   - Wait for the dashboard to fully load

2. **Extract Cookies**
   - Open browser developer tools (F12)
   - Go to Application/Storage → Cookies → https://ennexos.sunnyportal.com
   - Find these important cookies:
     - `connect.sid` (session ID)
     - `JSESSIONID` (Java session)
     - Any other authentication cookies

3. **Create cookies.txt File**
   Create a file called `cookies.txt` in your module directory:
   ```
   connect.sid=s%3AXXXXX.XXXXX; Path=/; Domain=.ennexos.sunnyportal.com; HttpOnly; Secure
   JSESSIONID=XXXXX; Path=/; Domain=.ennexos.sunnyportal.com; HttpOnly
   ```

4. **Alternative: Use Browser Extension**
   - Install "Get cookies.txt" extension
   - Export cookies for ennexos.sunnyportal.com
   - Save as `cookies.txt` in module directory

## Configuration Options Explained

### Authentication Options
- `cookieFile`: Path to your cookies file (required)
- `username`/`password`: For future automated login (not currently used)

### Display Options
- `showTitle`: Show module title
- `showStatus`: Show connection status indicator
- `showPower`: Show power generation data
- `showEnergy`: Show energy/yield data
- `showDetails`: Show additional system details

### Visual Customization
- `title`: Custom title for the module
- `tableClass`: Size of the data table ("small", "medium", "large")
- `decimalPlaces`: Number of decimal places for numeric values
- `powerUnit`/`energyUnit`: Units for display

### Performance Options
- `updateInterval`: How often to fetch new data (milliseconds)
- `retryDelay`: Delay before retrying failed requests
- `apiEndpoints`: List of API endpoints to try

## Troubleshooting

### No Data Displayed
1. Check that `cookies.txt` exists and contains valid session cookies
2. Verify cookies are not expired (re-extract if needed)
3. Check MagicMirror logs for authentication errors

### Authentication Errors
1. Re-login to Ennexos in your browser
2. Extract fresh cookies
3. Update `cookies.txt` file
4. Restart MagicMirror

### Connection Issues
1. Verify internet connection
2. Check if Ennexos portal is accessible
3. Try reducing `updateInterval` temporarily

### Performance Issues
1. Increase `updateInterval` to reduce API calls
2. Reduce number of `apiEndpoints`
3. Check network connectivity

## Log Messages

The module provides detailed logging. Common messages:

- `✅ Authentication successful` - Cookies are working
- `⚠️ Authentication failed` - Need to update cookies
- `🔄 Retrying...` - Temporary connection issue
- `📊 Data received` - Successfully got solar data

## Cookie Maintenance

### Automatic Cookie Refresh (Future Enhancement)
The current version requires manual cookie updates. Future versions may include:
- Automated browser session refresh
- Cookie expiration detection
- Automatic re-authentication

### Manual Cookie Updates
- Cookies typically expire after 24-48 hours
- Re-extract cookies when authentication fails
- Consider setting up a daily cron job for cookie extraction

## API Endpoints

The module tries multiple endpoints to find working data:

1. **Plant Information**: `/api/v1/plants`
2. **Navigation Data**: `/api/v1/navigation`
3. **System Properties**: `/api/dt/plants/Plant:1/components/all/system-time/v2/properties`
4. **Dashboard Data**: `/dashboard/data`

You can customize the endpoints list in your configuration.

## Security Notes

### Cookie Security
- Keep `cookies.txt` file secure and private
- Don't commit cookies to version control
- Regularly update cookies for security

### Network Security
- Module communicates over HTTPS
- Cookies are transmitted securely
- No credentials stored in plain text (except in cookies.txt)

## CSS Customization

You can customize the appearance by modifying `MMM-SunnyPortal.css`:

```css
.sunny-portal-wrapper {
    /* Custom styling */
}

.sunny-portal-error {
    color: red;
    font-weight: bold;
}

.sunny-portal-status-icon {
    font-size: 1.2em;
}
```

## Support and Updates

For issues or updates:
1. Check the implementation guide for detailed troubleshooting
2. Verify your cookies are current and valid
3. Check MagicMirror logs for error details
4. Test endpoints manually using the test scripts

## File Structure

Your module directory should contain:
```
MMM-SunnyPortalEnnexos/
├── MMM-SunnyPortal.js          # Main module file
├── node_helper.js              # Backend data fetcher
├── MMM-SunnyPortal.css        # Styling
├── cookies.txt                 # Your authentication cookies
├── package.json               # Dependencies
├── translations/              # Language files
│   ├── en.json
│   ├── de.json
│   ├── fr.json
│   └── nl.json
└── README.md                  # Documentation
```

Remember: The most important step is keeping your `cookies.txt` file updated with valid session cookies from your Ennexos login!
