'use strict'

angular.module('Services', [])
  .factory('Emitter', function () {
    var Emitter = function () {

      var _events = {};

      this.on = function (names, listener) {
        var _names = names;
        if (typeof names === 'string') { _names = [ names ] }

        _names.forEach(function (name) {
          if (!_events[name]) _events[name] = [];
          _events[name].push (listener);
        });
      }

      this.emit = function (name, data) {
        var fns = _events[name];
        fns.forEach(function (fn) {
          fn(data);
        });
      }

      this.clear = function () {
        _events = {};
      }

    }
    return new Emitter;
  })
  .factory('Message', function () {
    var Message = function (room, message) {
      var _room = room;
      var _message = S(message).trim().s;

      var _isCommand = function () {
        return /^\/nick/.test(message);
      }

      Object.defineProperty(this, 'data', {
        get: function () {
          if (_isCommand()) {
            return { action: 'command', arguments: message.split(' ') };
          }
          else {
            //Replace me as action
            if (S(_message).startsWith('/me')) {
              _message = '\u0001ACTION ' + _message.replace(/^\/me /, '') + '\u0001';
            }
            return { action: 'say', room: _room, message: message };
          }
        }
      });
    }

    return Message;
  })
  .factory('IRC', [ 'Emitter', 'Message', function (Emitter, Message) {
    var IRC = function () {
      var _server = '';
      var _user = '';
      var _rooms = [];
      var _isJoined = false;
      var _nickserv = null;
      
      var primus = Primus.connect();
      primus.on('data', function (data) {
        switch (data.action) {
          case 'join':
            if (!_isJoined) {
              _user = data.user;
              _isJoined = true;
              // Special case for self join. Other command that has user maybe use the same pattern.
              Emitter.emit('self.join', data);
              return;
            }
            break;
          case 'nick':
            if (data.oldname === _user) {
              _user = data.newname;
            }
            break;
        }

        Emitter.emit(data.action, data);
        Emitter.emit('postdata');
      });


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

      this.clear = function () {
        // Clear all events
        _events = {};
      }

      this.init = function (server, user, rooms) {
        _server = S(server).trim().s;
        _user = S(user).trim().s;
        _rooms = rooms || [];
      }

      this.setNickserv = function(password){
        _nickserv = password;
      }

      this.connect = function () {
        if (this.isInit) {
          // Not support more than 1 room yet.
          var room = _rooms[0];
          primus.write({
            action: 'connect',
            server: _server,
            room: room,
            user: _user,
            nickserv: _nickserv
          });
        }
      }

      this.send = function (text) {
        var message = new Message(this.room, text);
        primus.write(message.data);
        if (message.action === 'say') {
          Emitter.emit('send', { from: _user, room: this.room, message: message });
        }
      }

    }

    var _instance = new IRC;
    return _instance;
  }]);
