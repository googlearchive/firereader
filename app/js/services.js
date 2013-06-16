(function(angular) {

   "use strict"

   angular.module('myApp.services', [])
      .value('version', '0.1')

      .value('debugLevel', 0)// 0=log, 1=info, 2=warn, 3=error

      .factory('logger', ['debugLevel', '$rootScope', function(debugLevel, $rs) {
         return $rs.logger = new Logger(debugLevel);
      }])

      .factory('localStorage', ['logger', function(logger) {
         //todo should handle booleans and integers more intelligently?
         var loc = {
            set: function(key, value) {
               logger('localStorage.set', key, value);
               var undefined;
               if( value === undefined || value === null ) {
                  // storing a null value returns "null" (a string) when get is called later
                  // so to make it actually null, just remove it, which returns null
                  loc.remove(key);
               }
               else {
                  if( typeof(value) === 'object' ) {
                     value = angular.toJson(value);
                  }
                  if( typeof(localStorage) === 'undefined' ) {
                     cookie(key, value);
                  }
                  else {
                     localStorage.setItem(key, value);
                  }
               }
               return loc;
            },
            get: function(key) {
               logger('localStorage.get', key);
               if( typeof(localStorage) === 'undefined' ) {
                  return cookie(key);
               }
               else {
                  return localStorage.getItem(key);
               }
            },
            remove: function(key) {
               logger('localStorage.remove', key);
               if( typeof(localStorage) === 'undefined' ) {
                  cookie(key, null);
               }
               else {
                  localStorage.removeItem(key);
               }
               return loc;
            }
         };

         return loc;
      }])

      .factory('firebaseAuth', ['logger', 'localStorage', '$rootScope', function(logger, localStorage, $rootScope) {
         //todo-hack including logger makes sure it's initialized before we instantiate FirebaseAuth
         return new FirebaseAuth(localStorage, $rootScope);
      }])

      .run(['logger', 'firebaseAuth', function() {
         //todo-hack just gets logger and firebaseAuth initialized and into the $rootScope
         //todo-hack because I don't know how to do that yet (should probably be their own modules?)
      }]);


   function FirebaseAuth(localStorage, $rootScope) {
      this.scopes = [];
      this.loc = localStorage;
      this.$root = $rootScope;
      this.log = $rootScope.logger;
      this.$root.authenticated = false;
      this.$root.authService = this.loc.get('authService');
      this.$root.authUser = this.loc.get('authUser');
      $rootScope.logger('FirebaseAuth(constructor)', this.$root.authService, this.$root.authUser);
   }

   FirebaseAuth.prototype.monitor = function($scope) {
      this.log('FirebaseAuth.monitor', arguments);
      this.scopes.push($scope);
   };

   FirebaseAuth.prototype._authStatusChange = function() {
      this.log('FirebaseAuth._authStatusChange', arguments);
      //todo
      //todo
      //todo
   };

   FirebaseAuth.prototype.login = function() {
      this.log('FirebaseAuth.login', arguments);
      //todo
      //todo
      //todo
   };

   function cookie(key, value, options) {
      // key and at least value given, set cookie...
      if (arguments.length > 1 && String(value) !== "[object Object]") {
         options = angular.extend({ path: '/', expires: 365 }, options);

         if (value === null || value === undefined) {
            options.expires = -1;
         }

         if (typeof options.expires === 'number') {
            var days = options.expires, t = options.expires = new Date();
            t.setDate(t.getDate() + days);
         }

         value = String(value);

         return (document.cookie = [
            encodeURIComponent(key), '=',
            options.raw ? value : encodeURIComponent(value),
            options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
            options.path ? '; path=' + options.path : '',
            options.domain ? '; domain=' + options.domain : '',
            options.secure ? '; secure' : ''
         ].join(''));
      }

      // key and possibly options given, get cookie...
      options = value || {};
      var result, decode = options.raw ? function (s) { return s; } : decodeURIComponent;
      return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decode(result[1]) : null;
   }

   function Logger(debugLevel) {
      var fn = function() {
         debugLevel <= 0 && console.log.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      fn.log = fn;
      fn.info = function() {
         debugLevel <= 1 && console.info.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      fn.warn = function() {
         debugLevel <= 2 && console.warn.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      fn.error = function() {
         debugLevel <= 3 && console.error.apply(console, Array.prototype.slice.call(arguments, 0));
      };
      return fn;
   }

})(angular);
