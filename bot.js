/*

   ____    __  __  ______  ____    ____    ____     _____   ______
  /\  _`\ /\ \/\ \/\  _  \/\  _`\ /\  _`\ /\  _`\  /\  __`\/\__  _\
  \ \,\L\_\ \ \_\ \ \ \L\ \ \ \L\ \ \ \L\ \ \ \L\ \\ \ \/\ \/_/\ \/
   \/_\__ \\ \  _  \ \  __ \ \ ,  /\ \ ,__/\ \  _ <'\ \ \ \ \ \ \ \
    /\ \L\ \ \ \ \ \ \ \/\ \ \ \\ \\ \ \/  \ \ \L\ \\ \ \_\ \ \ \ \
    \ `\____\ \_\ \_\ \_\ \_\ \_\ \_\ \_\   \ \____/ \ \_____\ \ \_\
     \/_____/\/_/\/_/\/_/\/_/\/_/\/ /\/_/    \/___/   \/_____/  \/_/

*/

var os = require('os');
var async = require('async');
var Botkit = require('./lib/Botkit.js');
var JsonDB = require('node-json-db');
var schedules = require('./schedules.js');
var campaigns = require('./campaigns.js');
var dotenv = require('dotenv'); // Requires

// Load environment variables to get Slack API bot token.
dotenv.load();

var controller = Botkit.slackbot({
	debug: false
});

