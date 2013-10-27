'use strict'

angular.module('chat', [ 'ngRoute', 'Services' ])
  .config([ '$routeProvider', function ($route) {
    $route
      .when('/login', { controller: 'Login', templateUrl: 'login.html' })
      .when('/chat', { controller: 'Chat', templateUrl: 'chat.html' })
      .otherwise({ redirectTo: '/login' });
  }])
  .filter('ircColor', function () {
    return function(name){
      var sum = 0, i=0;
      var rcolors = [2, 3, 4, 5, 6, 7, 10];
      while (name[i]){
        sum += name[i++].charCodeAt(0);
      }
      sum %= rcolors.length;
      return rcolors[sum];
    };
  })
  .directive('ircColor', [ function () {
    return {
      'link': function(scope, element, attrs){
        var value;
        var update = function(){
          // escape HTML
          var html = S(value).escapeHTML().s;
          var out = "";
          var hasOpenTag = false;
          var curColor = [];
          for (var i = 0; i < html.length; i++) {
            var cur = html[i];
            if(cur == "\x03"){
              if(html[i+1] === undefined || !S(html[i+1]).isNumeric()){
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
  .controller('Login', [ '$scope', '$location', 'Emitter', 'IRC', 
    function ($scope, $location, Emitter, IRC) {

      $scope.login = function () {
        Emitter.clear();
        IRC.init($scope.server, $scope.user, [ $scope.room ]);
        if($scope.nickserv !== ''){
          IRC.setNickserv($scope.nickserv);
        }
        $location.path('/chat');
        if(notify.permissionLevel() !== notify.PERMISSION_GRANTED){
          notify.requestPermission();
        }
      }
    }])
  .controller('Chat', [ '$scope', '$location', 'Emitter', 'IRC',
    function ($scope, $location, Emitter, IRC) {
      if (!IRC.isInit) {
        $location.path('/login');
      }
      document.title = IRC.room;

      // All listeners are here.
      Emitter.on('self.join', function (data) {
        $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), text: 'Joined ' + IRC.room }); 
      });
      Emitter.on('join', function (data) {
        $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), user: data.user, text: data.user + ' joined the room' }); 
        $scope.members[data.user] = '';
      });
      Emitter.on(['part', 'quit'], function (data) {
        $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), user: data.user, text: data.user + ' left the room' }); 
        delete $scope.members[data.user];
      });
      Emitter.on(['message', 'send'], function (data) {
        // Mention
        if(data.from !== IRC.user && S(data.message).contains(IRC.user)){
          data.mention = true;
          notify.createNotification('Mention from ' + data.from + ' in ' + IRC.room, {
            body: data.from + ': ' + data.message,
            icon: '/assets/img/icon.png' // required
          });
        }

        if(S(data.message).startsWith('\u0001ACTION') && S(data.message).endsWith('\u0001')){
          $scope.messages.push({ type: 'action', time: moment(new Date()).format('hh:mm'), user: data.from, text: data.message.replace(/^\001ACTION /, "").replace(/\001$/, ""), mention: data.mention }); 
        }else{
          $scope.messages.push({ type: 'message', time: moment(new Date()).format('hh:mm'), user: data.from, text: data.message, mention: data.mention }); 
        }
      });
      Emitter.on('names', function (data) {
        $scope.members = data.users;
      });
      Emitter.on('nick', function (data) {
        var value = $scope.members[data.oldname];
        delete $scope.members[data.oldname];
        $scope.members[data.newname] = value;
      });
      Emitter.on('postdata', function () {
        $scope.$apply();
      });

      // All scope vairables are here.
      $scope.room = IRC.room;
      $scope.autocompleteText = '';
      $scope.autocompleteIndex = 0;
      $scope.members = {};
      $scope.messages = [
        { type: 'command', time: moment(new Date()).format('hh:mm'), text: 'Joining ' + IRC.room }
      ];

      $scope.$watchCollection('messages', function () {
        var element = document.querySelector('.conversations');
        element.scrollTop = element.scrollHeight;
      });

      $scope.fillname = function (name) {
        $scope.message = name + ', ';
      }
      $scope.memberFilter = function () {
        return _.filter(_.keys($scope.members), function (key) { return S(key).startsWith($scope.autocompleteText); });
      }
      $scope.send = function () {
        IRC.send($scope.message);
        $scope.message = '';
      }
      $scope.keypress = function (event) {
        if (event.keyCode === 13) {
          $scope.send();
        }

        var input = event.currentTarget;
        $scope.autocompleteText = _.last((input.value + String.fromCharCode(event.charCode)).split(' '));
      }


      // Connect to the server
      IRC.connect();

    }]);
  
