
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');

var http = require('http')
  , path = require('path')
  , irc = require('irc')
  , Primus = require('primus');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(require('connect-assets')());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// routes
app.get('/', routes.index);
app.get('/users', user.list);

var server = http.createServer(app)
  , primus = new Primus(server, { transformer: 'engine.io' });

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var clients = {};
var clientCount = 0;

primus.on('connection', function (spark) {

  clientCount++;
  console.log ('Spark ' + spark.id + ' is connected');
  console.log ('Total client: ' + clientCount);
  clients[spark.id] = { spark: spark, irc: null };
  spark.on('data', function (data) {
    var self = this;

    if (data.action === 'connect') {
      var room = data.room;
      var user = data.user;
      var server = data.server;

      var connection = new irc.Client(server, user, { 
        userName: 'llunchat',
        realName: 'llunchat IRC client',
        channels: [ room ] 
      });
      clients[spark.id].irc = connection;
      connection.addListener('join', function (room, nick) {
        spark.write({ action: 'joined', room: room });
      });
      connection.addListener('message', function (from, room, message) {
        spark.write({ action: 'message', from: from, room: room, message: message });
      });
      connection.addListener('names', function (room, nicks) {
        spark.write({ action: 'names', room: room, nicks: nicks });
      });
      connection.addListener('nick', function (oldName, newName, room) {
        spark.write({ action: 'nick', room: room, oldname: oldName, newname: newName });
      });
      connection.addListener('error', function (message) {
        console.log ('error: ' + message);
      });

    }
    else if (data.action === 'say') {
      var connection = clients[spark.id].irc;
      connection.say(data.room, data.message);
    }

  });
});
primus.on('disconnection', function (spark) {
  if (clients[spark.id].irc) {
    clients[spark.id].irc.disconnect('llunchat: Client close browser');
  }
  delete clients[spark.id];
  clientCount--;
  console.log ('Spark ' + spark.id + ' is disconnected');
  console.log ('Total client: ' + clientCount);
});

primus.save(__dirname +'/assets/js/libs/primus.js');

