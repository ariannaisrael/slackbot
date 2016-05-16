/**
 * 
 * CAMPAIGNS API
 * To get data out of Campaign Spreadsheet in Google Sheets using Apps Script Execution API.
 *
 */

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var SCOPES = ['https://www.googleapis.com/auth/script.external_request',
'https://www.googleapis.com/auth/script.scriptapp',
'https://www.googleapis.com/auth/script.storage',
'https://www.googleapis.com/auth/spreadsheets'];

var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'script-nodejs-campaignsapi.json';

var exports = module.exports = {};

exports.get = function (rHandler) {
  fs.readFile('campaigns.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }

    authorize(JSON.parse(content), callAppsScript, rHandler);
  });
}

function authorize(credentials, callback, rHandler) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback, rHandler);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client, rHandler);
    }
  });
}

function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client, rHandler);
    });
  });
}

function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

function callAppsScript(auth, rHandler) {
  var scriptId = 'MyaudM94XcgmsbrU8_vACt_Rgc5-H_Yf_';
  var script = google.script('v1');

  script.scripts.run({
    auth: auth,
    resource: {
      function: 'getCampaigns'
    },
    scriptId: scriptId
  }, function(err, resp) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    if (resp.error) {
      var error = resp.error.details[0];
      console.log('Script error message: ' + error.errorMessage);
      console.log('Script error stacktrace:');

      if (error.scriptStackTraceElements) {
        for (var i = 0; i < error.scriptStackTraceElements.length; i++) {
          var trace = error.scriptStackTraceElements[i];
          console.log('\t%s: %s', trace.function, trace.lineNumber);
        }
      }
    } else {
      rHandler(null, resp.response.result);
      return;
    }
  });
}