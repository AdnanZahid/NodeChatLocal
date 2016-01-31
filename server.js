var mongo = require('mongodb').MongoClient;
var client = require('socket.io').listen(8080).sockets;
var path = require('path');
var express = require('express');
var app = express();

var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', express.static(__dirname));
app.listen(80);

var util = require('util');

var username;
var gender;
var age;
var country;

var clientList = {};

app.post('/chat', function(request, response) {
    response.sendFile(path.join(__dirname + '/chat.html'));
	
	username = request.body.username;
	gender = request.body.gender;
	age = request.body.age;
	country = request.body.country;
});

mongo.connect('mongodb://localhost/chat', function(error, db) {
	if(error) throw error;

	client.on('connection', function(socket) {

        clientList[username] = socket.id;

		var messages = db.collection('messages');
		var onlineUsers = db.collection('onlineUsers');
		var sendStatus = function(s) {
			socket.emit('status', s);
		};

		onlineUsers.find().limit(100).toArray(function(error, response) {
			if(error) throw error;
			socket.emit('whoIsOnline', response);
		});

		socket.on('showConversation', function(data) {
			messages.find({id: data.id}).limit(100).toArray(function(error, response) {
				if(error) throw error;
				socket.emit('output', response);
			});
		});

		socket.on('input', function(data) {
			var name = data.name;
			var message = data.message;
			var id = data.id;
			var whitespacePattern = /^\s*$/;

			if(whitespacePattern.test(name) || whitespacePattern.test(message)) {
				sendStatus('Name and message is required.');
			}
			else {
				messages.insert({name: name, message: message, id: id}, function(error) {

					var to = id.replace(name, '');
					to = to.replace(' and ', '');

					if (client.connected[clientList[to]] !== undefined) {
						client.connected[clientList[to]].emit('output', [data]);

						sendStatus({
							message: 'Message sent',
							clear: true
						});
					} else {

						sendStatus({
							message: 'Message sending failed',
							clear: false
						});
					}
				});
			}
		});

		socket.on('ping', function(data) {
			var username = data.username;

			onlineUsers.findOne({ username: username }, function(error, duplicate) {
				
				if(!duplicate){
					onlineUsers.insert({username: username}, function(error) {
						client.emit('whoIsOnline', [data]);
					});
				}
			});
		});
	});
});