var bot = controller.spawn({
	token: process.env.BOT_TOKEN
}).startRTM(function (err, bot, payload) {
	if (err) console.log(err);
	store(payload, 'slack');


var db = new JsonDB('db', true);

/*~~~~~~~~~~~~~~~~~~~~~~~~~CALLS~~~~~~~~~~~~~~~~~~~~~~~~~~*/

startTaskCheck();

// Gets tasks due for the day and intitiates convo w/ prompt to confirm.
function startTaskCheck(callback) {
	async.auto({
	tasks: function(callback) {
		schedules.get(function (err, tasks) {
			var outbox = {};
			async.each(tasks, function(t, cb) {
				var id = getUserId(t.am);
				if(!outbox.hasOwnProperty(id)) {
					outbox[id] = [];
				}
				outbox[id].push(t);
				cb(null);

			}, function(err) {
				callback(null, outbox);
			});
		});
	},
	channels: ['tasks', function(results, callback) {
		var ids = Object.keys(results.tasks);
		var dir = {};
		async.each(ids, function(id, cb) {
			dir[id] = getDMId(id);
			cb(null);
		}, function(err) {
			if(err) console.log(err);
			callback(null, dir);
		});
		
	}],
	prompt: ['channels', function(results, callback) {
		var ids = results.channels;
		async.each(ids, function(id, cb) {
			sendMessages([
				"Hello there!",
				"Please confirm the status of your schedule tasks due today.",
				"*Type `update schedules` to get started.*"], id);
			cb(null);
		}, function(err) {
			if(err) console.log(err);
			callback(null);
		});
	}]
}, function(err, result) {
	if(err) console.log(err);
	if(typeof callback === 'function') callback(null);
});
}
function sendMessages(arr, c, callback) {
	async.eachSeries(arr, function(m, cb) {
		bot.typeMessage({channel:c, text:m}, cb);
		
	}, function(err) {
		if(err) console.log(err);
		if(typeof callback === 'function') callback(null);
	});
}
function taskAttachment(t) {
	return {
		'fields': [field('Campaign', '<' + getSheetsUrl(t.gkey) + '|' + t.campaign +
			'>'), field('Action', t.action), field('Task', t.task)],
		'color': '#e74c3c'
	};} 
function store(data, name, temp) {
	try {
		var p = (name) ? '/' + name : '/';
		(temp) ? cache.push(p, data): db.push(p, data);
		return true;
	} catch (err) {
		console.log(err);
		return false;
	}
	return true;
}
function find(data, obj, prop) {
	var key = Object.keys(obj)[0];
	var val = obj[key];
	for (var i = 0; i < data.length; i++) {
		if (data[i][key] === val) {
			return (prop) ? data[i][prop] : data[i];
		}
	}
	console.log('Could not find value in data.');
	return false;
}
function findAll(data, obj, prop) {
	var key = Object.keys(obj)[0];
	var val = obj[key];
	data.filter(function (t) {
		return isMatch(t.key, val);
	});
	return data;
}
function log(err, result) {
	if (err) {
		console.log(err);
	}
	console.log(result);
	return;
}
function isMatch(a, b) {
	if (a === b) {
		return true;
	} else {
		return false;
	}
}
function getUserId(name) {
	var data = db.getData('/slack/users');
	var id = find(data, {
		'name': name
	}, 'id');
	return id;
}
function getDMId(userid, callback) {
	try {
		var data = db.getData('/slack/ims');
		var id = find(data, {
			'user': userid
		}, 'id');
		return id;
	} catch (e) {
		if (e.name === 'DataError') {
			fetchDMid(userid, function (result) {
				getDMId(userid);
				callback(null, dm);
			});
		} else {
			console.log(e);
		}
	}
}
function fetchDMId(userid, callback) {
	bot.api.im.open({
		"user": userid
	}, function (err, response) {
		if (err) {
			console.log(err)
		};
		store(response, '/slack/ims[]');
		if (typeof callback === 'function') {
			callback(null);
		}
	});
}
function getSheetsUrl(key) {
	var url = 'https://docs.google.com/spreadsheets/d/' + key + '/edit';
	return url;
}
function field(title, value) {
	var f = {};
	if (value.length < 20) {
		f['short'] = true;
	} else {
		f['short'] = false;
	}
	f['title'] = title;
	f['value'] = value;
	return f;
}
function toTitleCase(str) {
	var res = str.replace(/\w\S*/g, function (txt) {
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});
	return res;
}

var ResourceComment = {
	'comment': [],
	'tag': function (name) {
		return '[~' + name.toLowerCase() + ']';
	},
	'add': function (prop, val) {
		comment.push("*" + prop + "*: " + val + "\n");
	},
	'fields': ['Designer', 'Planned Time (hrs)', 'Estimate By', 'Task',
		'Internal Due Date', 'Client Due Date', 'Comment', 'CC'
	],
	'type': ['design', 'ux']
}

bot.typeReply = function (message, response, callback) {
		console.log("Sending: " + response.text)
		var text = (typeof response === 'string') ? response : response.text;
		var time = (text.length) * 500;
		var length = (time > 5000) ? 5000 : time;
		setTimeout(function () {
			bot.startTyping(message);
			setTimeout(function () {
				bot.reply(message, response, callback);
			}, length);
		}, 1000);
	}
bot.typeMessage = function (message, callback) {
		var time = (message.text.length) * 500;
		var length = (time > 4000) ? 4000 : time;
		setTimeout(function () {
			bot.startTyping(message);
			setTimeout(function () {
				bot.say(message);
				callback(null);
			}, length);
		}, 1000);
	}
bot.addReaction = function (message, emoticon) {
	bot.api.reactions.add({
			timestamp: message.ts,
			channel: message.channel,
			name: emoticon,
		},
		function (err, res) {
			if (err) console.log(err);
		});
}
bot.removeReaction = function (message, emoticon) {
	bot.api.reactions.remove({
			timestamp: message.ts,
			channel: message.channel,
			name: emoticon,
		},

		function (err, res) {
			if (err) console.log(err);
		});
}

/*~~~~~~~~~~~~~~~~~~~~~~EVENT HANDLERS~~~~~~~~~~~~~~~~~~~~~*/

controller.hears(['update schedules', 'confirm tasks', 'task check'], 'direct_message', function (bot, message) {
	bot.typeReply(message, "Great! Let's get started.");
});

function generateYesNoQA(question, yes, no, func) {
	return function (response, convo) {
		convo.ask(question, [{
			pattern: bot.utterances.yes,
			callback: function (response, convo) {
				convo.typeMessage(yes.text);
				if (typeof yes.action === 'function') {
					yes.action();
				}
				if (typeof func === 'function') {
					func(response, convo)
				}
				convo.next();
			}
		}, {
			pattern: bot.utterances.no,
			callback: function (response, convo) {
				convo.typeMessage(no.text);
				if (typeof no.action === 'function') {
					no.action();
				}
				if (typeof func === 'function') {
					func(response, convo)
				}
				convo.next();
			}
		}, {
			default: true,
			callback: function (response, convo) {
				convo.say("Sorry, I didn't quite get that. Let's try again!");
				convo.say(
					"Remember, keep it simple - respond *yes* or *no*! :simple_smile:"
				);
				convo.repeat();
				convo.next();
			}
		}]);
	};
}
	});