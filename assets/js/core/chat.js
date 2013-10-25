'use strict'

angular.module('chat', [ 'ngRoute' ])
  .config([ '$routeProvider', function ($route) {
    $route
      .when('/login', { controller: 'Login', templateUrl: 'login.html' })
      .when('/chat', { controller: 'Chat', templateUrl: 'chat.html' })
      .otherwise({ redirectTo: '/login' });
  }])
  .factory('state', function () {
    return { user: '', room: '', server: '' };
  })
  .factory('userColor', function () {
    // http://xchat.sourcearchive.com/documentation/2.4.1-0.1/inbound_8c-source.html
    function color_of(name){
      var sum = 0, i=0;
      var rcolors = [2, 3, 4, 5, 6, 7, 10];
      while (name[i]){
        sum += name[i++].charCodeAt(0);
      }
      sum %= rcolors.length;
      return rcolors[sum];
    }
    return color_of;
  })
  .factory('escapeHTML', function () {
    return function(str){
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    };
  })
  .filter('ircColor', [ 'userColor', function (userColor) {
    return function(input){
      return userColor(input);
    };
  }])
  .directive('ircColor', [ 'escapeHTML', function (escapeHTML) {
    return {
      'link': function(scope, element, attrs){
        var value;
        var update = function(){
          // escape HTML
          var html = escapeHTML(value);
          var out = "";
          var hasOpenTag = false;
          var curColor = [];
          for (var i = 0; i < html.length; i++) {
            var cur = html[i];
            if(cur == "\x03"){
              if(html[i+1] === undefined || !html[i+1].match(/[0-9]/)){
                // stop formatting
                out += "</span>";
                hasOpenTag = false;
                continue;
              }
              var color = parseInt(html.substr(i+1, 2));
              var bgColor = null;
              if(html[i+3] == ","){
                var bgColor = parseInt(html.substr(i+4, 2));
                i += 3;
              }
              if(hasOpenTag){
                out += "</span>";
              }
              var cls = [];
              if(color){
                cls.push("color-"+color);
              }
              if(bgColor){
                cls.push("bgcolor-"+bgColor);
              }
              out += "<span class=\""+cls.join(" ")+"\">";
              hasOpenTag = true;
              i += 2; // i++ add another
            }else if(cur == "\x0f"){
              out += "</span>";
              hasOpenTag = false;
            }else if(cur == "\x02"){
              if(hasOpenTag){
                out += "</span>";
              }
              out += "<span style=\"font-weight: bold;\">";
              hasOpenTag = true;
            }else if(cur == "\x1f"){
              if(hasOpenTag){
                out += "</span>";
              }
              out += "<span style=\"text-decoration: underline;\">";
              hasOpenTag = true;
            }else if(cur == "\u0016"){
              if(hasOpenTag){
                out += "</span>";
              }
              out += "<span style=\"font-style: italic;\">";
              hasOpenTag = true;
            }else{
              out += cur;
            }
          };
          if(hasOpenTag){
            out += "</span>";
          }
          element.html(out);
        };
        scope.$watch(attrs.ircColor, function(val){
          value = val;
          update();
        });
      }
    }
  }])
  .controller('Login', [ '$scope', '$location', 'state', 
    function ($scope, $location, state) {

      $scope.login = function () {

        state.user = $scope.user;
        state.room = $scope.room;
        state.server = $scope.server;
        $location.path('/chat');
      }
    }])
  .controller('Chat', [ '$scope', '$location', 'state',
    function ($scope, $location, state) {
      if (!state.user || !state.room || !state.server) {
        $location.path('/login');
      }

      $scope.room = state.room;

      var primus = Primus.connect();
      primus.write({ action: 'connect', server: state.server, room: state.room, user: state.user });
      primus.on('data', function message(data) {
        if (data.action === 'join') {
          if ($scope.joining) {
            state.user = data.user;
            $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), user: state.user, text: 'Joined ' + state.room }); 
            $scope.joining = false;
          }
          else {
            $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), user: data.user, text: data.user + ' joined the room' }); 
            $scope.members[data.user] = '';
          }
        }
        else if (data.action === 'part' || data.action === 'quit') {
          $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), user: data.user, text: data.user + ' left the room' }); 
          delete $scope.members[data.user];
        }
        else if (data.action === 'message') {
          $scope.messages.push({ type: 'message', time: moment(new Date()).format('hh:mm'), user: data.from, text: data.message }); 
        }
        else if (data.action === 'names') {
          $scope.members = data.users;
        }
        else if (data.action === 'nick') {
          if (data.oldname === state.user) {
            state.user = data.newname;
          }
          var value = $scope.members[data.oldname];
          delete $scope.members[data.oldname];
          $scope.members[data.newname] = value;
        }

        $scope.$apply();
        var element = document.querySelector('.conversations');
        element.scrollTop = element.scrollHeight;
      });

      $scope.joining = true;

      $scope.messages = [
        { type: 'command', time: moment(new Date()).format('hh:mm'), user: state.user, text: 'Joining ' + state.room }
      ];
      document.title = state.room;
      $scope.members = {};
      $scope.fillname = function (name) {
        $scope.message = name + ', ';
      }
      $scope.send = function () {
        if (S($scope.message).isEmpty()) return;

        var message = S($scope.message).trim().s;
        if (S(message).startsWith('/nick')) {
          var args = message.split(' ');
          primus.write({ action: 'command', arguments: args });
        }
        else {
          $scope.messages.push({ type: 'message', time: moment(new Date()).format('hh:mm'), user: state.user, text: message });
          primus.write({ action: 'say', room: $scope.room, message: message });
        }
        $scope.message = '';
        var element = document.querySelector('.conversations');
        element.scrollTop = element.scrollHeight;
      }
      $scope.keypress = function (event) {
        if (event.keyCode === 13) {
          $scope.send();
        }
      }

    }]);
  
