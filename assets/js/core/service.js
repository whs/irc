'use strict'

angular.module('Service')
  .factory('IRC', function () {
    var IRC = function () {
      var primus = Primus.connect();

      this.connect = function () {
      }
    }
    return new IRC;
  });
