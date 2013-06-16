'use strict';


// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives', 'myApp.controllers', 'ngSanitize']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/account', {templateUrl: 'partials/account.html', controller: 'AccountCtrl'});
    $routeProvider.when('/hearth', {templateUrl: 'partials/hearth.html', controller: 'HearthCtrl'});
    $routeProvider.when('/demo', {templateUrl: 'partials/hearth.html', controller: 'DemoCtrl'});
    $routeProvider.otherwise({redirectTo: '/demo'});
  }]);
