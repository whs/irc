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
          out = twttr.txt.autoLinkUrlsCustom(out);
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

      $scope.room = IRC.room;
      $scope.topic = 'Connecting...';
      var mentionCount = 0;

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
          mentionCount++;
          Tinycon.setBubble(mentionCount);
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
      Emitter.on('topic', function (data) {
        $scope.topic = data.topic;
        $scope.messages.push({ type: 'command', time: moment(new Date()).format('hh:mm'), text: 'Topic: ' + data.topic + ' set by ' + data.nick });
      });
      Emitter.on('postdata', function () {
        $scope.$apply();
      });

      // All scope vairables are here.
      $scope.room = IRC.room;
      $scope.autocompleteText = '';
      $scope.autocompleteIndex = 0;
      $scope.autocompleteStyle = '';
      $scope.members = {};
      $scope.messages = [
        { type: 'command', time: moment(new Date()).format('hh:mm'), text: 'Joining ' + IRC.room }
      ];

      $scope.$watchCollection('messages', function () {
        var element = document.querySelector('.conversations');
        element.scrollTop = element.scrollHeight;
      });
      $scope.$watch('autocompleteText', function () {
        if ($scope.autocompleteText.length > 0 && 
            $scope.memberFilter().length > 0) {

          // Reset autocomplete index
          if (!$scope.autocompleteStyle.display ||
              $scope.autocompleteStyle.display === 'none') {
            $scope.autocompleteIndex = 0;
          }
          $scope.autocompleteStyle = { display: 'block' };
        }
        else {
          $scope.autocompleteStyle = { display: 'none' };
        }
      });

      document.addEventListener('mousemove', function(){
        if(mentionCount > 0){
          mentionCount = 0;
          Tinycon.setBubble(mentionCount);
        }
      }, false);

      // Initial messages
      $scope.messages = [
        { type: 'command', time: moment(new Date()).format('hh:mm'), text: 'Joining ' + IRC.room }
      ];
      document.title = IRC.room;
      $scope.members = {};
      $scope.fillname = function (name) {
        $scope.message = name + ', ';
      }
      $scope.memberFilter = function () {
        return _.filter(_.keys($scope.members), function (key) { return S(key).startsWith($scope.autocompleteText); });
      }
      $scope.memberSelectClass = function (index) {
        if (index === $scope.autocompleteIndex) {
          return 'selected';
        }
        return '';
      }
      $scope.send = function () {
        if($scope.message.length === 0){
          return;
        }
        IRC.send($scope.message);
        $scope.message = '';
      }
      $scope.keydown = function (event) {
        var input = event.currentTarget;
        switch (event.keyCode) {
          // Delete/Backspace
          case 8:
            var text = input.value;
            $scope.autocompleteText = _.last(text.substring(0, text.length - 1).split(' '));
            break;
          // Tab
          case 9:
            if ($scope.autocompleteStyle.display === 'block') {
              event.preventDefault();
              var selected = $scope.memberFilter()[$scope.autocompleteIndex];
              $scope.message += selected.substring($scope.autocompleteText.length);
              $scope.autocompleteText = '';
            }
            break;
          // Enter
          case 13:
            if ($scope.autocompleteStyle.display === 'block') {
              event.preventDefault();
              var selected = $scope.memberFilter()[$scope.autocompleteIndex];
              $scope.message += selected.substring($scope.autocompleteText.length);
              $scope.autocompleteText = '';
            }
            else {
              $scope.send();
            }
            break;
          // Up
          case 38:
            event.preventDefault();
            var nextIndex = $scope.autocompleteIndex - 1;
            if (nextIndex > -1) {
              $scope.autocompleteIndex = nextIndex;
            }
            break;
          // Down
          case 40:
            event.preventDefault();
            var nextIndex = $scope.autocompleteIndex + 1;
            if (nextIndex < $scope.memberFilter().length) {
              $scope.autocompleteIndex = nextIndex;
            }
            break;
        }
      }
      $scope.keypress = function (event) {
        var input = event.currentTarget;
        $scope.autocompleteText = _.last((input.value + String.fromCharCode(event.charCode)).split(' '));
      }


      // Connect to the server
      IRC.connect();

    }]);
  
