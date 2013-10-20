'use strict'

angular.module('chat', [ 'ngRoute' ])
  .config([ '$routeProvider', function ($route) {
    $route
      .when('/login', { controller: 'Login', templateUrl: 'login.html' })
      .when('/chat', { controller: 'Chat', templateUrl: 'chat.html' })
      .otherwise({ redirectTo: '/login' });
  }])
  .factory('state', function () {
    return { user: '', room: '' };
  })
  .controller('Login', [ '$scope', '$location', 'state', 
    function ($scope, $location, state) {

      if (window.localStorage) {
        $scope.user = localStorage.user;
        $scope.room = localStorage.room;
      }

      if (!S($scope.user).isEmpty() && !S($scope.room).isEmpty()) {
        state.user = $scope.user;
        state.room = $scope.room;
        $location.path('/chat');
        return;
      }

      $scope.login = function () {

        if (window.localStorage) {
          localStorage.user = $scope.user;
          localStorage.room = $scope.room;
        }

        state.user = $scope.user;
        state.room = $scope.room;
        $location.path('/chat');
      }
    }])
  .controller('Chat', [ '$scope', '$location', 'state',
    function ($scope, $location, state) {
      if (!state.user || !state.room) {
        $location.path('/login');
      }

      $scope.room = state.room;

      var primus = Primus.connect();
      primus.on('data', function message(data) {
        $scope.messages.push(data); 
      });

      $scope.messages = [];
      $scope.send = function () {
        $scope.messages.push(state.user + ': ' + $scope.message);
        primus.write($scope.message);
        $scope.message = '';
      }
    }]);
  
