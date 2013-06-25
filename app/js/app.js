'use strict';


// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.config', 'myApp.filters', 'myApp.services', 'myApp.directives', 'myApp.controllers', 'ngSanitize']).
   config(['$routeProvider', function($routeProvider) {
      $routeProvider.when('/account', {
         templateUrl: 'partials/account.html',
         controller: 'AccountCtrl',
         authRequired: true,
         pathTo: '/account'
      });
      $routeProvider.when('/hearth', {
         templateUrl: 'partials/hearth.html',
         controller: 'HearthCtrl',
         authRequired: true,
         pathTo: '/hearth'
      });
      $routeProvider.when('/demo', {
         templateUrl: 'partials/hearth.html',
         controller: 'DemoCtrl',
         authRequired: false,
         pathTo: '/demo'
      });
      $routeProvider.when('/login', {
         templateUrl: 'partials/login.html',
         controller: 'LoginCtrl',
         authRequired: false,
         pathTo: '/login'
      });
      $routeProvider.otherwise({redirectTo: '/demo'});
   }])
   .run(['$rootScope', '$location', 'fbUrl', 'angularFireCollection', '$log', function($rootScope, $location, fbUrl, angularFireCollection, $log) {
      // use angularFireCollection because this list should be read-only, and it should be filterable
      // by using | filter command, which doesn't work with key/value iterators
      $rootScope.feedChoices = angularFireCollection(fbUrl('meta'));

      //todo make this a service?
      $rootScope.$on("$routeChangeStart", function (event, next, current) {
         $rootScope.redirectPath = null;
         if(next.authRequired && !$rootScope.auth.authenticated) {
            console.log('redirecting', next); //debug
            $rootScope.redirectPath = next.pathTo === '/login'? '/hearth' : next.pathTo;
            $location.path('/login');
         }
      });
   }]);
