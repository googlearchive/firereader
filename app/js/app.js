'use strict';


// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.config', 'myApp.filters', 'myApp.services', 'myApp.directives', 'myApp.controllers', 'ngSanitize']).
   config(['$routeProvider', function($routeProvider) {
      $routeProvider.when('/account', {
         templateUrl: 'partials/account.html',
         controller: 'AccountCtrl',
         authRequired: true
      });
      $routeProvider.when('/hearth', {
         templateUrl: 'partials/hearth.html',
         controller: 'HearthCtrl',
         authRequired: true
      });
      $routeProvider.when('/demo', {
         templateUrl: 'partials/hearth.html',
         controller: 'DemoCtrl',
         authRequired: false
      });
      $routeProvider.when('/about', {
         templateUrl: 'partials/about.html',
         controller: 'AboutCtrl',
         authRequired: false
      });
      $routeProvider.when('/login', {
         templateUrl: 'partials/login.html',
         controller: 'LoginCtrl',
         authRequired: false
      });
      $routeProvider.otherwise({redirectTo: '/about'});
   }])
   .run(['$rootScope', '$location', 'fbUrl', 'angularFireCollection', '$log', function($rootScope, $location, fbUrl, angularFireCollection, $log) {
      // use angularFireCollection because this list should be read-only, and it should be filterable
      // by using | filter command, which doesn't work with key/value iterators
      $rootScope.feedChoices = angularFireCollection(fbUrl('meta'));
      $rootScope.redirectPath = null;

      //todo make this a service?
      $rootScope.$on("$routeChangeStart", function (event, next, current) {
         if(next.authRequired && !$rootScope.auth.authenticated) {
            console.log('redirecting from', $location.path(), next); //debug
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
