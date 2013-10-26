'use strict'

angular.module('Services', [])
  .factory('IRC', function () {
    var IRC = function () {
      var _server = '';
      var _user = '';
      var _rooms = [];
      var _isJoined = false;
      
      var _events = {};

      var primus = Primus.connect();
      primus.on('data', function (data) {
        if (data.action === 'join') {
          if (!_isJoined) {
            _user = data.user;
            _isJoined = true;
          }
        }

        _emit(data.action, data);
      });

      var _emit = function (name, data) {
        var fns = _events[name];
        fns.forEach(function (fn) {
          fn(data);
        });
      }
      this.on = function (name, fb) {
        if (!_events[name]) _events[name] = [];
        _events[name].push (fb);
      }

      this.connect = function (server, user, rooms) {
        _server = server;
        _user = user;
        _rooms = rooms;
      }

      var _isCommand = function (message) {
        return /^\/nick/.test(S(message).trim().s);
      }
      var _handleCommand = function (message) {
        primus.write({ action: 'command', arguments: message.split(' ') });
      }
      var _handleMessage = function (message) {
        //Replace me as action
        if (S(message).startsWith('/me')) {
          message = '\u0001ACTION '+message.replace(/^\/me /, '')+'\u0001';
        }
        primus.write({ action: 'say', room: $scope.room, message: message });
      }
      this.send = function (message) {
        if (_isCommand(message)) _handleCommand(message);
        else _handleMessage(message);
      }

    }

    var _instance = new IRC;
    return _instance;
  });
