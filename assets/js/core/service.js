'use strict'

angular.module('Service')
  .factory('Message', function () {
    var Message = function (text) {
      var _raw = text;
    }
    Message.parse = function (text) {
      return new Message(text);
    }

    return Message;
  })
  .factory('IRC', function () {
    var IRC = function () {
      var primus = Primus.connect();

      this.connect = function (server, user, rooms) {
        this.server = server;
        this.user = user;
        this.rooms = rooms;
      }

      var _isCommand = function (message) {
        return /^\/nick/.test(S(message).trim().s);
      }
      var _handleCommand = function (message) {
      }
      var _handleMessage = function (message) {
      }
      this.send = function (message) {
        if (_isCommand(message)) {
          _handleCommand(message);
        }
        else {
          _handleMessage(message);
        }
      }

    }
    return new IRC;
  });
