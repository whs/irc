
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');

var http = require('http')
  , path = require('path')
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

var channels = {};

primus.on('connection', function (spark) {

  spark.on('data', function (data) {
    console.log ('client: ', data);
    var self = this;
    if (data.action == 'subscribe') {
      if (!channels[data.room]) {
        channels[data.room] = [];
      }

      channels[data.room].push(spark);
    }
    else if (data.action == 'broadcast') {
      if (data.room && channels[data.room]) {
        var channel = channels[data.room];
        channel.forEach(function (spark) {
          if (spark.id !== self.id) {
            spark.write(data);
          }
        });
      }
    }

  });

});

primus.save(__dirname +'/assets/js/libs/primus.js');
