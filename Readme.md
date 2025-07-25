## MagicMirror Module: SunnyPortal (Ennexos)

Display your Ennexos SunnyPortal Solar Panel Inverter output

| Status | Version | Date | 
|:------- |:------- |:---- |
| Updated | 1.5.0 | 2025-07-24 |

#### What is this module doing?

*MMM-SunnyPortal* is a [MagicMirror](https://github.com/MichMich/MagicMirror) module for displaying the 
current, monthly, yearly and total power output of your SunnyPortal Solar Panels from the new Ennexos platform. 

**Note: This module has been updated to work with the new Ennexos SunnyPortal at https://ennexos.sunnyportal.com/**

### Example Screenshots

Module Screenshot:

![Full](./images/SunnyPortal1.png)

The displayed data shown above is fetched through the new Ennexos SunnyPortal website [Ennexos SunnyPortal](https://ennexos.sunnyportal.com)

![Full](./images/SunnyPortal2.png)

---

### Dependencies

This module depends on the following *npm* packages:

* [request](https://github.com/request/request)  - Simplified HTTP client
* [flow](https://github.com/willconant/flow-js)  - Makes it easy to express multi-step asynchronous logic in Node or the browser
* [chartjs](https://github.com/chartjs/Chart.js) - Simple yet flexible JavaScript charting for designers & developers.
* [axios](https://github.com/axios/axios) - Promise based HTTP client for the browser and Node.js
* [dotenv](https://github.com/motdotla/dotenv) - Loads environment variables from .env file

These are also listed in the `package.json` file and should be installed automatically when using *npm*.
However, those may require other packages. 

---

### Installation

Manual Installation:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/linuxtuxie/MMM-SunnyPortal.git
cd MMM-SunnyPortal
```

Next install the dependencies: *request*, *flow* and *chartjs*, by running:

```bash
npm install request --save
npm install flow --save
npm install chart.js --save
npm install axios --save
npm install dotenv --save

```

Alternatively, on a *unix* based distribution, you can try to install all the above mentioned dependencies with the Bash script:

```bash
chmod 755 install_deps.sh
./install_deps.sh
```

---

### Configuration 

To configure the SunnyPortal module, you need to do the following:

1. Add the Module to the global MagicMirror `config.js` 
2. Edit the global config to add the username and password values for your SunnyPortal installation
3. [optional] Modify `MMM-SunnyPortal.css` to your own CSS taste
4. [optional] Add your own language translation file in the translations folder (currently english, dutch, french and german are provided)


Add this module to the modules array in the `config/config.js` file by adding the following example section.<br>You must include your SunnyPortal username and password, you can edit the config to include any of the configuration options described below. 

```javascript
{
    module: 'MMM-SunnyPortal',
    position: 'bottom_left',
    header: 'Solar Panels',
    config: {
    	url: 'https://ennexos.sunnyportal.com',
        updateInterval: 900,
        username: '',             //Required: Your Ennexos SunnyPortal Username
        password: '',             //Required: Your Ennexos SunnyPortal Password
        width: 500,
        height: 400,
        chartcolor1: '#121212',
        chartcolor2: '#909090',
        convertUnits: true,
        includeGraphs: ['all'],
    }
},
```

---

#### Configuration Options 

| Option            | Description  |
|:----------------- |:------------ | 
| url               | An alternative URL to the Ennexos SunnyPortal website.<br>*Optional*<br>*Default value:* https://ennexos.sunnyportal.com |
| updateInterval    | Module data update rate. [in seconds]<br>*Optional*<br>*Default and minimum value:* `900` (a lower value is ignored)|
| username          | Your Ennexos SunnyPortal `'Username'`<br>**Required** |
| password          | Your Ennexos SunnyPortal `'Password'`<br>**Required** |
| width             | The width of the module.<br>*Optional*<br>*Default value:* `500` |
| height            | The height of the module.<br>*Optional*<br>*Default value:* `400` |
| chartcolor1<br>chartcolor2 | The graphs have a gradient color. You can set chartcolor1 and chartcolor2 to any HEX code, HTML name or RGB code.<br>Set both to the same color code to have a solid graph without a gradient.<br>*Optional, example values:* `'red'`, `'#FF00FF'`, `'rgb(255,255,255)'`<br>*Default values:* chartcolor1: `'#121212'`, chartcolor2: `'#909090'` |
| convertUnits      | Convert kwH to MWh if needed<br>*Optional, possible values:* `true`, `false`<br>*Default value:* `true` |
| includeGraphs     | Takes an array with the graphs to include.<br>The array can have 1, 2, 3 or 4 elements.<br>Using `['All']` is equal to `['Day', 'Month', 'Year', 'Total']`<br>Example: `['Month', 'Day']` displays the 2 graphs in that order<br>*Possible values:* `['all']` or any combination of `['day', 'month', 'year', 'total']` (case insensitive)<br>*Default* `['All']`|

> :warning: Please do not edit the module files to use an **updateInterval** shorter than 15 minutes (900 seconds).
> A lower setting can lockout your account on the SunnyPortal URL. The power output on SMA SunnyPortal is always
> calculated in a time interval of 15 minutes...so there is no need to update in a shorter time interval!
> There is a check to have a minimum value of 900 seconds. Any lower value is ignored.

#### Contribution

Feel free to post issues or remarks related to this module.  
For all other or general questions, please refer to the [MagicMirror Forum](https://forum.magicmirror.builders/).

#### Credits
I based the code on mkorthuis's [sunnyportal-api](https://github.com/mkorthuis/sunnyportal-api/)

#### License 

[MIT License](https://github.com/linuxtuxie/MMM-SunnyPortal/blob/master/LICENSE) 

