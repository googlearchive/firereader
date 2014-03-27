(function(angular) {
   "use strict";
   var appServices = angular.module('myApp.services', ['myApp.utils', 'feedTheFire']);

   /**
    * A service that authenticates against Fireabase using simple login
    */
   appServices.factory('authManager', ['$rootScope', 'fbRef', '$firebaseSimpleLogin', 'authScopeUtil', function($rootScope, fbRef, $firebaseSimpleLogin, authScopeUtil) {
      authScopeUtil($rootScope);

       var auth = $firebaseSimpleLogin(fbRef());

      // provide some convenience wrappers on $firebaseSimpleLogin so it's easy to extend behavior and isolate upgrades
      return {
         login: function(providerId) {
            console.log('login', providerId);//debug
            auth.$login(providerId, { rememberMe: true, scope: 'email'});
         },

         logout: function() {
            console.log('logout');//debug
            auth.$logout();
         }
      };
   }]);

   /**
    * A simple utility to monitor changes to authentication and set some values in scope for use in bindings/directives/etc
    */
   appServices.factory('authScopeUtil', ['$log', 'updateScope', 'localStorage', '$location', function($log, updateScope, localStorage, $location) {
      return function($scope) {
         $scope.auth = {
            authenticated: false,
            user: null,
            name: null,
            provider: localStorage.get('authProvider')
         };

         $scope.$on('$firebaseSimpleLogin:login', _loggedIn);
         $scope.$on('$firebaseSimpleLogin:error', function(err) {
            $log.error(err);
            _loggedOut();
         });
         $scope.$on('$firebaseSimpleLogin:logout', _loggedOut);

         function parseName(user) {
            switch(user.provider) {
               case 'persona':
                  return (user.id||'').replace(',', '.');
               default:
                  return user.id;
            }
         }

         function _loggedIn(evt, user) {
            localStorage.set('authProvider', user.provider);
            $scope.auth = {
               authenticated: true,
               user: user.id,
               name: parseName(user),
               provider: user.provider
            };
            updateScope($scope, 'auth', $scope.auth, function() {
               if( !($location.path()||'').match('/hearth') ) {
                  $location.path('/hearth');
               }
            });
         }

         function _loggedOut() {
            $scope.auth = {
               authenticated: false,
               user: null,
               name: null,
               provider: $scope.auth && $scope.auth.provider
            };
            updateScope($scope, 'auth', $scope.auth, function() {
               $location.search('feed', null);
               $location.path('/demo');
            });
         }
      }
   }]);

})(angular);
