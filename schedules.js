/**
 * 
 * SCHEDULES API
 * To get data out of each campaign schedule in Google Sheets using Apps Script Execution API.
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
var TOKEN_PATH = TOKEN_DIR + 'script-nodejs-scheduleapi.json';

module.exports.get = function(req) {
  fs.readFile('schedules.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    authorize(JSON.parse(content), callAppsScript, req);
  });
}

function authorize(credentials, callback, req) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback, req);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client, req);
    }
  });
}

function getNewToken(oauth2Client, callback, req) {
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
      callback(oauth2Client, req);
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

function callAppsScript(auth, callback) {
  var scriptId = 'M5KBJi9vzg5xXbCSe6RgE3_Rgc5-H_Yf_';
  var script = google.script('v1');
  script.scripts.run({
    auth: auth,
    resource: {
    function: 'getTasks',
	  parameters: []
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
      callback(null, resp.response.result);
      return;
    }
  });
}
