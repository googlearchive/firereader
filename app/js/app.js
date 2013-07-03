(function() {
   'use strict';

   //todo config() can't access $rootScope, how can we check $rootScope.auth.authenticated indirectly?
   var isAuthenticated = false;

   // Declare app level module which depends on filters, and services
   angular.module('myApp', ['myApp.config', 'myApp.filters', 'myApp.services', 'myApp.directives', 'myApp.controllers', 'ngSanitize', 'ui.bootstrap', 'ui.keypress']).
      config(['$routeProvider', function($routeProvider) {
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
         $routeProvider.otherwise({redirectTo: function() { console.log('otherwise', isAuthenticated); return isAuthenticated? '/hearth' : '/demo'; }});
      }])
      .run(['$rootScope', '$location', 'fbUrl', 'angularFireCollection', 'firebaseAuth', function($rootScope, $location, fbUrl, angularFireCollection, firebaseAuth) {
         firebaseAuth();

         $rootScope.enter = function() {
            console.log('enter key pressed'); //debug
         }

         // use angularFireCollection because this list should be read-only, and it should be filterable
         // by using | filter command, which doesn't work with key/value iterators
         $rootScope.feedChoices = angularFireCollection(fbUrl('meta'));
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

   //
   //jQuery(function($) {
   //   var _size = _.debounce(function() {
   //      var $w = $(window);
   //      $('#windowSize').text( $w.height() + ' x ' + $w.width() );
   //   }, 50);
   //   var _move = _.debounce(function(e) {
   //      $('#mouseCoords').text( 'x: '+ e.pageX + ', y: '+ e.pageY );
   //   }, 50);
   //
   //   $('nav > div').append('<span id="windowSize"></span>').append(' / ').append('<span id="mouseCoords"></span>');
   //   $(window).resize(_size);
   //   $(document).on('mousemove', _move);
   //   _size();
   //});

})();
