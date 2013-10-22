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

      var primus = Primus.connect();
      primus.write({ action: 'connect', server: state.server, room: state.room, user: state.user });
      primus.on('data', function message(data) {
        $scope.messages.push(data.from + ': ' + data.message); 
        $scope.$apply();
      });

      $scope.messages = [];
      $scope.send = function () {
        $scope.messages.push(state.user + ': ' + $scope.message);
        primus.write({ action: 'say', room: $scope.room, message: $scope.message });
        $scope.message = '';
      }
      $scope.keypress = function (event) {
        if (event.keyCode === 13) {
          $scope.send();
        }
      }

    }]);
  
