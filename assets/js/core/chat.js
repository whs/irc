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

      var primus = Primus.connect('/', { websocket: false });
      primus.write({ action: 'connect', server: state.server, room: state.room, user: state.user });
      primus.on('data', function message(data) {
        if (data.action === 'joined') {
          $scope.messages.push({ time: moment(new Date()).format('hh:mm'), user: state.user, text: 'Joined ' + state.room }); 
          $scope.joining = false;
        }
        else if (data.action === 'message') {
          $scope.messages.push({ time: moment(new Date()).format('hh:mm'), user: data.from, text: data.message }); 
          $scope.$apply();
        }
        else if (data.action === 'names') {
          $scope.members = data.nicks;
          $scope.$apply();
        }
      });

      $scope.joining = true;

      $scope.messages = [
        { time: moment(new Date()).format('hh:mm'), user: state.user, text: 'Joining ' + state.room }
      ];
      $scope.members = [];
      $scope.send = function () {
        if (S($scope.message).isEmpty()) return;

        $scope.messages.push({ time: moment(new Date()).format('hh:mm'), user: state.user, text: $scope.message });
        primus.write({ action: 'say', room: $scope.room, message: $scope.message });
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
  
