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
  .filter('ircColor', [ 'userColor', function (userColor) {
    return function(input){
      return userColor(input);
    };
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
          $scope.$apply();
        }
        else if (data.action === 'message') {
          $scope.messages.push({ type: 'message', time: moment(new Date()).format('hh:mm'), user: data.from, text: data.message }); 
          $scope.$apply();
        }
        else if (data.action === 'names') {
          $scope.members = data.users;
          $scope.$apply();
        }
        else if (data.action === 'nick') {
          if (data.oldname === state.user) {
            state.user = data.newname;
          }
          var value = $scope.members[data.oldname];
          delete $scope.members[data.oldname];
          $scope.members[data.newname] = value;
          $scope.$apply();
        }
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
  
