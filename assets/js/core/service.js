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
        switch (data.action) {
          case 'join':
            if (!_isJoined) {
              _user = data.user;
              _isJoined = true;
              // Special case for self join. Other command that has user maybe use the same pattern.
              _emit('self.join', data);
              return;
            }
            break;
          case 'nick':
            if (data.oldname === _user) {
              _user = data.newname;
            }
            break;
        }

        _emit(data.action, data);
        _emit('postdata');
      });

      var _emit = function (name, data) {
        var fns = _events[name];
        fns.forEach(function (fn) {
          fn(data);
        });
      }

      Object.defineProperty(this, 'isInit', {
        get: function () {
          return _server && _user && (_rooms.length > 0);
        }
      });
      Object.defineProperty(this, 'room', {
        get: function () {
          if (_rooms.length > 0) return _rooms[0];
          return '';
        }
      });
      Object.defineProperty(this, 'user', {
        get: function () { return _user; }
      });

      this.on = function (names, fb) {
        var _names = names;
        if (typeof names === 'string') { _names = [ names ] }

        _names.forEach(function (name) {
          if (!_events[name]) _events[name] = [];
          _events[name].push (fb);
        });
      }

      this.init = function (server, user, rooms) {
        _server = S(server).trim().s;
        _user = S(user).trim().s;
        _rooms = rooms || [];
        console.log (user);
      }

      this.connect = function () {
        if (this.isInit) {
          // Not support more than 1 room yet.
          var room = _rooms[0];
          primus.write({ action: 'connect', server: _server, room: room, user: _user });
        }
      }

      var Message = function (room, message) {
        var _room = room;
        var _message = S(message).trim().s;

        var _isCommand = function () {
          return /^\/nick/.test(message);
        }

        this.send = function () {
          if (_isCommand()) {
            primus.write({ action: 'command', arguments: message.split(' ') });
          }
          else {
            //Replace me as action
            if (S(message).startsWith('/me')) {
              message = '\u0001ACTION '+message.replace(/^\/me /, '')+'\u0001';
            }
            primus.write({ action: 'say', room: _room, message: message });
            _emit('send', { from: _user, room: this.room, message: message });
          }
        };
      }

      this.send = function (message) {
        new Message(this.room, message).send();
      }

    }

    var _instance = new IRC;
    return _instance;
  });
