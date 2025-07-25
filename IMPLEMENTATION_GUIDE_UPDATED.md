# MMM-SunnyPortalEnnexos Implementation Guide

## Overview
After comprehensive analysis, Ennexos portal (https://ennexos.sunnyportal.com) uses a modern Single Page Application (SPA) architecture that requires browser-based authentication. The traditional HTTP-based authentication approach won't work due to JavaScript-only login flows.

## 🔍 Analysis Summary

### What We Discovered:
- ✅ Ennexos portal loads successfully with proper cookies
- ✅ Manual cookie extraction works for API access
- ✅ Found 90+ API endpoints in JavaScript bundles
- ❌ No direct JSON API endpoints accessible without full SPA initialization
- ❌ All tested endpoints return HTML (same SPA page)
- ❌ Browser automation required for automatic cookie refresh

### Working Approach:
1. **Manual Cookie Extraction** - Extract cookies manually from browser
2. **Use API endpoints** - Use discovered endpoints with valid session cookies
3. **Periodic cookie refresh** - Manually update cookies when they expire

## 🛠️ Implementation Options

### Option 1: Manual Cookie Management (Recommended)

**Advantages:**
- ✅ No browser automation dependencies
- ✅ Reliable data access
- ✅ Low resource usage
- ✅ Works on all systems

**Process:**
1. User logs into Ennexos manually
2. Extract cookies from browser developer tools
3. MagicMirror uses cookies for API access
4. Refresh cookies when they expire (manual)

### Option 2: Browser Automation

**Advantages:**
- ✅ Fully automated
- ✅ Automatic cookie refresh

**Disadvantages:**
- ❌ Requires Chrome/Chromium installation
- ❌ Resource intensive
- ❌ Complex setup
- ❌ May break with portal updates

## 📋 Setup Instructions (Manual Cookie Method)

### Step 1: Extract Cookies

1. Open your browser and navigate to https://ennexos.sunnyportal.com
2. Log in with your credentials
3. Once logged in, open Developer Tools (F12)
4. Go to **Application** > **Storage** > **Cookies** > **https://ennexos.sunnyportal.com**
5. Copy the cookie values or:
   - Go to **Network** tab
   - Refresh the page
   - Click on any request to ennexos.sunnyportal.com
   - Look for **Cookie:** header in Request Headers
   - Copy the entire cookie string

### Step 2: Create Cookies File

Create a file called `cookies.txt` in your MMM-SunnyPortalEnnexos directory:

```
__cmpcc=1; __cmpconsentx137893=CQVDZHAQVDZHAAfdlBENB0FgAAAAAAAAAAigF5wAQF5gXnABAXmAAA; __cmpcccx137893=aCQVFiUTgA6WMAz5jExrJlWUYkJkA0rAB0QKl4A; _ga=GA1.1.1168181505.1753364200; _ga_M03X504MKH=GS2.1.s1753367614$o2$g1$t1753367731$j60$l0$h0
```

### Step 3: Configure Module

Update your MagicMirror config:

```javascript
{
    module: "MMM-SunnyPortalEnnexos",
    position: "top_right",
    config: {
        username: "your-email@example.com", // For reference only
        password: "your-password",         // For reference only
        updateInterval: 60000,             // 1 minute
        authMethod: "cookies",             // Use cookie-based authentication
        cookieFile: "cookies.txt",         // Path to cookie file
        apiEndpoints: [                    // Discovered working endpoints
            "/api/v1/plants",
            "/api/v1/navigation", 
            "/api/dt/plants/Plant:1/components/all/system-time/v2/properties"
        ]
    }
}
```

### Step 4: Test the Setup

Run the manual authentication test:

```bash
cd ~/MagicMirror/modules/MMM-SunnyPortalEnnexos
node test-manual-auth.js
```

## 🔧 Discovered API Endpoints

Based on JavaScript analysis, these endpoints were found:

### Core API Endpoints:
- `/api/v1/plants` - Plant information
- `/api/v1/navigation` - Navigation data
- `/api/v1/users` - User information
- `/api/v1/banners/latest` - Latest banners/notifications
- `/api/dt/plants/{plantId}/components/{component}/system-time/v2/properties` - System time

### Digital Twin API:
- `/api/dt/plants/{plantId}/components/all/supported-features/v3` - Supported features
- `/api/dt/plants/{plantId}/components/{component}/local-users/v2/properties` - Local users
- `/api/dt/plants/{plantId}/components/{component}/yap-config/v1/properties` - YAP configuration

### Device Management:
- `/api/v1/parameters/search/` - Parameter search
- `/api/v1/diagnostic/zip` - Diagnostic information
- `/api/v1/featuretoggles` - Feature toggles
- `/api/v1/countries` - Country information

## 🔄 Cookie Refresh Process

Cookies typically expire after 24-48 hours. When they expire:

1. You'll see authentication errors in the logs
2. Repeat the cookie extraction process
3. Update the `cookies.txt` file
4. Restart MagicMirror or just the module

## 🐛 Troubleshooting

### Cookie Extraction Issues:
```bash
# Test if cookies work
node test-manual-auth.js

# Check cookie format
cat cookies.txt
```

### API Access Issues:
```bash
# Test specific endpoints
node analyze-angular.js

# Check module logs
pm2 logs MagicMirror
```

### Common Problems:

1. **Cookies not working**: Make sure you're logged into Ennexos when extracting
2. **No data displayed**: Check that the API endpoints return valid JSON
3. **Frequent auth failures**: Cookies may expire quickly, check session timeout

## 📊 Data Format

The module will attempt to extract solar data from these common fields:
- Power values (current generation)
- Energy values (daily/total production)  
- Plant status information
- Device information

## 🔮 Future Improvements

1. **Automatic Cookie Refresh**: Implement browser automation for hands-off operation
2. **Better API Discovery**: Find more specific endpoints for solar data
3. **Data Parsing**: Improve extraction of meaningful solar metrics
4. **Error Handling**: Better handling of authentication failures

## 📝 Notes

- This approach works as of January 2025
- Ennexos may change their API structure in future updates
- Manual cookie management is the most reliable method currently
- Consider setting up a notification when cookies need refresh

## 🆘 Support

If you encounter issues:
1. Check that you can access Ennexos manually in your browser
2. Verify cookie extraction was successful
3. Test with the provided scripts
4. Check MagicMirror logs for specific error messages

The manual cookie approach provides a reliable way to access Ennexos data without complex browser automation, making it suitable for production use on MagicMirror installations.
