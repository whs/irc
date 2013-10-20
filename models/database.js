var mongoose = require('mongoose');

var databaseURL = process.env.MONGO_URL || 'mongodb://localhost/pubsub'

var database = mongoose.connect(databaseURL, {
    server: { 
      auto_reconnect: true,
      poolSize: 2,
      socketOptions: {
        keepAlive: 1 
      }
    },
    db: {
      numberOfRetries: 10,
      retryMiliSeconds: 1000
    }
  });

module.exports = database;
