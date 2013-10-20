var database = require('./database'),
    mongoose = require('mongoose');

var schema = mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: String, required: true }
});

var Room = database.model('Room', schema);

module.exports = Room;

