(function() {
   'use strict';

   var isAuthenticated = false;
   var dependencyModules = ['ngSanitize', 'ui.bootstrap', 'ui.keypress'];
   var myAppComponents = ['myApp.utils', 'myApp.animate', 'myApp.config', 'myApp.filters', 'myApp.services', 'myApp.directives', 'myApp.controllers'];

   // Declare app level module which depends on filters, and services
   angular.module('myApp', dependencyModules.concat(myAppComponents))
      .config(['$routeProvider', function($routeProvider) {
         $routeProvider.when('/hearth', {
            templateUrl: 'partials/hearth.html',
            controller: 'HearthCtrl',
            authRequired: true,
            reloadOnSearch: false
         });
         $routeProvider.when('/demo', {
            templateUrl: 'partials/hearth.html',
            controller: 'DemoCtrl',
            authRequired: false,
            reloadOnSearch: false
         });
         $routeProvider.when('/login', {
            templateUrl: 'partials/login.html',
            controller: 'LoginCtrl',
            authRequired: false
         });
         $routeProvider.otherwise({redirectTo: function() { return isAuthenticated? '/hearth' : '/demo'; }});
      }])
      .run(['$rootScope', '$location', 'fbRef', 'angularFireCollection', 'firebaseAuth', '$log', function($rootScope, $location, fbRef, angularFireCollection, firebaseAuth, $log) {
         firebaseAuth();

         $rootScope.$log = $log;

         $rootScope.keypress = function(key, $event) {
            $rootScope.$broadcast('keypress', key, $event);
         };

         // use angularFireCollection because this list should be read-only, and it should be filterable
         // by using | filter command, which doesn't work with key/value iterators
         $rootScope.feedChoices = angularFireCollection(fbRef('meta'));
         $rootScope.redirectPath = null;

         $rootScope.$watch('auth.authenticated', function() { isAuthenticated = $rootScope.auth.authenticated; });

         $rootScope.$on('$routeUpdate', function(event, next, current) {
            $rootScope.activeFeed = next.params.feed || false;
            next.scope && (next.scope.activeFeed = next.params.feed||false);
         });

         //todo make this a service?
         $rootScope.$on("$routeChangeStart", function (event, next, current) {
            $rootScope.activeFeed = next.params.feed || false;
            next.scope && (next.scope.activeFeed = next.params.feed||false);
            if(next.authRequired && !$rootScope.auth.authenticated) {
               $rootScope.redirectPath = $location.path();
               $location.path('/login');
            }
         });
      }]);

})();
